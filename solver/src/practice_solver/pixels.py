"""Read the net's cells from the rendered canvas.

The accessibility overlay names the net's box and nothing else, and the box is
not the shape: the publisher's own figure shows a four-cell Z inside a 3 by 2
box. The rendered canvas does carry the shape, because the net is drawn as one
closed outline filled a shade darker than an empty cell. This module turns a
screenshot into cells:

* every pixel darker than a threshold is a wall (the outline, and any dark tile
  enclosed by it);
* the outline is closed, so a flood fill from the corner cannot enter the net;
* a cell is covered when most of its interior is unreachable from outside.

That also recovers cells covered by a number, whose tile keeps its colour and
whose fill therefore says nothing about the net.

Coordinates are CSS pixels; the screenshot supplies the scale.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from practice_solver.errors import SnapshotError
from practice_solver.layout import NET_LAYOUT

WALL_LEVEL = 150
# The net is filled a shade darker than either an empty cell or the gap between
# cells: measured 216,218,220 against 242,242,242 and 249,249,249 on the
# publisher's own screenshot. Numbers keep their tile colour under the net, so
# the fill alone is not enough; the closed outline around the union is what
# catches those cells, and the flood fill uses both.
NET_FILL_RANGE = (200, 236)
NET_FILL_SPREAD = 8
COVERED_FRACTION = 0.35
INSET = 0.2


def _open(png: bytes | Path | str | Image.Image) -> Image.Image:
    if isinstance(png, Image.Image):
        return png.convert("RGB")
    if isinstance(png, bytes):
        from io import BytesIO

        image = Image.open(BytesIO(png))
    else:
        image = Image.open(png)
    return image.convert("RGB")


def _walls(image: np.ndarray) -> np.ndarray:
    """The outline, dark tiles, and the net's own fill: none of these are 'outside'."""
    highest = image.max(axis=2)
    lowest = image.min(axis=2)
    dark = highest < WALL_LEVEL
    flat = (highest - lowest) <= NET_FILL_SPREAD
    fill = flat & (highest >= NET_FILL_RANGE[0]) & (highest <= NET_FILL_RANGE[1])
    return dark | fill


def _outside(walls: np.ndarray) -> np.ndarray:
    """Pixels reachable from the crop's border without crossing a wall."""
    height, width = walls.shape
    mask = Image.fromarray(np.where(walls, 255, 0).astype(np.uint8), mode="L").copy()
    seed = None
    for y in range(height):
        for x in (0, width - 1):
            if not walls[y, x]:
                seed = (x, y)
                break
        if seed:
            break
    if seed is None:
        for x in range(width):
            for y in (0, height - 1):
                if not walls[y, x]:
                    seed = (x, y)
                    break
            if seed:
                break
    if seed is None:
        raise SnapshotError("The net box is entirely dark; check the screenshot scale")
    ImageDraw.floodfill(mask, seed, 128)
    return np.array(mask) == 128


def net_shape(
    png: bytes | Path | str | Image.Image,
    box: tuple[float, float, float, float],
    canvas: tuple[float, float],
    layout: dict | None = None,
    fraction: float = COVERED_FRACTION,
) -> dict:
    """Cells of the net from a screenshot.

    `box` is the overlay's (left, top, width, height) in CSS pixels and
    `canvas` the rendered canvas size, also in CSS pixels.
    """
    layout = layout or NET_LAYOUT
    image = _open(png)
    pixels = np.asarray(image)
    if not canvas[0]:
        raise SnapshotError("Canvas has no width to scale against")
    scale = image.width / canvas[0]
    pitch = layout["pitch"] * scale
    left = (box[0] + layout["pad"]) * scale
    top = (box[1] + layout["pad"]) * scale
    columns = int(round(box[2] / layout["pitch"]))
    rows = int(round(box[3] / layout["pitch"]))
    if columns < 1 or rows < 1:
        raise SnapshotError(f"Net box is {box[2]} by {box[3]} CSS px, which is not a whole number of cells")
    # The net's outline can sit right on the box edge, so crop with a margin and
    # pad one ring of "not wall" around the crop: the flood fill then always has
    # an outside to come from, even when the box touches the canvas edge.
    margin = max(3.0, pitch * 0.3)
    pad = 2
    x0 = max(0, int(left - margin))
    y0 = max(0, int(top - margin))
    x1 = min(image.width, int(left + columns * pitch + margin))
    y1 = min(image.height, int(top + rows * pitch + margin))
    crop = pixels[y0:y1, x0:x1]
    if crop.size == 0:
        raise SnapshotError("Net box falls outside the screenshot; is it the canvas or the whole page?")
    walls = np.pad(_walls(crop), pad, constant_values=False)
    reachable = _outside(walls)
    # A covered cell is one the outside cannot reach: either its fill blocks the
    # flood, or the closed outline around the union does.
    inside = ~reachable
    cells: list[list[int]] = []
    for row in range(rows):
        for column in range(columns):
            yi = (top - y0 + pad + row * pitch, top - y0 + pad + (row + 1) * pitch)
            xi = (left - x0 + pad + column * pitch, left - x0 + pad + (column + 1) * pitch)
            ys = slice(int(yi[0] + pitch * INSET), int(yi[1] - pitch * INSET))
            xs = slice(int(xi[0] + pitch * INSET), int(xi[1] - pitch * INSET))
            window = inside[ys, xs]
            if window.size and window.mean() >= fraction:
                cells.append([column, row])
    if not cells:
        raise SnapshotError("No covered cells found inside the net's box; check the screenshot scale")
    _require_connected(cells)
    return {"cells": cells, "w": columns, "h": rows}


def _require_connected(cells: list[list[int]]) -> None:
    """A net is one piece; a split result means the crop or scale is wrong."""
    remaining = {tuple(cell) for cell in cells}
    stack = [remaining.pop()]
    while stack:
        x, y = stack.pop()
        for neighbour in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if neighbour in remaining:
                remaining.discard(neighbour)
                stack.append(neighbour)
    if remaining:
        raise SnapshotError(f"Net cells came out in {len(remaining) + 1} pieces; check the screenshot scale")
