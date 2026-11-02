# Practice solver

Standalone Python package for puzzles produced by this repo's generators. It reads JSONL on disk. It does not open a browser, scrape a site, or play a live assessment.

Numeric and word puzzles use exact algorithms. Shape Spinner and Pipe Puzzle also have small PyTorch models, checked against the same exact solvers.

## Install

From the repository root:

```bash
pip install -e "./solver[dev]"
```

`uv pip install -e "./solver[dev]"` works the same way. Python 3.11 or newer.

## Export puzzles

```bash
node solver/scripts/export_puzzles.cjs --count 40 --seed 1000 \
  --out solver/fixtures/eval.jsonl \
  --lexicon solver/src/practice_solver/data/lexicon.json
```

Or, after install:

```bash
practice-solver export --count 40 --seed 1000 --out solver/fixtures/eval.jsonl \
  --lexicon solver/src/practice_solver/data/lexicon.json
```

Each line is `{"game","level","puzzle","truth"}`. `puzzle` is the generated board or question. `truth` is the generator's answer, used only as a label. `solve` does not read it.

## Solve one record

```bash
practice-solver solve record.json
practice-solver solve record.json --method ml
```

`--method ml` applies to Shape Spinner and Pipe Puzzle. Other games always use the exact solver.

## Train

```bash
node solver/scripts/export_puzzles.cjs --count 2500 --seed 7 --out /tmp/practice-train.jsonl
practice-solver train --data /tmp/practice-train.jsonl --epochs 40 \
  --out-dir solver/src/practice_solver/weights
practice-solver eval --data solver/fixtures/eval.jsonl
```

Saved weights are the CPU state dicts `spinner.pt` and `pipes.pt`.

## Tests

```bash
python -m pytest solver/tests
```

## Methods

| Game | Solver |
|---|---|
| Net the Numbers | Sum every legal placement. |
| Number Racer | Shortest subset that matches the target. |
| Numerical Insights | Read the named cells and evaluate that expression. |
| Link Swipe | Opposite list, then synonym groups, otherwise Other. The lists are this repo's practice lexicon. |
| Word Logic | Same analogy, same direction, from that lexicon. |
| Shape Spinner | Exact: test every rotation. Learned: a pair scorer rates each rotation. The network is trained on generator puzzles; the label is the exact rotation. |
| Pipe Puzzle | Exact: follow the start opening and search the pipe inventory. Learned: a 3-layer conv net predicts the mask on each blue cell. Labels are one exact route from the generator. |

## Measured accuracy

Exact solvers were right on every puzzle in a 200-item holdout (`--seed 4242 --count 200`): 200/200 for all seven games.

On that same holdout the networks, trained on 2,000 generator puzzles per game (`--seed 7`, 60 epochs), scored:

| Model | Accuracy | Batched inference | Exact solver |
|---|---|---|---|
| Shape Spinner | 199/200 rotations (99.5%) | 0.007 ms | 0.003 ms, 200/200 |
| Pipe Puzzle | 89.3% of blue cells, 58.5% full boards, 59.0% connected routes | 0.047 ms | 0.033 ms, 200/200 |

The committed fixture (`--seed 1000 --count 40`) is what the tests lock: spinner 39/40, pipe cells 366/416, pipe routes 25/40. `fixtures/metrics.json` stores that run. Exact search remains faster and, for pipes, more accurate. The network is a second opinion trained only on our own puzzles.
