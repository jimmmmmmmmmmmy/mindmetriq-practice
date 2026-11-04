"""Turn a saved game page into solver records.

The game itself paints a canvas. The only machine-readable state on a live
assessment page is the accessibility overlay beside it: one div per object,
each with an aria-label and a pixel position. This module reads those markers
from a local HTML snapshot, rebuilds the board, and derives truth with the
exact solver. It never fetches, opens a browser, or reads a stored answer key.

A snapshot is what a browser writes for "Save page as, Webpage, Complete"
(or the outer HTML copied from the element inspector) while a question is on
screen. Saving mid-animation yields a partial board; such files are rejected
instead of being written as puzzles.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

from practice_solver.errors import SnapshotError
from practice_solver.exact import solve as exact_solve
from practice_solver.layout import LAYOUT_TOLERANCE, NET_LAYOUT

CLASS_TOKEN = "mindmetriq-accessibility"
PX = re.compile(r"([a-z-]+)\s*:\s*(-?\d+(?:\.\d+)?)px")
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
MINUS_WORDS = re.compile(r"\bminus\s+", re.IGNORECASE)
VALUE_LABEL = re.compile(r"(?:minus\s+)?-?\d+", re.IGNORECASE)


@dataclass(frozen=True)
class Marker:
    """One accessibility div: what it is and where it sits, in CSS pixels."""

    label: str
    left: float | None
    top: float | None
    width: float | None
    height: float | None

    @property
    def kind(self) -> str:
        return self.label.split(" ", 1)[0].lower()


class _Overlay(HTMLParser):
    def __init__(self, class_token: str) -> None:
        super().__init__(convert_charrefs=True)
        self.class_token = class_token
        self.markers: list[Marker] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "div":
            return
        values = {name: value or "" for name, value in attrs}
        if self.class_token not in values.get("class", ""):
            return
        label = values.get("aria-label", "").strip()
        if not label:
            return
        style = {name: float(value) for name, value in PX.findall(values.get("style", ""))}
        self.markers.append(
            Marker(
                label=label,
                left=style.get("left"),
                top=style.get("top"),
                width=style.get("width"),
                height=style.get("height"),
            )
        )


def parse_snapshot(text: str, class_token: str = CLASS_TOKEN) -> list[Marker]:
    """Read every accessibility marker from an HTML snapshot."""
    parser = _Overlay(class_token)
    parser.feed(text)
    parser.close()
    return parser.markers


def read_snapshot(path: Path, class_token: str = CLASS_TOKEN) -> list[Marker]:
    return parse_snapshot(_read(path), class_token)


def _read(path: Path) -> str:
    path = Path(path)
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise SnapshotError(f"Cannot read {path}: {exc}") from exc


class _Canvas(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.style: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "canvas" and self.style is None:
            self.style = dict(attrs).get("style") or ""


def canvas_css(text: str) -> tuple[float, float] | None:
    """The canvas size the page states, in CSS pixels; the scale for a screenshot."""
    parser = _Canvas()
    parser.feed(text)
    parser.close()
    if not parser.style:
        return None
    style = {name: float(value) for name, value in PX.findall(parser.style)}
    if "width" in style and "height" in style:
        return style["width"], style["height"]
    return None


def _value(label: str) -> int:
    """The integer an object label carries: 'Collectable -4', 'Minus 4', 'Target 2'."""
    text = MINUS_WORDS.sub("-", label)
    found = NUMBER.search(text)
    if found is None:
        raise SnapshotError(f"No number in label {label!r}")
    return int(round(float(found.group(0))))


def _order(position: str, markers: list[Marker]) -> list[Marker]:
    if any(getattr(marker, position) is None for marker in markers):
        raise SnapshotError(f"Markers without a {position} position cannot be ordered")
    return sorted(markers, key=lambda marker: (getattr(marker, position), marker.left or 0.0))


def racer(markers: list[Marker], options: dict) -> tuple[dict, list[str]]:
    """Number Racer: blocks arrive top to bottom, so y gives the falling order."""
    blocks = [marker for marker in markers if marker.kind == "collectable"]
    targets = [marker for marker in markers if marker.kind == "target"]
    if not blocks:
        raise SnapshotError("No Collectable markers in the snapshot")
    if len(targets) != 1:
        raise SnapshotError(f"Expected one Target marker, found {len(targets)}")
    order = _order("top", blocks)
    puzzle = {"nums": [_value(marker.label) for marker in order], "target": _value(targets[0].label)}
    return puzzle, []


def _lattice(marker: Marker, layout: dict) -> tuple[int, int]:
    if marker.left is None or marker.top is None:
        raise SnapshotError(f"Marker {marker.label!r} has no position")
    column = round((marker.left - layout["left"]) / layout["pitch"])
    row = round((marker.top - layout["top"]) / layout["pitch"])
    dx = marker.left - (layout["left"] + column * layout["pitch"])
    dy = marker.top - (layout["top"] + row * layout["pitch"])
    if abs(dx) > LAYOUT_TOLERANCE or abs(dy) > LAYOUT_TOLERANCE:
        raise SnapshotError(f"Marker {marker.label!r} at {marker.left:.1f},{marker.top:.1f} is off the grid layout")
    if not (0 <= row < layout["n"] and 0 <= column < layout["n"]):
        raise SnapshotError(f"Marker {marker.label!r} sits outside the {layout['n']} by {layout['n']} grid")
    return row, column


def _shape(spec: str) -> dict:
    """'111/010/111' -> cells, width, height. Rows are top to bottom, left to right."""
    rows = [row for row in spec.strip().split("/") if row]
    if not rows:
        raise SnapshotError("Empty net shape")
    cells = [[x, y] for y, row in enumerate(rows) for x, glyph in enumerate(row) if glyph not in "0 .-"]
    if not cells:
        raise SnapshotError("Net shape has no covered cells")
    return {"cells": cells, "w": max(len(row) for row in rows), "h": len(rows)}


def net(markers: list[Marker], options: dict) -> tuple[dict, list[str]]:
    """Net the Numbers: numbered cells on a 5 by 5 lattice, plus the net's box."""
    layout = options.get("layout") or NET_LAYOUT
    box = next((marker for marker in markers if marker.label.lower() == "glowing net"), None)
    if box is None:
        raise SnapshotError("No 'Glowing net' marker in the snapshot")
    grid = [0] * (layout["n"] * layout["n"])
    filled: set[tuple[int, int]] = set()
    for marker in markers:
        if marker is box or marker.width is None or abs(marker.width - layout["size"]) > 0.5:
            continue  # the question counter and the timer use their own boxes
        if not VALUE_LABEL.fullmatch(marker.label):
            continue
        cell = _lattice(marker, layout)
        if cell in filled:
            raise SnapshotError(f"Two numbers on row {cell[0] + 1}, column {cell[1] + 1}")
        filled.add(cell)
        grid[cell[0] * layout["n"] + cell[1]] = _value(marker.label)
    if not filled:
        raise SnapshotError("No numbered cells on the grid")
    width = round((box.width or 0) / layout["pitch"])
    height = round((box.height or 0) / layout["pitch"])
    if width < 1 or height < 1:
        raise SnapshotError(f"Net box is {box.width} by {box.height} px, which is not a whole number of cells")
    column = round(((box.left or 0) + layout["pad"] - layout["left"]) / layout["pitch"])
    row = round(((box.top or 0) + layout["pad"] - layout["top"]) / layout["pitch"])
    notes: list[str] = []
    spec = options.get("net_shape")
    image = options.get("image")
    if spec:
        shape = _shape(spec)
        notes.append("net shape given on the command line")
    elif image is not None:
        from practice_solver.pixels import net_shape

        canvas = options.get("canvas")
        if not canvas:
            raise SnapshotError("Reading the net from a screenshot needs the canvas size in CSS pixels")
        shape = net_shape(image, (box.left or 0, box.top or 0, box.width or 0, box.height or 0), canvas, layout)
        notes.append(f"net shape read from the screenshot ({len(shape['cells'])} cells)")
    elif options.get("net_box"):
        shape = {"cells": [[x, y] for y in range(height) for x in range(width)], "w": width, "h": height}
        notes.append(f"net shape taken from the {width} by {height} box, as requested by net_box")
    else:
        raise SnapshotError(
            f"the overlay carries only the net's {width} by {height} box, not its cells; "
            "pass --net-shape (rows of 0/1, e.g. 110/011), --image with a canvas screenshot, "
            "or --net-box to accept the box as the shape"
        )
    puzzle = {"g": grid, "sh": shape, "_net": [column, row]}
    return puzzle, notes


ADAPTERS = {"racer": racer, "net": net}


def board_from_markers(
    markers: list[Marker], game: str | None = None, options: dict | None = None
) -> tuple[str, dict, dict, list[str]]:
    """Rebuild one board. Without a game name, the marker kinds pick the adapter."""
    options = options or {}
    if not markers:
        raise SnapshotError("No accessibility markers in this snapshot")
    if game is None:
        labels = {marker.label.lower() for marker in markers}
        if "glowing net" in labels:
            game = "net"
        elif any(marker.kind == "collectable" for marker in markers):
            game = "racer"
        else:
            raise SnapshotError(f"Cannot tell the game from labels {sorted(labels)}; pass --game")
    if game not in ADAPTERS:
        raise SnapshotError(f"No adapter for {game!r}. Labels present: {sorted({m.label for m in markers})}")
    puzzle, notes = ADAPTERS[game](markers, options)
    meta: dict = {}
    total = next((marker for marker in markers if re.fullmatch(r"of \d+", marker.label)), None)
    if total is not None:
        # The counter sits immediately left of "of N" on the same line; bare
        # numbers elsewhere on the page are grid cells or the timer.
        row = [
            marker
            for marker in markers
            if re.fullmatch(r"\d+", marker.label)
            and abs((marker.top or 0) - (total.top or 0)) < 1
            and (marker.left or 0) < (total.left or 0)
        ]
        if row:
            meta["question"] = f"{max(row, key=lambda marker: marker.left or 0).label} {total.label}"
    if "_net" in puzzle:
        meta["net_at"] = puzzle.pop("_net")
    return game, puzzle, meta, notes


def validate(game: str, puzzle: dict) -> list[str]:
    """Board properties the practice generator guarantees but a live page may not."""
    warnings: list[str] = []
    if game == "racer":
        nums, target = puzzle["nums"], puzzle["target"]
        if len(nums) != 8:
            warnings.append(f"{len(nums)} blocks, the practice game uses 8")
        if target == 0:
            warnings.append("target is zero")
        if abs(target) > 25:
            warnings.append(f"target {target} is outside the practice range")
        if target in nums:
            warnings.append("target equals a single block")
        if sum(nums) == target:
            warnings.append("catching every block reaches the target")
        if len(set(nums)) == 1:
            warnings.append("every block has the same value")
        return warnings
    if game == "net":
        grid, shape = puzzle["g"], puzzle["sh"]
        if len(grid) != 25:
            warnings.append(f"grid has {len(grid)} cells, the product uses 25")
        filled = [value for value in grid if value]
        if not filled:
            warnings.append("every cell is empty")
        if max(shape["w"], shape["h"]) > 5:
            warnings.append(f"net is {shape['w']} by {shape['h']}, larger than the grid")
        if len(shape["cells"]) < 2:
            warnings.append("net covers fewer than two cells")
    return warnings


def record_from_snapshot(
    path: Path, game: str | None = None, level: str = "unknown", options: dict | None = None
) -> tuple[dict, list[str]]:
    """One JSONL record from one snapshot, plus any board warnings."""
    options = dict(options or {})
    text = _read(path)
    if options.get("image") is not None and not options.get("canvas"):
        canvas = canvas_css(text)
        if canvas:
            options["canvas"] = canvas
    markers = parse_snapshot(text)
    name, puzzle, meta, notes = board_from_markers(markers, game, options)
    warnings = notes + validate(name, puzzle)
    try:
        answer = exact_solve({"game": name, "puzzle": puzzle})
    except (ValueError, KeyError) as exc:
        raise SnapshotError(f"{Path(path).name}: no solution for the board ({exc})") from exc
    truth = {"target": puzzle["target"]} if name == "racer" else {}
    truth.update({key: value for key, value in answer.items() if key != "sum"})
    if name == "net":
        truth["sum"] = answer["sum"]
    truth["derived"] = "exact"
    record = {
        "game": name,
        "level": level,
        "distribution": "mindmetriq-dom",
        "puzzle": puzzle,
        "truth": truth,
        "source": {"kind": "dom-snapshot", "file": Path(path).name, **meta},
    }
    image = options.get("image")
    if isinstance(image, (str, Path)):
        record["source"]["image"] = Path(image).name
    return record, warnings


def ingest(
    paths: list[Path],
    game: str | None = None,
    level: str = "unknown",
    skip_invalid: bool = False,
    options: dict | None = None,
) -> tuple[list[dict], list[str]]:
    """Read many snapshots. Returns the records and a human-readable report."""
    records: list[dict] = []
    report: list[str] = []
    for path in paths:
        settings = dict(options or {})
        if settings.get("image") is None:
            for suffix in (".png", ".PNG", ".jpg", ".jpeg"):
                sibling = Path(path).with_suffix(suffix)
                if sibling.exists():
                    settings["image"] = sibling
                    break
        try:
            record, warnings = record_from_snapshot(path, game, level, settings)
        except SnapshotError as exc:
            if not skip_invalid:
                raise
            report.append(f"skipped {exc}")
            continue
        records.append(record)
        for warning in warnings:
            report.append(f"{Path(path).name}: {warning}")
        report.append(f"{Path(path).name}: {record['game']} board {record['puzzle']}")
    return records, report
