"""Score saved models on seeds that were not used for training or beam-width tuning.

Run from the repo root:

    python -m practice_solver.fresh_eval
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path

from practice_solver.decode import beam_decode
from practice_solver.evaluate import _exact, _matches, _pipe_ok, _pipes_ml, _spinner_ml
from practice_solver.exact import solve

ROOT = Path(__file__).resolve().parents[3]
EXPORT = ROOT / "solver" / "scripts" / "export_puzzles.cjs"
SEEDS = ROOT / "solver" / "fixtures" / "fresh_seeds.json"
WEIGHTS = Path(__file__).resolve().parent / "weights"
# Student t, two-sided 95%, df = 4 (five seeds).
T_95_DF4 = 2.7764451051977987


def load_spec(path: Path = SEEDS) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def board_hash(record: dict) -> str:
    puzzle = record["puzzle"]
    if record["game"] == "pipes":
        payload = {"N": puzzle["N"], "s": puzzle["s"], "t": puzzle["t"], "cells": puzzle["cells"]}
    elif record["game"] == "spinner":
        payload = {"n": puzzle["n"], "inner": puzzle["inner"], "outer": puzzle["outer"]}
    else:
        payload = puzzle
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def export_rows(seed: int, count: int, games: str = "", stress: str = "") -> list[dict]:
    with tempfile.TemporaryDirectory() as directory:
        out = Path(directory) / "rows.jsonl"
        command = ["node", str(EXPORT), "--count", str(count), "--seed", str(seed), "--out", str(out)]
        if games:
            command.extend(["--games", games])
        if stress:
            command.extend(["--stress", stress])
        subprocess.run(command, check=True)
        return [json.loads(line) for line in out.read_text(encoding="utf-8").splitlines() if line]


def hashes_for(rows: list[dict], game: str) -> set[str]:
    return {board_hash(row) for row in rows if row["game"] == game}


def mean_min_ci(rates: list[float]) -> dict:
    count = len(rates)
    mean = sum(rates) / count
    smallest = min(rates)
    if count < 2:
        return {"mean": mean, "min": smallest, "low": mean, "high": mean}
    variance = sum((rate - mean) ** 2 for rate in rates) / (count - 1)
    half = T_95_DF4 * math.sqrt(variance / count)
    return {"mean": mean, "min": smallest, "low": mean - half, "high": mean + half}


def _rate_table(per_seed: list[dict[str, tuple[int, int]]]) -> dict:
    levels = sorted({level for seed in per_seed for level in seed})
    table = {}
    for level in levels:
        rates = []
        correct = total = 0
        for seed in per_seed:
            got, size = seed[level]
            correct += got
            total += size
            rates.append(got / size)
        summary = mean_min_ci(rates)
        summary["correct"] = correct
        summary["total"] = total
        table[str(level)] = summary
    overall_rates = []
    correct = total = 0
    for seed in per_seed:
        got = sum(pair[0] for pair in seed.values())
        size = sum(pair[1] for pair in seed.values())
        correct += got
        total += size
        overall_rates.append(got / size)
    overall = mean_min_ci(overall_rates)
    overall["correct"] = correct
    overall["total"] = total
    table["all"] = overall
    return table


def _flags_by_level(records: list[dict], flags: list[bool]) -> dict[str, tuple[int, int]]:
    buckets: dict[str, list[bool]] = {}
    for record, flag in zip(records, flags):
        buckets.setdefault(str(record["level"]), []).append(bool(flag))
    return {level: (sum(items), len(items)) for level, items in buckets.items()}


def _pure_flags(learned: dict) -> dict[str, tuple[int, int]]:
    # _pipes_ml stores only counts per level, so recompute from those counts.
    return {
        level: (stats["correct"], stats["total"])
        for level, stats in learned["pure_by_level"].items()
    }


def score_spinner(records: list[dict]) -> dict:
    learned = _spinner_ml(records, WEIGHTS / "spinner.pt")
    exact = _exact(records)
    return {"network_correct": learned["correct"], "exact_correct": exact["correct"], "total": len(records)}


def _pipe_rows(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row["game"] == "pipes"]


def take_unseen(rows: list[dict], game: str, blocked: set[str], per_level: int) -> tuple[list[dict], int]:
    """Keep the first unseen board at each level. Returns rows and how many were rejected."""
    chosen: dict[str, list[dict]] = {}
    seen: set[str] = set()
    rejected = 0
    for row in rows:
        if row["game"] != game:
            continue
        key = board_hash(row)
        level = str(row["level"])
        if key in blocked or key in seen:
            rejected += 1
            continue
        bucket = chosen.setdefault(level, [])
        if len(bucket) >= per_level:
            continue
        bucket.append(row)
        seen.add(key)
    short = {level: len(bucket) for level, bucket in chosen.items() if len(bucket) < per_level}
    if short or len(chosen) < 5:
        raise SystemExit(f"Not enough unseen {game} boards. Have { {level: len(rows) for level, rows in chosen.items()} }")
    kept = [row for level in sorted(chosen) for row in chosen[level]]
    return kept, rejected


def run(spec: dict | None = None) -> dict:
    spec = spec or load_spec()
    forbidden = {item["seed"] for item in spec["training"]} | set(spec["already_used_for_tuning"])
    if forbidden.intersection(spec["fresh_seeds"]) or forbidden.intersection(spec["ood_seeds"]):
        raise SystemExit("A fresh seed collides with a training or tuning seed")
    training_pipes: set[str] = set()
    training_spinners: set[str] = set()
    for item in spec["training"]:
        rows = export_rows(item["seed"], item["count"], item["games"])
        training_pipes |= hashes_for(rows, "pipes")
        training_spinners |= hashes_for(rows, "spinner")
    tuning_pipes: set[str] = set()
    for seed in spec["already_used_for_tuning"]:
        count = 40 if seed == 1000 else spec["count"]
        tuning_pipes |= hashes_for(export_rows(seed, count), "pipes")

    fresh_pipe_hashes: set[str] = set()
    pipe_methods: dict[str, list] = {
        "pure": [], "beam_4": [], "best_first": [], "flat_beam_1": [], "flat_beam_4": [], "exact": []
    }
    spinner_seeds = []
    overlap = {"pipes_rejected": 0, "spinners_rejected": 0, "pipes_kept": 0, "spinners_kept": 0}
    blocked_pipes = training_pipes | tuning_pipes
    for seed in spec["fresh_seeds"]:
        rows = export_rows(seed, spec["draw_count"])
        pipes, pipe_rejected = take_unseen(rows, "pipes", blocked_pipes | fresh_pipe_hashes, spec["per_level"])
        spinners, spinner_rejected = take_unseen(rows, "spinner", training_spinners, spec["per_level"])
        overlap["pipes_rejected"] += pipe_rejected
        overlap["spinners_rejected"] += spinner_rejected
        overlap["pipes_kept"] += len(pipes)
        overlap["spinners_kept"] += len(spinners)
        fresh_pipe_hashes |= {board_hash(row) for row in pipes}
        training_spinners |= {board_hash(row) for row in spinners}
        learned = _pipes_ml(pipes, WEIGHTS / "pipes.pt", beam=4)
        pipe_methods["pure"].append(_pure_flags(learned))
        pipe_methods["beam_4"].append({level: (stats["correct"], stats["total"]) for level, stats in learned["beam_by_level"].items()})
        pipe_methods["best_first"].append({level: (stats["correct"], stats["total"]) for level, stats in learned["guided_by_level"].items()})
        exact_flags = [_matches("pipes", row["puzzle"], row["truth"], solve(row)) for row in pipes]
        flat1, flat4 = [], []
        for row in pipes:
            table = [[-1.0] * 16 for _ in range(row["puzzle"]["N"] ** 2)]
            greedy = beam_decode(row["puzzle"], table, beam=1)
            narrow = beam_decode(row["puzzle"], table, beam=4)
            flat1.append(greedy is not None and _pipe_ok(row["puzzle"], greedy))
            flat4.append(narrow is not None and _pipe_ok(row["puzzle"], narrow))
        pipe_methods["exact"].append(_flags_by_level(pipes, exact_flags))
        pipe_methods["flat_beam_1"].append(_flags_by_level(pipes, flat1))
        pipe_methods["flat_beam_4"].append(_flags_by_level(pipes, flat4))
        spinner_seeds.append(score_spinner(spinners))

    ood_pipe_hashes: set[str] = set()
    ood_methods: dict[str, list] = {name: [] for name in pipe_methods}
    for seed in spec["ood_seeds"]:
        pipes = export_rows(seed, spec["ood_count"], stress="7x7")
        keys = hashes_for(pipes, "pipes")
        if keys & training_pipes or keys & ood_pipe_hashes:
            raise SystemExit("Out-of-distribution boards overlap training or each other")
        ood_pipe_hashes |= keys
        learned = _pipes_ml(pipes, WEIGHTS / "pipes.pt", beam=4)
        ood_methods["pure"].append(_pure_flags(learned))
        ood_methods["beam_4"].append({level: (stats["correct"], stats["total"]) for level, stats in learned["beam_by_level"].items()})
        ood_methods["best_first"].append({level: (stats["correct"], stats["total"]) for level, stats in learned["guided_by_level"].items()})
        exact_flags = [_matches("pipes", row["puzzle"], row["truth"], solve(row)) for row in pipes]
        flat1, flat4 = [], []
        for row in pipes:
            table = [[-1.0] * 16 for _ in range(row["puzzle"]["N"] ** 2)]
            greedy = beam_decode(row["puzzle"], table, beam=1)
            narrow = beam_decode(row["puzzle"], table, beam=4)
            flat1.append(greedy is not None and _pipe_ok(row["puzzle"], greedy))
            flat4.append(narrow is not None and _pipe_ok(row["puzzle"], narrow))
        ood_methods["exact"].append(_flags_by_level(pipes, exact_flags))
        ood_methods["flat_beam_1"].append(_flags_by_level(pipes, flat1))
        ood_methods["flat_beam_4"].append(_flags_by_level(pipes, flat4))

    report = {
        "seeds": spec["fresh_seeds"],
        "ood_seeds": spec["ood_seeds"],
        "overlap": overlap,
        "training_pipe_boards": len(training_pipes),
        "training_spinner_boards": len(training_spinners),
        "pipes": {name: _rate_table(rows) for name, rows in pipe_methods.items()},
        "spinner": {
            "network": [row["network_correct"] / row["total"] for row in spinner_seeds],
            "exact": [row["exact_correct"] / row["total"] for row in spinner_seeds],
            "per_seed": spinner_seeds,
        },
        "ood_7x7": {name: _rate_table(rows) for name, rows in ood_methods.items()},
    }
    report["spinner"]["network_summary"] = mean_min_ci(report["spinner"]["network"])
    report["spinner"]["exact_summary"] = mean_min_ci(report["spinner"]["exact"])
    return report


def _pct(summary: dict) -> str:
    low = min(100.0, max(0.0, 100 * summary["low"]))
    high = min(100.0, max(0.0, 100 * summary["high"]))
    return f"{100 * summary['mean']:.1f}% [{low:.1f}, {high:.1f}] min {100 * summary['min']:.1f}%"


def format_report(report: dict) -> str:
    lines = [
        "Fresh seeds " + ", ".join(str(seed) for seed in report["seeds"]),
        "Boards that matched training, the tuning sets, or an earlier fresh seed were dropped: "
        + str(report["overlap"]),
        "",
        "Pipe Puzzle, in distribution. Each seed has 40 boards per level. Mean is across seeds; bracket is the 95% t interval.",
    ]
    order = ("exact", "pure", "beam_4", "best_first", "flat_beam_4", "flat_beam_1")
    labels = {
        "exact": "Exact search",
        "pure": "Pure network",
        "beam_4": "Beam 4",
        "best_first": "Best-first",
        "flat_beam_4": "Flat beam 4",
        "flat_beam_1": "Flat beam 1",
    }
    for name in order:
        lines.append(labels[name])
        for level, summary in report["pipes"][name].items():
            label = "All" if level == "all" else f"L{level}"
            lines.append(f"  {label}: {_pct(summary)}  ({summary['correct']}/{summary['total']})")
    lines.append("")
    lines.append(
        "Shape Spinner: network "
        + _pct(report["spinner"]["network_summary"])
        + "; exact "
        + _pct(report["spinner"]["exact_summary"])
    )
    lines.append("")
    lines.append("Out of distribution, 7 by 7 stress boards. The practice generator cannot emit these.")
    for name in order:
        lines.append(labels[name])
        for level, summary in report["ood_7x7"][name].items():
            label = "All" if level == "all" else level
            lines.append(f"  {label}: {_pct(summary)}  ({summary['correct']}/{summary['total']})")
    return "\n".join(lines) + "\n"


def main() -> None:
    report = run()
    out = ROOT / "solver" / "fixtures" / "fresh_eval.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(format_report(report), end="")


if __name__ == "__main__":
    main()
