"""Small networks for Shape Spinner and Pipe Puzzle.

Spinner scores each rotation from the raw symbol pair at that alignment.
Pipe Puzzle predicts a pipe mask for every blue cell on the grid.
Neither network sees the answer key.
"""

from __future__ import annotations

from pathlib import Path

import torch
from torch import nn

SHAPES = ("c", "s", "t", "r")
FILLS = ("d", "w", "g")
GRID = 6


def _one_hot(symbol: dict) -> list[float]:
    shape = [1.0 if symbol["s"] == name else 0.0 for name in SHAPES]
    fill = [1.0 if symbol["f"] == name else 0.0 for name in FILLS]
    return shape + fill


def spinner_tensors(records: list[dict]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    outer, inner, counts, labels = [], [], [], []
    for record in records:
        puzzle, count = record["puzzle"], record["puzzle"]["n"]
        outer_row = [[0.0] * 7 for _ in range(8)]
        inner_row = [[0.0] * 7 for _ in range(8)]
        for index in range(count):
            outer_row[index] = _one_hot(puzzle["outer"][index])
            inner_row[index] = _one_hot(puzzle["inner"][index])
        outer.append(outer_row)
        inner.append(inner_row)
        counts.append(count)
        labels.append(record["truth"]["rotation"])
    return (
        torch.tensor(outer, dtype=torch.float32),
        torch.tensor(inner, dtype=torch.float32),
        torch.tensor(counts, dtype=torch.long),
        torch.tensor(labels, dtype=torch.long),
    )


class SpinnerNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.scorer = nn.Sequential(nn.Linear(14, 32), nn.ReLU(), nn.Linear(32, 1))

    def forward(self, outer: torch.Tensor, inner: torch.Tensor, count: torch.Tensor) -> torch.Tensor:
        batch, slots, _ = inner.shape
        slot_index = torch.arange(slots, device=inner.device).view(1, slots).expand(batch, slots)
        valid = slot_index < count.view(-1, 1)
        scores = []
        for rotation in range(slots):
            source = torch.remainder(slot_index - rotation, count.clamp(min=1).view(-1, 1))
            source = torch.where(valid, source, slot_index)
            gathered = torch.gather(inner, 1, source.unsqueeze(-1).expand(-1, -1, inner.shape[-1]))
            pair = torch.cat((outer, gathered), dim=-1)
            score = self.scorer(pair).squeeze(-1).masked_fill(~valid, 0).sum(dim=1)
            scores.append(score)
        return torch.stack(scores, dim=1)


def pipe_tensors(records: list[dict]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    inputs, targets, masks = [], [], []
    for record in records:
        puzzle, truth, width = record["puzzle"], record["truth"], record["puzzle"]["N"]
        channel_grid = [[[0.0 for _ in range(GRID)] for _ in range(GRID)] for _ in range(9)]
        target_grid = [[0 for _ in range(GRID)] for _ in range(GRID)]
        pipe_grid = [[False for _ in range(GRID)] for _ in range(GRID)]
        for index, cell in enumerate(puzzle["cells"]):
            x, y = index % width, index // width
            kind = {"p": 0, "e": 1, "x": 2}[cell["t"]]
            channel_grid[kind][y][x] = 1.0
            for bit, channel in ((1, 3), (2, 4), (4, 5), (8, 6)):
                if cell["m"] & bit:
                    channel_grid[channel][y][x] = 1.0
            if index == puzzle["s"]:
                channel_grid[7][y][x] = 1.0
            if index == puzzle["t"]:
                channel_grid[8][y][x] = 1.0
            target_grid[y][x] = truth["cells"][index]["m"]
            pipe_grid[y][x] = cell["t"] == "p"
        inputs.append(channel_grid)
        targets.append(target_grid)
        masks.append(pipe_grid)
    return (
        torch.tensor(inputs, dtype=torch.float32),
        torch.tensor(targets, dtype=torch.long),
        torch.tensor(masks, dtype=torch.bool),
    )


class PipeNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(9, 64, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(64, 16, 1),
        )

    def forward(self, grids: torch.Tensor) -> torch.Tensor:
        return self.net(grids)


def save_model(model: nn.Module, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), path)


def load_model(kind: str, path: Path) -> nn.Module:
    model = SpinnerNet() if kind == "spinner" else PipeNet()
    model.load_state_dict(torch.load(path, map_location="cpu", weights_only=True))
    model.eval()
    return model
