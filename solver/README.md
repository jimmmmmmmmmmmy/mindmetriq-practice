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

`--method ml` applies to Shape Spinner and Pipe Puzzle. For pipes it runs the network-guided search, not an unconstrained argmax. Other games always use the exact solver.

## Train

```bash
node solver/scripts/export_puzzles.cjs --count 20000 --seed 11 --games pipes --out /tmp/pipes-train.jsonl
practice-solver train --data /tmp/pipes-train.jsonl --epochs 25 --games pipes \
  --out-dir solver/src/practice_solver/weights
practice-solver eval --data solver/fixtures/holdout.jsonl
```

Saved weights are the CPU state dicts `spinner.pt` and `pipes.pt`. Pipe training uses `--games pipes` so the spinner weights stay as they are.

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
| Pipe Puzzle | Exact: follow the start opening and search the pipe inventory. Learned: a conv net with dilation and a board-wide summary scores each blue cell. Beam search then keeps only connected routes that use the real inventory. Labels are one exact route from the generator. |

## Measured accuracy

Exact solvers were right on every puzzle in `fixtures/holdout.jsonl` (`--seed 4242 --count 200`): 200/200 for all seven games. Pipe exact search takes 0.034 ms per board.

Shape Spinner, trained earlier on 2,000 puzzles, scores 199/200 (99.5%).

Pipe Puzzle was retrained on 20,000 boards (`--seed 11 --games pipes`, 25 epochs). The holdout has 40 boards at each level.

| Method | Full boards solved | Time |
|---|---|---|
| Pure network, argmax, no search | 141/200 (70.5%). Levels: 40/40, 40/40, 25/40, 23/40, 13/40 | 0.08 ms forward |
| Beam 4 using the network scores | 200/200, 40/40 at every level | 0.06 ms search |
| Best-first search on the same scores | 200/200, 2,191 expansions | 0.04 ms |
| Exact distance search, no network | 200/200 | 0.034 ms |
| Beam 4 with flat scores, no network | 173/200 (86.5%) | |
| Greedy beam 1 with flat scores | 6/200 | |

The pure network does not reach 95%. Beam width 4 does, on every level. The same beam with flat scores does not, so the network is what makes the narrow search succeed. `pipes.pt` is about 630 KB. A beam of 32 can solve these small boards with no model at all; beam 1 cannot.
