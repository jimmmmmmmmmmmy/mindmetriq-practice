import json
from pathlib import Path

from practice_solver.evaluate import evaluate

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval.jsonl"
WEIGHTS = Path(__file__).resolve().parents[1] / "src" / "practice_solver" / "weights"
METRICS = Path(__file__).resolve().parents[1] / "fixtures" / "metrics.json"


def test_saved_models_match_the_recorded_eval():
    report = evaluate(FIXTURE, WEIGHTS)
    saved = json.loads(METRICS.read_text(encoding="utf-8"))
    spinner = report["ml"]["spinner"]
    pipes = report["ml"]["pipes"]
    assert spinner["correct"] == saved["ml"]["spinner"]["correct"]
    assert pipes["cell_correct"] == saved["ml"]["pipes"]["cell_correct"]
    assert pipes["valid_routes"] == saved["ml"]["pipes"]["valid_routes"]
    assert spinner["correct"] / spinner["total"] >= 0.9
    exact_spinner = report["exact"]["spinner"]
    assert exact_spinner["correct"] == exact_spinner["total"]
