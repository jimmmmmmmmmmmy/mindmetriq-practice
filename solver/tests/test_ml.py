import json
from pathlib import Path

from practice_solver.decode import beam_decode
from practice_solver.evaluate import _pipe_ok, evaluate
from practice_solver.exact import pipes_connected

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval.jsonl"
HOLDOUT = Path(__file__).resolve().parents[1] / "fixtures" / "holdout.jsonl"
WEIGHTS = Path(__file__).resolve().parents[1] / "src" / "practice_solver" / "weights"
METRICS = Path(__file__).resolve().parents[1] / "fixtures" / "metrics.json"


def test_saved_models_match_the_recorded_eval():
    report = evaluate(FIXTURE, WEIGHTS)
    saved = json.loads(METRICS.read_text(encoding="utf-8"))["fixture"]
    spinner = report["ml"]["spinner"]
    pipes = report["ml"]["pipes"]
    assert spinner["correct"] == saved["ml"]["spinner"]["correct"]
    assert pipes["cell_correct"] == saved["ml"]["pipes"]["cell_correct"]
    assert pipes["valid_routes"] == saved["ml"]["pipes"]["valid_routes"]
    assert pipes["beam_solved"] == saved["ml"]["pipes"]["beam_solved"]
    assert spinner["correct"] / spinner["total"] >= 0.9
    exact_spinner = report["exact"]["spinner"]
    assert exact_spinner["correct"] == exact_spinner["total"]


def test_pipe_beam_solves_every_holdout_level():
    pipes = evaluate(HOLDOUT, WEIGHTS)["ml"]["pipes"]
    assert pipes["total"] == 200
    assert pipes["beam_width"] == 4
    assert pipes["beam_solved"] / pipes["total"] >= 0.95
    assert pipes["guided_solved"] == pipes["total"]
    assert len(pipes["beam_by_level"]) == 5
    for stats in pipes["beam_by_level"].values():
        assert stats["total"] == 40
        assert stats["correct"] / stats["total"] >= 0.95


def test_oracle_tile_scores_solve_with_a_greedy_beam():
    rows = [json.loads(line) for line in FIXTURE.read_text(encoding="utf-8").splitlines() if line]
    for record in (row for row in rows if row["game"] == "pipes"):
        puzzle, truth = record["puzzle"], record["truth"]
        table = [[-20.0] * 16 for _ in range(puzzle["N"] ** 2)]
        for index, cell in enumerate(truth["cells"]):
            if cell["t"] == "p":
                table[index][cell["m"]] = -0.01
        solved = beam_decode(puzzle, table, beam=1)
        assert solved is not None
        assert pipes_connected(solved, puzzle["s"], puzzle["N"])
        assert _pipe_ok(puzzle, solved)
