"""Exact solvers. Each function reads a puzzle dict and ignores any truth field."""

from __future__ import annotations

import json
from importlib.resources import files
from functools import lru_cache

DIRS = {1: (0, -1, 4), 2: (1, 0, 8), 4: (0, 1, 1), 8: (-1, 0, 2)}


@lru_cache(maxsize=1)
def lexicon() -> dict:
    raw = (files("practice_solver") / "data" / "lexicon.json").read_text(encoding="utf-8")
    data = json.loads(raw)
    synonyms: dict[str, tuple[str, ...]] = {}
    for group in data["synonyms"]:
        frozen = tuple(group)
        for word in frozen:
            synonyms[word] = frozen
    opposites = {tuple(sorted(pair)) for pair in data["opposites"]}
    analogies = []
    for group in data["analogies"]:
        pairs = {tuple(pair) for pair in group["pairs"]}
        forward = {left: right for left, right in group["pairs"]}
        analogies.append({"relation": group["relation"], "pairs": pairs, "forward": forward})
    return {"synonyms": synonyms, "opposites": opposites, "analogies": analogies}


def solve_net(puzzle: dict) -> dict:
    grid, shape = puzzle["g"], puzzle["sh"]
    best = None
    for y in range(5 - shape["h"] + 1):
        for x in range(5 - shape["w"] + 1):
            total = sum(grid[(y + dy) * 5 + x + dx] for dx, dy in shape["cells"])
            if best is None or total > best["sum"]:
                best = {"x": x, "y": y, "sum": total}
    if best is None:
        raise ValueError("Net has no placement")
    return best


def solve_racer(puzzle: dict) -> dict:
    nums, target = puzzle["nums"], puzzle["target"]
    best = None
    for mask in range(1, (1 << len(nums)) - 1):
        indices = [i for i, value in enumerate(nums) if mask & (1 << i)]
        if sum(nums[i] for i in indices) == target and (best is None or len(indices) < len(best)):
            best = indices
    if best is None:
        raise ValueError("No subset reaches the target")
    return {"indices": best, "sum": target}


def solve_swipe(puzzle: dict) -> dict:
    bank = lexicon()
    a, b = puzzle["words"]
    if tuple(sorted((a, b))) in bank["opposites"]:
        return {"category": "A"}
    group_a, group_b = bank["synonyms"].get(a), bank["synonyms"].get(b)
    if group_a is not None and group_a == group_b:
        return {"category": "S"}
    return {"category": "N"}


def solve_wordlogic(puzzle: dict) -> dict:
    bank = lexicon()
    left = tuple(puzzle["left"])
    found = next(group for group in bank["analogies"] if left in group["pairs"])
    answer = found["forward"][puzzle["stem"]]
    if answer not in puzzle["options"]:
        raise ValueError("Analogy answer is not an option")
    return {"answer": answer, "relation": found["relation"]}


def _connected(cells: list[dict], start: int, width: int) -> bool:
    current, out, seen = start, cells[start]["m"], 0
    while seen <= width * width + 2:
        seen += 1
        step = DIRS.get(out)
        if step is None:
            return False
        dx, dy, back = step
        x, y = current % width + dx, current // width + dy
        if not (0 <= x < width and 0 <= y < width):
            return False
        nxt = y * width + x
        cell = cells[nxt]
        if not cell["m"] & back:
            return False
        if cell["t"] == "e":
            return nxt != start
        if cell["t"] != "p":
            return False
        out = cell["m"] & ~back
        current = nxt
    return False


def solve_pipes(puzzle: dict) -> dict:
    width, cells, start, end = puzzle["N"], puzzle["cells"], puzzle["s"], puzzle["t"]
    counts: dict[int, int] = {}
    for cell in cells:
        if cell["t"] == "p":
            counts[cell["m"]] = counts.get(cell["m"], 0) + 1
    start_bits = [bit for bit in (1, 2, 4, 8) if cells[start]["m"] & bit]
    if len(start_bits) != 1:
        raise ValueError("Pipe start is ambiguous")
    assignment: dict[int, int] = {}

    def distance(index: int) -> int:
        return abs(index % width - end % width) + abs(index // width - end // width)

    def search(index: int, out_bit: int, path: list[int]) -> bool:
        dx, dy, entry = DIRS[out_bit]
        x, y = index % width + dx, index // width + dy
        if not (0 <= x < width and 0 <= y < width):
            return False
        nxt = y * width + x
        if nxt in path:
            return False
        tile = cells[nxt]
        if tile["t"] == "e":
            return nxt == end and bool(tile["m"] & entry)
        if tile["t"] != "p":
            return False
        choices = [mask for mask, count in counts.items() if count and (mask & entry) and (mask & ~entry) in DIRS]
        choices.sort(key=lambda mask: _exit_distance(x, y, mask, entry, width, distance))
        for mask in choices:
            counts[mask] -= 1
            assignment[nxt] = mask
            if search(nxt, mask & ~entry, [*path, nxt]):
                return True
            del assignment[nxt]
            counts[mask] += 1
        return False

    if not search(start, start_bits[0], [start]):
        raise ValueError("No pipe route")
    solved = [{"t": cell["t"], "m": cell["m"]} for cell in cells]
    bag = [mask for mask, count in counts.items() for _ in range(count)]
    for index, cell in enumerate(cells):
        if cell["t"] != "p":
            continue
        solved[index] = {"t": "p", "m": assignment[index] if index in assignment else bag.pop()}
    if not _connected(solved, start, width):
        raise ValueError("Constructed pipe route is not connected")
    return {"cells": solved}


def _exit_distance(x: int, y: int, mask: int, entry: int, width: int, distance) -> int:
    dx, dy, _ = DIRS[mask & ~entry]
    nx, ny = x + dx, y + dy
    if not (0 <= nx < width and 0 <= ny < width):
        return 99
    return distance(ny * width + nx)


def pipes_connected(cells: list[dict], start: int, width: int) -> bool:
    return _connected(cells, start, width)


def _pair_ok(left: dict, right: dict) -> bool:
    return (left["s"] == right["s"]) != (left["f"] == right["f"])


def solve_spinner(puzzle: dict) -> dict:
    inner, outer, count = puzzle["inner"], puzzle["outer"], puzzle["n"]
    for rotation in range(count):
        if all(_pair_ok(outer[i], inner[(i - rotation) % count]) for i in range(count)):
            return {"rotation": rotation}
    raise ValueError("No spinner rotation")


def _column(puzzle: dict, header: str) -> int:
    try:
        return puzzle["headers"].index(header)
    except ValueError as exc:
        raise ValueError(f"Missing column {header}") from exc


def _row(puzzle: dict, name: str) -> list[int]:
    for row in puzzle["rows"]:
        if row["name"] == name:
            return row["values"]
    raise ValueError(f"Missing row {name}")


def solve_insights(puzzle: dict) -> dict:
    import re

    prompt = puzzle["prompt"]
    percent = re.match(r"^(.+) then rises by (\d+)%, and (\d+) further .+ are added\. What is the new \1 figure\?$", prompt)
    gap = re.match(r"^In (.+), how many percentage points higher is (.+)'s share of that column than (.+)'s share\?$", prompt)
    combined = re.match(r"^In (.+), what percent of all .+ in the table came from (.+) and (.+) combined\?$", prompt)
    change = re.match(r"^By what percent did (.+) change from (.+) to (.+?)\?", prompt)
    share = re.match(r"^What percent of (.+)'s (.+) fell in (.+)\?$", prompt)
    average = re.match(r"^What was the average number of (.+) per period for (.+)\?$", prompt)
    diff = re.match(r"^How many more (.+) did (.+) record in (.+) than in (.+)\?$", prompt)
    read = re.match(r"^How many (.+) did (.+) record in (.+)\?$", prompt)
    if puzzle["kind"] == "passage":
        found = re.search(r"handles (\d+) .+ an hour\. One shift lasts (\d+) hours, and (\d+)% of the shift", puzzle["passage"])
        if not found:
            raise ValueError("Passage figures not found")
        rate, hours, loss = (int(part) for part in found.groups())
        value = rate * hours * (100 - loss) // 100
    elif percent:
        base = _row(puzzle, puzzle["rows"][0]["name"])[_column(puzzle, percent.group(1))]
        rise, extra = int(percent.group(2)), int(percent.group(3))
        value = base * (100 + rise) // 100 + extra
    elif gap:
        index = _column(puzzle, gap.group(1))
        high, low = _row(puzzle, gap.group(2))[index], _row(puzzle, gap.group(3))[index]
        total = sum(row["values"][index] for row in puzzle["rows"])
        value = (high - low) * 100 // total
    elif combined:
        index = _column(puzzle, combined.group(1))
        part = _row(puzzle, combined.group(2))[index] + _row(puzzle, combined.group(3))[index]
        total = sum(sum(row["values"]) for row in puzzle["rows"])
        value = part * 100 // total
    elif change:
        row = _row(puzzle, change.group(1))
        before, after = row[_column(puzzle, change.group(2))], row[_column(puzzle, change.group(3))]
        value = (after - before) * 100 // before
    elif share:
        row = _row(puzzle, share.group(1))
        part, total = row[_column(puzzle, share.group(3))], sum(row)
        value = part * 100 // total
    elif average:
        row = _row(puzzle, average.group(2))
        value = sum(row) // len(row)
    elif diff:
        row = _row(puzzle, diff.group(2))
        value = row[_column(puzzle, diff.group(3))] - row[_column(puzzle, diff.group(4))]
    elif read:
        value = _row(puzzle, read.group(2))[_column(puzzle, read.group(3))]
    else:
        raise ValueError("Unrecognised insights question")
    if value not in puzzle["options"]:
        raise ValueError("Solved value is not an option")
    return {"index": puzzle["options"].index(value), "value": value}


SOLVERS = {
    "net": solve_net,
    "racer": solve_racer,
    "swipe": solve_swipe,
    "wordlogic": solve_wordlogic,
    "pipes": solve_pipes,
    "spinner": solve_spinner,
    "insights": solve_insights,
}


def solve(record: dict) -> dict:
    puzzle = record["puzzle"] if "puzzle" in record else record
    game = record.get("game") or puzzle.get("game")
    if game not in SOLVERS:
        raise KeyError(f"Unknown game {game}")
    return SOLVERS[game](puzzle)
