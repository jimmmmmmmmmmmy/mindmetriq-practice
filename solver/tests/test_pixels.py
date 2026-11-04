import io

import numpy as np
import pytest
from PIL import Image, ImageDraw

from practice_solver.errors import SnapshotError
from practice_solver.pixels import net_shape

# A layout with no artwork padding, so the fixture geometry is exact and the
# only thing under test is the wall-and-flood-fill reading of the canvas.
LAYOUT = {"left": 40.0, "top": 40.0, "pitch": 70.0, "size": 58.0, "pad": 0.0, "n": 5}
CANVAS = (40.0 + 5 * 70.0, 40.0 + 5 * 70.0)
BACKGROUND = (249, 249, 249)
EMPTY = (242, 242, 242)
NET_FILL = (216, 218, 220)
OUTLINE = (72, 72, 72)
TEAL = (76, 213, 176)
NAVY = (27, 28, 64)
EDGE = 3


def draw(cells, tiles=None, *, scale=1.0, net=True):
    """One screenshot-like canvas: a 5 by 5 lattice with a net over `cells`."""
    tiles = tiles or {}
    size = (int(CANVAS[0] * scale), int(CANVAS[1] * scale))
    image = Image.new("RGB", size, BACKGROUND)
    pen = ImageDraw.Draw(image)
    pitch, cell = LAYOUT["pitch"] * scale, LAYOUT["size"] * scale
    left, top = LAYOUT["left"] * scale, LAYOUT["top"] * scale

    def box(column, row, inset=0.0):
        x = left + column * pitch + (pitch - cell) / 2 + inset
        y = top + row * pitch + (pitch - cell) / 2 + inset
        return [x, y, x + cell - 2 * inset, y + cell - 2 * inset]

    for row in range(5):
        for column in range(5):
            pen.rectangle(box(column, row), fill=EMPTY)
    if net and cells:
        for column, row in cells:
            pen.rectangle(box(column, row), fill=NET_FILL)
    for (column, row), value in tiles.items():
        pen.rectangle(box(column, row), fill=TEAL if value > 0 else NAVY)
    if net and cells:
        for column, row in cells:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (column + dx, row + dy) in cells:
                    continue
                x = left + (column + (1 if dx == 1 else 0)) * pitch
                y = top + (row + (1 if dy == 1 else 0)) * pitch
                if dx:
                    pen.rectangle([x - EDGE / 2, y, x + EDGE / 2, y + pitch], fill=OUTLINE)
                else:
                    pen.rectangle([x, y - EDGE / 2, x + pitch, y + EDGE / 2], fill=OUTLINE)
    return image


def box_for(cells):
    return (
        LAYOUT["left"],
        LAYOUT["top"],
        (max(x for x, _ in cells) + 1) * LAYOUT["pitch"],
        (max(y for _, y in cells) + 1) * LAYOUT["pitch"],
    )


def read(cells, tiles=None, scale=1.0):
    return net_shape(draw(cells, tiles, scale=scale), box_for(cells), CANVAS, LAYOUT)


def test_z_tetromino_is_read_from_the_canvas():
    cells = [[0, 0], [1, 0], [1, 1], [2, 1]]
    assert read(cells)["cells"] == cells


def test_a_cell_under_a_number_is_still_covered():
    # The teal tile keeps its colour, so only the closed outline can say it is inside.
    cells = [[0, 0], [1, 0], [1, 1], [2, 1]]
    assert read(cells, {(0, 0): 6})["cells"] == cells


def test_a_rectangle_is_recovered_as_four_cells():
    cells = [[0, 0], [1, 0], [0, 1], [1, 1]]
    assert read(cells) == {"cells": cells, "w": 2, "h": 2}


def test_screenshot_scale_does_not_change_the_answer():
    cells = [[0, 1], [0, 2], [1, 2], [2, 2]]
    for scale in (1.0, 2.0, 3.0):
        assert read(cells, {(0, 1): 9}, scale=scale)["cells"] == cells


def test_uncovered_cells_inside_the_box_are_left_out():
    cells = [[0, 0], [2, 2]]
    with pytest.raises(SnapshotError, match="pieces"):
        read(cells)


def test_no_net_in_the_screenshot_is_an_error():
    image = draw([[0, 0]], net=False)
    with pytest.raises(SnapshotError, match="No covered cells"):
        net_shape(image, box_for([[0, 0]]), CANVAS, LAYOUT)


def test_navy_tile_outside_the_net_does_not_become_a_cell():
    cells = [[0, 0], [1, 0], [1, 1]]
    assert read(cells, {(2, 2): -9})["cells"] == cells


def test_png_bytes_work_as_well_as_a_path():
    cells = [[0, 0], [1, 0], [1, 1], [2, 1]]
    buffer = io.BytesIO()
    draw(cells).save(buffer, format="PNG")
    assert net_shape(buffer.getvalue(), box_for(cells), CANVAS, LAYOUT)["cells"] == cells
