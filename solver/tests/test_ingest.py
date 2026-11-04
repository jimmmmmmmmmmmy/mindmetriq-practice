import json
from pathlib import Path

import pytest

from practice_solver.cli import main
from practice_solver.exact import solve
from practice_solver.ingest import (
    SnapshotError,
    board_from_markers,
    ingest,
    parse_snapshot,
    record_from_snapshot,
    validate,
)
from practice_solver.io import load_jsonl

FIXTURES = Path(__file__).resolve().parent / "fixtures"
RACER = FIXTURES / "number-racer-demo.html"


def divs(*labels: str) -> str:
    rows = []
    for index, label in enumerate(labels):
        rows.append(
            f'<div class="mindmetriq-accessibility" aria-label="{label}" '
            f'style="width: 49.6px; height: 49.6px; left: 26.2px; top: {100.6 + 62 * index:.1f}px;"></div>'
        )
    return "<html><body>" + "".join(rows) + "</body></html>"


def test_racer_snapshot_rebuilds_the_board():
    record, warnings = record_from_snapshot(RACER)
    assert record["puzzle"] == {"nums": [1, 4, 6, 1, 3, 6, 5, 1], "target": 2}
    assert record["truth"]["indices"] == [0, 3]
    assert record["truth"]["derived"] == "exact"
    assert record["source"]["question"] == "1 of 3"
    assert warnings == []
    assert solve(record) == {"indices": [0, 3], "sum": 2}


def test_written_jsonl_round_trips_and_solves(tmp_path):
    out = tmp_path / "racer.jsonl"
    main(["ingest", str(RACER), "--out", str(out), "--level", "3"])
    rows = load_jsonl(out)
    assert len(rows) == 1
    assert rows[0]["level"] == "3"
    assert rows[0]["distribution"] == "mindmetriq-dom"
    assert solve(rows[0]) == {"indices": [0, 3], "sum": 2}


def test_negative_labels_are_read_as_minus():
    text = divs("Target 4", "Collectable -3", "Collectable minus 5", "Collectable 7")
    _, puzzle, _ = board_from_markers(parse_snapshot(text))
    assert puzzle == {"nums": [-3, -5, 7], "target": 4}


def test_unsorted_dom_still_orders_by_position():
    text = (
        '<div class="mindmetriq-accessibility" aria-label="Collectable 9" style="left: 26.2px; top: 300px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="Target 4" style="left: 336.2px; top: 100px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="Collectable 2" style="left: 26.2px; top: 100px;"></div>'
    )
    _, puzzle, _ = board_from_markers(parse_snapshot(text))
    assert puzzle["nums"] == [2, 9]


def test_missing_target_is_rejected():
    with pytest.raises(SnapshotError, match="Target"):
        board_from_markers(parse_snapshot(divs("Collectable 3", "Collectable 4")))


def test_empty_snapshot_is_rejected():
    with pytest.raises(SnapshotError, match="No accessibility markers"):
        board_from_markers(parse_snapshot("<html><body><canvas></canvas></body></html>"))


def test_unknown_game_lists_the_labels_it_saw():
    text = divs("Outer 1", "Inner 2")
    with pytest.raises(SnapshotError) as error:
        board_from_markers(parse_snapshot(text), "spinner")
    assert "Outer 1" in str(error.value)


def test_partial_board_warns_but_still_writes(tmp_path):
    text = divs("Target 5", "Collectable 5", "Collectable 2", "Collectable 9")
    path = tmp_path / "partial.html"
    path.write_text(text, encoding="utf-8")
    record, warnings = record_from_snapshot(path)
    assert record["puzzle"] == {"nums": [5, 2, 9], "target": 5}
    assert any("8" in warning for warning in warnings)
    assert any("single block" in warning for warning in warnings)


def test_unreadable_snapshots_are_skipped_on_request(tmp_path):
    good = tmp_path / "good.html"
    good.write_text(divs("Target 2", "Collectable 1", "Collectable 1", "Collectable 2"), encoding="utf-8")
    bad = tmp_path / "bad.html"
    bad.write_text("<html></html>", encoding="utf-8")
    with pytest.raises(SnapshotError):
        ingest([good, bad])
    records, report = ingest([good, bad], skip_invalid=True)
    assert len(records) == 1
    assert any("skipped" in line for line in report)


def test_validate_flags_a_trivial_racer_board():
    warnings = validate("racer", {"nums": [1, 2, 3, 4, 5, 6, 7, 8], "target": 36})
    assert any("catching every block" in warning for warning in warnings)
