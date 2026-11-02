"""Compare exact search with the trained networks on a JSONL file."""

from __future__ import annotations

import time
from pathlib import Path

import torch

from practice_solver.exact import pipes_connected, solve
from practice_solver.io import load_jsonl
from practice_solver.models import load_model, pipe_tensors, spinner_tensors

EXACT_GAMES = ("net", "racer", "swipe", "wordlogic", "insights", "spinner", "pipes")


def _matches(game: str, puzzle: dict, truth: dict, answer: dict) -> bool:
    if game == "net":
        return answer["x"] == truth["x"] and answer["y"] == truth["y"] and answer["sum"] == truth["sum"]
    if game == "racer":
        return sum(puzzle["nums"][i] for i in answer["indices"]) == truth["target"] and 1 < len(answer["indices"]) < len(puzzle["nums"])
    if game == "swipe":
        return answer["category"] == truth["category"]
    if game == "wordlogic":
        return answer["answer"] == truth["answer"]
    if game == "insights":
        return answer["index"] == truth["index"] and answer["value"] == truth["value"]
    if game == "spinner":
        return answer["rotation"] == truth["rotation"]
    if game == "pipes":
        return _pipe_ok(puzzle, answer["cells"])
    raise KeyError(game)


def _pipe_ok(puzzle: dict, cells: list[dict]) -> bool:
    if not pipes_connected(cells, puzzle["s"], puzzle["N"]):
        return False
    if [cell["t"] for cell in cells] != [cell["t"] for cell in puzzle["cells"]]:
        return False
    if sorted(cell["m"] for cell in cells) != sorted(cell["m"] for cell in puzzle["cells"]):
        return False
    for original, solved in zip(puzzle["cells"], cells):
        if original["t"] != "p" and original != solved:
            return False
    return True


def _exact(records: list[dict]) -> dict:
    started = time.perf_counter()
    correct = 0
    for record in records:
        answer = solve(record)
        correct += _matches(record["game"], record["puzzle"], record["truth"], answer)
    elapsed = time.perf_counter() - started
    return {"correct": correct, "total": len(records), "seconds": elapsed, "per_puzzle_ms": 1000 * elapsed / max(1, len(records))}


def _spinner_ml(records: list[dict], weights: Path) -> dict:
    model = load_model("spinner", weights)
    outer, inner, count, labels = spinner_tensors(records)
    started = time.perf_counter()
    with torch.no_grad():
        predicted = model(outer, inner, count).argmax(dim=1)
    elapsed = time.perf_counter() - started
    correct = int((predicted == labels).sum())
    return {"correct": correct, "total": len(records), "seconds": elapsed, "per_puzzle_ms": 1000 * elapsed / max(1, len(records))}


def _pipes_ml(records: list[dict], weights: Path) -> dict:
    model = load_model("pipes", weights)
    grids, targets, pipes = pipe_tensors(records)
    started = time.perf_counter()
    with torch.no_grad():
        predicted = model(grids).argmax(dim=1)
    elapsed = time.perf_counter() - started
    pipe_cells = int(pipes.sum())
    cell_correct = int(((predicted == targets) & pipes).sum())
    puzzles = 0
    valid = 0
    for row, record in enumerate(records):
        puzzle = record["puzzle"]
        width = puzzle["N"]
        cells = []
        matches = True
        for index, cell in enumerate(puzzle["cells"]):
            y, x = index // width, index % width
            mask = int(predicted[row, y, x]) if cell["t"] == "p" else cell["m"]
            if cell["t"] == "p" and mask != record["truth"]["cells"][index]["m"]:
                matches = False
            cells.append({"t": cell["t"], "m": mask})
        puzzles += matches
        valid += _pipe_ok(puzzle, cells)
    return {
        "cell_correct": cell_correct,
        "pipe_cells": pipe_cells,
        "puzzle_matches_truth": puzzles,
        "valid_routes": valid,
        "total": len(records),
        "seconds": elapsed,
        "per_puzzle_ms": 1000 * elapsed / max(1, len(records)),
    }


def evaluate(data: Path, weights: Path) -> dict:
    rows = load_jsonl(data)
    report = {"exact": {}, "ml": {}}
    for game in EXACT_GAMES:
        group = [row for row in rows if row["game"] == game]
        if group:
            report["exact"][game] = _exact(group)
    spinner = [row for row in rows if row["game"] == "spinner"]
    pipes = [row for row in rows if row["game"] == "pipes"]
    if spinner and (weights / "spinner.pt").exists():
        report["ml"]["spinner"] = _spinner_ml(spinner, weights / "spinner.pt")
    if pipes and (weights / "pipes.pt").exists():
        report["ml"]["pipes"] = _pipes_ml(pipes, weights / "pipes.pt")
    return report


def format_report(report: dict) -> str:
    lines = ["Exact solvers"]
    for game, stats in report["exact"].items():
        acc = 100 * stats["correct"] / stats["total"]
        lines.append(f"  {game}: {stats['correct']}/{stats['total']} ({acc:.1f}%)  {stats['per_puzzle_ms']:.3f} ms/puzzle")
    lines.append("Learned models")
    spinner = report["ml"].get("spinner")
    if spinner:
        acc = 100 * spinner["correct"] / spinner["total"]
        lines.append(f"  spinner: {spinner['correct']}/{spinner['total']} ({acc:.1f}%)  {spinner['per_puzzle_ms']:.3f} ms/puzzle")
    pipes = report["ml"].get("pipes")
    if pipes:
        cell = 100 * pipes["cell_correct"] / max(1, pipes["pipe_cells"])
        puzzle = 100 * pipes["puzzle_matches_truth"] / pipes["total"]
        valid = 100 * pipes["valid_routes"] / pipes["total"]
        lines.append(
            f"  pipes: cells {pipes['cell_correct']}/{pipes['pipe_cells']} ({cell:.1f}%), "
            f"full board {pipes['puzzle_matches_truth']}/{pipes['total']} ({puzzle:.1f}%), "
            f"valid route {pipes['valid_routes']}/{pipes['total']} ({valid:.1f}%)  {pipes['per_puzzle_ms']:.3f} ms/puzzle"
        )
    return "\n".join(lines) + "\n"
