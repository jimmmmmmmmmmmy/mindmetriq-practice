"""Command line for export, training, evaluation, and one-puzzle solves."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from practice_solver.exact import solve
from practice_solver.ingest import ingest
from practice_solver.io import dump_jsonl

EXPORT = Path(__file__).resolve().parents[2] / "scripts" / "export_puzzles.cjs"
WEIGHTS = Path(__file__).resolve().parent / "weights"


def _export(args: argparse.Namespace) -> None:
    command = [
        "node", str(EXPORT),
        "--count", str(args.count),
        "--seed", str(args.seed),
        "--out", str(args.out),
    ]
    if args.lexicon:
        command.extend(["--lexicon", str(args.lexicon)])
    if args.games:
        command.extend(["--games", args.games])
    subprocess.run(command, check=True)


def _ingest(args: argparse.Namespace) -> None:
    records, report = ingest(args.snapshots, args.game or None, args.level, args.skip_invalid)
    if not records:
        raise SystemExit("No snapshot could be read")
    dump_jsonl(args.out, records)
    for line in report:
        print(line, file=sys.stderr)
    print(f"wrote {len(records)} record(s) to {args.out}")


def _train(args: argparse.Namespace) -> None:
    from practice_solver.train import train

    train(args.data, args.out_dir, args.epochs, tuple(args.games.split(",")))


def _eval(args: argparse.Namespace) -> None:
    from practice_solver.evaluate import evaluate, format_report

    print(format_report(evaluate(args.data, args.weights)), end="")


def _solve(args: argparse.Namespace) -> None:
    record = json.loads(Path(args.puzzle).read_text(encoding="utf-8"))
    if args.method == "exact" or record.get("game") not in {"spinner", "pipes"}:
        print(json.dumps(solve(record), indent=2))
        return
    from practice_solver.models import load_model, pipe_tensors, spinner_tensors
    import torch
    weights = Path(args.weights)
    if record["game"] == "spinner":
        model = load_model("spinner", weights / "spinner.pt")
        outer, inner, count, _ = spinner_tensors([record | {"truth": {"rotation": 0}}])
        with torch.no_grad():
            rotation = int(model(outer, inner, count).argmax(dim=1)[0])
        print(json.dumps({"rotation": rotation}))
        return
    from practice_solver.decode import best_first_decode
    model = load_model("pipes", weights / "pipes.pt")
    puzzle = record["puzzle"]
    grids, _, _ = pipe_tensors([record | {"truth": {"cells": puzzle["cells"]}}])
    with torch.no_grad():
        log_probs = torch.log_softmax(model(grids), dim=1)[0]
    table = []
    for index in range(puzzle["N"] * puzzle["N"]):
        y, x = index // puzzle["N"], index % puzzle["N"]
        table.append(log_probs[:, y, x].tolist())
    cells, _expanded = best_first_decode(puzzle, table)
    if cells is None:
        raise SystemExit("Network-guided search did not find a connected route")
    print(json.dumps({"cells": cells}))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Solve puzzles exported from this repo's generators.")
    sub = parser.add_subparsers(dest="command", required=True)
    export = sub.add_parser("export", help="Write JSONL from the local generators")
    export.add_argument("--count", type=int, default=40)
    export.add_argument("--seed", type=int, default=1000)
    export.add_argument("--out", type=Path, required=True)
    export.add_argument("--lexicon", type=Path)
    export.add_argument("--games", default="")
    export.set_defaults(func=_export)
    training = sub.add_parser("train", help="Train spinner and pipe networks")
    training.add_argument("--data", type=Path, required=True)
    training.add_argument("--out-dir", type=Path, default=WEIGHTS)
    training.add_argument("--epochs", type=int, default=30)
    training.add_argument("--games", default="spinner,pipes")
    training.set_defaults(func=_train)
    evaluation = sub.add_parser("eval", help="Score exact solvers and saved networks")
    evaluation.add_argument("--data", type=Path, required=True)
    evaluation.add_argument("--weights", type=Path, default=WEIGHTS)
    evaluation.set_defaults(func=_eval)
    ingesting = sub.add_parser("ingest", help="Convert saved game page snapshots into JSONL")
    ingesting.add_argument("snapshots", nargs="+", type=Path)
    ingesting.add_argument("--out", type=Path, required=True)
    ingesting.add_argument("--game", default="", help="Force an adapter instead of detecting one")
    ingesting.add_argument("--level", default="unknown", help="Level label stored with every record")
    ingesting.add_argument("--skip-invalid", action="store_true", help="Keep going past unreadable snapshots")
    ingesting.set_defaults(func=_ingest)
    solving = sub.add_parser("solve", help="Solve one exported JSON record")
    solving.add_argument("puzzle", type=Path)
    solving.add_argument("--method", choices=("exact", "ml"), default="exact")
    solving.add_argument("--weights", type=Path, default=WEIGHTS)
    solving.set_defaults(func=_solve)
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main(sys.argv[1:])
