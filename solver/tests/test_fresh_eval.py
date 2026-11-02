import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEEDS = ROOT / "fixtures" / "fresh_seeds.json"
REPORT = ROOT / "fixtures" / "fresh_eval.json"


def test_fresh_seeds_were_not_used_for_training_or_tuning():
    spec = json.loads(SEEDS.read_text(encoding="utf-8"))
    used = {item["seed"] for item in spec["training"]} | set(spec["already_used_for_tuning"])
    assert used.isdisjoint(spec["fresh_seeds"])
    assert used.isdisjoint(spec["ood_seeds"])
    assert len(spec["fresh_seeds"]) == 5
    assert spec["per_level"] == 40
    assert spec["count"] == 200


def test_committed_fresh_eval_has_no_board_overlap_and_beam_stays_high():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    assert report["overlap"]["pipes_kept"] == 1000
    assert report["overlap"]["spinners_kept"] == 1000
    beam = report["pipes"]["beam_4"]
    assert beam["all"]["correct"] / beam["all"]["total"] >= 0.95
    assert beam["5"]["min"] >= 0.95
    assert report["pipes"]["best_first"]["all"]["correct"] == 1000
    assert report["pipes"]["exact"]["all"]["correct"] == 1000
    assert report["spinner"]["exact_summary"]["min"] == 1
    assert report["ood_7x7"]["exact"]["all"]["correct"] == 200
    assert report["ood_7x7"]["pure"]["all"]["mean"] < 0.05
