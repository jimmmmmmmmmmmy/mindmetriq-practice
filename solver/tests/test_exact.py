import json
from pathlib import Path

from practice_solver.evaluate import _matches
from practice_solver.exact import solve

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "eval.jsonl"


def records():
    return [json.loads(line) for line in FIXTURE.read_text(encoding="utf-8").splitlines() if line]


def test_exact_solvers_match_generator_truth():
    grouped: dict[str, int] = {}
    for record in records():
        answer = solve({"game": record["game"], "puzzle": record["puzzle"]})
        assert _matches(record["game"], record["puzzle"], record["truth"], answer)
        grouped[record["game"]] = grouped.get(record["game"], 0) + 1
    assert grouped.keys() == {"net", "racer", "swipe", "wordlogic", "pipes", "spinner", "insights"}
    assert all(count >= 20 for count in grouped.values())


def test_solve_ignores_a_planted_wrong_answer():
    record = next(row for row in records() if row["game"] == "net")
    planted = json.loads(json.dumps(record))
    planted["puzzle"]["best"] = -999
    planted["puzzle"]["bp"] = [0, 0]
    assert solve(planted)["sum"] == record["truth"]["sum"]
