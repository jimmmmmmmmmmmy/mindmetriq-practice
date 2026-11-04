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

from practice_solver.exact import solve as exact_solve

CLASS_TOKEN = "mindmetriq-accessibility"
PX = re.compile(r"([a-z-]+)\s*:\s*(-?\d+(?:\.\d+)?)px")
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
MINUS_WORDS = re.compile(r"\bminus\s+", re.IGNORECASE)


class SnapshotError(ValueError):
    """The snapshot is not a board this module can read."""


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
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        raise SnapshotError(f"Cannot read {path}: {exc}") from exc
    return parse_snapshot(text, class_token)


def _value(label: str) -> int:
    """The integer an object label carries: 'Collectable -4', 'Target 2'."""
    text = MINUS_WORDS.sub("-", label)
    found = NUMBER.search(text)
    if found is None:
        raise SnapshotError(f"No number in label {label!r}")
    return int(round(float(found.group(0))))


def _sorted_by(position: str, markers: list[Marker]) -> list[Marker]:
    if any(getattr(marker, position) is None for marker in markers):
        raise SnapshotError(f"Markers without a {position} position cannot be ordered")
    return sorted(markers, key=lambda marker: (getattr(marker, position), marker.left or 0.0))


def racer(markers: list[Marker]) -> dict:
    """Number Racer: blocks arrive top to bottom, so y gives the falling order."""
    blocks = [marker for marker in markers if marker.kind == "collectable"]
    targets = [marker for marker in markers if marker.kind == "target"]
    if not blocks:
        raise SnapshotError("No Collectable markers in the snapshot")
    if len(targets) != 1:
        raise SnapshotError(f"Expected one Target marker, found {len(targets)}")
    order = _sorted_by("top", blocks)
    return {"nums": [_value(marker.label) for marker in order], "target": _value(targets[0].label)}


ADAPTERS = {"racer": racer}


def board_from_markers(markers: list[Marker], game: str | None = None) -> tuple[str, dict, dict]:
    """Rebuild one board. Without a game name, the marker kinds pick the adapter."""
    if not markers:
        raise SnapshotError("No accessibility markers in this snapshot")
    if game is None:
        if any(marker.kind == "collectable" for marker in markers):
            game = "racer"
        else:
            kinds = sorted({marker.kind for marker in markers})
            raise SnapshotError(f"Cannot tell the game from labels {kinds}; pass --game")
    if game not in ADAPTERS:
        kinds = sorted({marker.label for marker in markers})
        raise SnapshotError(f"No adapter for {game!r}. Labels present: {kinds}")
    meta: dict = {}
    counter = [marker.label for marker in markers if re.fullmatch(r"\d+", marker.label)]
    total = [marker.label for marker in markers if re.fullmatch(r"of \d+", marker.label)]
    if counter and total:
        meta["question"] = f"{counter[0]} {total[0]}"
    return game, ADAPTERS[game](markers), meta


def validate(game: str, puzzle: dict) -> list[str]:
    """Board properties the practice generator guarantees but a live page may not."""
    warnings: list[str] = []
    if game != "racer":
        return warnings
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


def record_from_snapshot(path: Path, game: str | None = None, level: str = "unknown") -> tuple[dict, list[str]]:
    """One JSONL record from one snapshot, plus any board warnings."""
    markers = read_snapshot(path)
    name, puzzle, meta = board_from_markers(markers, game)
    warnings = validate(name, puzzle)
    try:
        answer = exact_solve({"game": name, "puzzle": puzzle})
    except (ValueError, KeyError) as exc:
        raise SnapshotError(f"{Path(path).name}: no solution for the board ({exc})") from exc
    truth = {"target": puzzle["target"]} if name == "racer" else {}
    truth.update({key: value for key, value in answer.items() if key != "sum"})
    truth["derived"] = "exact"
    record = {
        "game": name,
        "level": level,
        "distribution": "mindmetriq-dom",
        "puzzle": puzzle,
        "truth": truth,
        "source": {"kind": "dom-snapshot", "file": Path(path).name, **meta},
    }
    return record, warnings


def ingest(
    paths: list[Path],
    game: str | None = None,
    level: str = "unknown",
    skip_invalid: bool = False,
) -> tuple[list[dict], list[str]]:
    """Read many snapshots. Returns the records and a human-readable report."""
    records: list[dict] = []
    report: list[str] = []
    for path in paths:
        try:
            record, warnings = record_from_snapshot(path, game, level)
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
