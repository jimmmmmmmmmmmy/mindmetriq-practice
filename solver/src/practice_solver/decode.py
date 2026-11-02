"""Turn pipe-mask probabilities into a connected board.

The network scores tiles. This search is the only thing that spends the pipe
inventory and keeps the route connected. It does not call the distance-ordered
exact solver.
"""

from __future__ import annotations

import heapq

DIRS = {1: (0, -1, 4), 2: (1, 0, 8), 4: (0, 1, 1), 8: (-1, 0, 2)}


def _inventory(cells: list[dict]) -> dict[int, int]:
    counts: dict[int, int] = {}
    for cell in cells:
        if cell["t"] == "p":
            counts[cell["m"]] = counts.get(cell["m"], 0) + 1
    return counts


def _place(puzzle: dict, assignment: dict[int, int], remaining: dict[int, int]) -> list[dict]:
    bag = [mask for mask, count in remaining.items() for _ in range(count)]
    solved = []
    for index, cell in enumerate(puzzle["cells"]):
        if cell["t"] != "p":
            solved.append({"t": cell["t"], "m": cell["m"]})
        elif index in assignment:
            solved.append({"t": "p", "m": assignment[index]})
        else:
            solved.append({"t": "p", "m": bag.pop()})
    return solved


def _start_bit(cells: list[dict], start: int) -> int | None:
    bits = [bit for bit in (1, 2, 4, 8) if cells[start]["m"] & bit]
    return bits[0] if len(bits) == 1 else None


def beam_decode(puzzle: dict, log_probs: list[list[float]], beam: int = 32) -> list[dict] | None:
    """Keep the highest-scoring partial routes. Log-probabilities must be <= 0."""
    width, cells = puzzle["N"], puzzle["cells"]
    end = puzzle["t"]
    out_bit = _start_bit(cells, puzzle["s"])
    if out_bit is None:
        return None
    states = [(0.0, puzzle["s"], out_bit, (puzzle["s"],), tuple(sorted(_inventory(cells).items())), ())]
    best: tuple[float, tuple, tuple] | None = None
    for _depth in range(width * width):
        expanded = []
        for score, index, outgoing, path, counts_t, assignment in states:
            step = DIRS.get(outgoing)
            if step is None:
                continue
            dx, dy, entry = step
            x, y = index % width + dx, index // width + dy
            if not (0 <= x < width and 0 <= y < width):
                continue
            nxt = y * width + x
            if nxt in path:
                continue
            tile = cells[nxt]
            if tile["t"] == "e":
                if nxt == end and tile["m"] & entry and (best is None or score > best[0]):
                    best = (score, assignment, counts_t)
                continue
            if tile["t"] != "p":
                continue
            counts = dict(counts_t)
            for mask, count in counts.items():
                exit_bit = mask & ~entry
                if count <= 0 or not (mask & entry) or exit_bit not in DIRS:
                    continue
                updated = dict(counts)
                updated[mask] -= 1
                if updated[mask] == 0:
                    del updated[mask]
                expanded.append((
                    score + float(log_probs[nxt][mask]),
                    nxt,
                    exit_bit,
                    path + (nxt,),
                    tuple(sorted(updated.items())),
                    assignment + ((nxt, mask),),
                ))
        if not expanded:
            break
        expanded.sort(key=lambda state: state[0], reverse=True)
        states = expanded[:beam]
        if best is not None and states[0][0] <= best[0]:
            break
    if best is None:
        return None
    _, assignment, counts_t = best
    return _place(puzzle, dict(assignment), dict(counts_t))


def best_first_decode(puzzle: dict, log_probs: list[list[float]], limit: int = 100000) -> tuple[list[dict] | None, int]:
    """Complete search ordered by the network. Finds a route whenever one exists."""
    width, cells = puzzle["N"], puzzle["cells"]
    end = puzzle["t"]
    out_bit = _start_bit(cells, puzzle["s"])
    if out_bit is None:
        return None, 0
    heap = [(0.0, 0, puzzle["s"], out_bit, (puzzle["s"],), tuple(sorted(_inventory(cells).items())), ())]
    expansions = 0
    while heap and expansions < limit:
        score, _, index, outgoing, path, counts_t, assignment = heapq.heappop(heap)
        score = -score
        step = DIRS.get(outgoing)
        if step is None:
            continue
        dx, dy, entry = step
        x, y = index % width + dx, index // width + dy
        if not (0 <= x < width and 0 <= y < width):
            continue
        nxt = y * width + x
        if nxt in path:
            continue
        expansions += 1
        tile = cells[nxt]
        if tile["t"] == "e":
            if nxt == end and tile["m"] & entry:
                return _place(puzzle, dict(assignment), dict(counts_t)), expansions
            continue
        if tile["t"] != "p":
            continue
        counts = dict(counts_t)
        for mask, count in counts.items():
            exit_bit = mask & ~entry
            if count <= 0 or not (mask & entry) or exit_bit not in DIRS:
                continue
            updated = dict(counts)
            updated[mask] -= 1
            if updated[mask] == 0:
                del updated[mask]
            added = score + float(log_probs[nxt][mask])
            heapq.heappush(heap, (
                -added,
                expansions,
                nxt,
                exit_bit,
                path + (nxt,),
                tuple(sorted(updated.items())),
                assignment + ((nxt, mask),),
            ))
    return None, expansions
