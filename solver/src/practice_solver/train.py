"""Train the spinner and pipe networks on exported JSONL."""

from __future__ import annotations

from pathlib import Path

import torch
from torch import nn

from practice_solver.io import load_jsonl
from practice_solver.models import PipeNet, SpinnerNet, pipe_tensors, save_model, spinner_tensors


def _train_spinner(records: list[dict], epochs: int) -> SpinnerNet:
    outer, inner, count, labels = spinner_tensors(records)
    model = SpinnerNet()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss()
    model.train()
    for _ in range(epochs):
        order = torch.randperm(len(records))
        for start in range(0, len(records), 128):
            batch = order[start:start + 128]
            optimizer.zero_grad()
            logits = model(outer[batch], inner[batch], count[batch])
            loss = loss_fn(logits, labels[batch])
            loss.backward()
            optimizer.step()
    model.eval()
    return model


def _inventory_loss(logits: torch.Tensor, targets: torch.Tensor, pipes: torch.Tensor) -> torch.Tensor:
    """Predicted mask counts should match the board's pipe inventory."""
    probabilities = torch.softmax(logits, dim=1)
    predicted = (probabilities * pipes.unsqueeze(1)).sum(dim=(2, 3))
    true = torch.zeros_like(predicted)
    for mask in range(logits.shape[1]):
        true[:, mask] = ((targets == mask) & pipes).sum(dim=(1, 2))
    return ((predicted - true) ** 2).mean()


def _train_pipes(records: list[dict], epochs: int) -> PipeNet:
    grids, targets, pipes = pipe_tensors(records)
    model = PipeNet()
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.CrossEntropyLoss(reduction="none")
    model.train()
    for _ in range(epochs):
        order = torch.randperm(len(records))
        for start in range(0, len(records), 64):
            batch = order[start:start + 64]
            optimizer.zero_grad()
            logits = model(grids[batch])
            mask = pipes[batch]
            classified = loss_fn(logits, targets[batch])
            classified = (classified * mask).sum() / mask.sum().clamp(min=1)
            loss = classified + 0.05 * _inventory_loss(logits, targets[batch], mask)
            loss.backward()
            optimizer.step()
    model.eval()
    return model


def train(data: Path, out_dir: Path, epochs: int = 30, games: tuple[str, ...] = ("spinner", "pipes")) -> None:
    rows = load_jsonl(data)
    spinner = [row for row in rows if row["game"] == "spinner"]
    pipes = [row for row in rows if row["game"] == "pipes"]
    if "spinner" in games:
        if not spinner:
            raise ValueError("Training data has no spinner rows")
        save_model(_train_spinner(spinner, epochs), out_dir / "spinner.pt")
    if "pipes" in games:
        if not pipes:
            raise ValueError("Training data has no pipes rows")
        save_model(_train_pipes(pipes, epochs), out_dir / "pipes.pt")
