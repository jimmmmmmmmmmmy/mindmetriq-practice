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
    _, puzzle, _, _ = board_from_markers(parse_snapshot(text))
    assert puzzle == {"nums": [-3, -5, 7], "target": 4}


def test_unsorted_dom_still_orders_by_position():
    text = (
        '<div class="mindmetriq-accessibility" aria-label="Collectable 9" style="left: 26.2px; top: 300px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="Target 4" style="left: 336.2px; top: 100px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="Collectable 2" style="left: 26.2px; top: 100px;"></div>'
    )
    _, puzzle, _, _ = board_from_markers(parse_snapshot(text))
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


NET_BOARDS = {
    1: ([[9, 0, 0, 0, 0], [0, 0, 0, 0, 7], [6, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 4, 0, 0]], (3, 3), [1, 1]),
    2: ([[0, 0, 0, 0, 2], [0, 0, 0, -1, 0], [0, 0, 0, 4, 0], [0, 0, 9, 0, 0], [0, 0, -9, 0, 0]], (2, 3), [2, 2]),
    3: (
        [[-9, -9, -9, -9, -9], [0, -9, -9, -9, -9], [-9, -9, -1, -9, -9], [0, -9, -9, -9, -9], [-9, -9, -9, -9, -9]],
        (3, 3),
        [0, 1],
    ),
    4: (
        [[0, -4, 1, 1, -1], [0, 0, 0, 3, -2], [0, 1, 0, 0, -2], [0, 2, 0, -3, 0], [2, 0, 0, 2, 0]],
        (3, 2),
        [2, 0],
    ),
    5: (
        [[0, 0, -2, 0, 0], [4, 1, 1, 0, 3], [3, -3, 0, 1, 4], [-2, 1, 0, -3, 4], [0, 3, 0, -1, 0]],
        (2, 3),
        [3, 2],
    ),
}


def best_rectangle_sum(grid: list[int], width: int, height: int) -> int:
    """Independent of exact.solve_net: slide a width by height rectangle over the grid."""
    best = None
    for row in range(5 - height + 1):
        for column in range(5 - width + 1):
            total = sum(grid[(row + dy) * 5 + column + dx] for dy in range(height) for dx in range(width))
            best = total if best is None or total > best else best
    return best


@pytest.mark.parametrize("number", sorted(NET_BOARDS))
def test_net_pages_rebuild_their_grids(number):
    grid, (width, height), net_at = NET_BOARDS[number]
    record, warnings = record_from_snapshot(FIXTURES / f"net-practice-{number}.html")
    assert record["game"] == "net"
    assert record["puzzle"]["g"] == [value for row in grid for value in row]
    assert record["puzzle"]["sh"]["w"] == width
    assert record["puzzle"]["sh"]["h"] == height
    assert len(record["puzzle"]["sh"]["cells"]) == width * height
    assert record["source"]["net_at"] == net_at
    assert record["truth"]["sum"] == best_rectangle_sum(record["puzzle"]["g"], width, height)
    assert solve(record)["sum"] == record["truth"]["sum"]
    assert any("net shape taken from" in warning for warning in warnings)


def test_net_page_counter_and_timer_are_not_cells():
    record, _ = record_from_snapshot(FIXTURES / "net-practice-1.html")
    assert record["source"]["question"] == "1 of 3"
    assert max(abs(value) for value in record["puzzle"]["g"]) == 9


def test_net_shape_flag_overrides_the_box(tmp_path):
    path = tmp_path / "board.html"
    path.write_text(
        '<div class="mindmetriq-accessibility" aria-label="Glowing net" '
        'style="width: 211.833px; height: 211.833px; left: 100.083px; top: 236.483px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="9" '
        'style="width: 56.4889px; height: 56.4889px; left: 36.5333px; top: 172.933px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="Minus 2" '
        'style="width: 56.4889px; height: 56.4889px; left: 107.144px; top: 243.544px;"></div>',
        encoding="utf-8",
    )
    record, warnings = record_from_snapshot(path, options={"net_shape": "110/011"})
    assert record["puzzle"]["sh"] == {"cells": [[0, 0], [1, 0], [1, 1], [2, 1]], "w": 3, "h": 2}
    assert not any("net shape taken from" in warning for warning in warnings)
    assert solve(record)["sum"] == 7  # 9 plus the -2 the L shape also covers


def test_net_marker_off_the_lattice_is_rejected(tmp_path):
    path = tmp_path / "skewed.html"
    path.write_text(
        '<div class="mindmetriq-accessibility" aria-label="Glowing net" '
        'style="width: 211.833px; height: 211.833px; left: 100.083px; top: 236.483px;"></div>'
        '<div class="mindmetriq-accessibility" aria-label="9" '
        'style="width: 56.4889px; height: 56.4889px; left: 61.2px; top: 172.933px;"></div>',
        encoding="utf-8",
    )
    with pytest.raises(SnapshotError, match="off the grid layout"):
        record_from_snapshot(path)


def test_net_cli_writes_every_page(tmp_path):
    out = tmp_path / "net.jsonl"
    pages = [str(FIXTURES / f"net-practice-{number}.html") for number in sorted(NET_BOARDS)]
    main(["ingest", *pages, "--out", str(out), "--level", "1"])
    rows = load_jsonl(out)
    assert len(rows) == 5
    assert {row["game"] for row in rows} == {"net"}
    assert all(row["truth"]["derived"] == "exact" for row in rows)
    assert json.dumps(rows[0])  # serialisable as written

