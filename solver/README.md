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

## Ingest a captured game page

The product pages paint a canvas, so their only machine-readable state is the accessibility overlay: one `div.mindmetriq-accessibility` per object, carrying an `aria-label` and a pixel position. Save the page while a question is on screen (**Save page as, Webpage, Complete**, or copy the element's outer HTML), then convert it:

```bash
practice-solver ingest snapshots/*.html --out records/racer.jsonl --level 1
```

The output is the same record shape as `export`, so `solve`, `eval`, and `train` consume it unchanged. Differences from generated data:

| Field | Value |
|---|---|
| `distribution` | `mindmetriq-dom`, so captured and generated puzzles can be split |
| `truth.derived` | `exact` — a live page has no answer key, so the label is the exact solver's own answer |
| `source` | snapshot file name and the question counter the page showed |
| `level` | whatever `--level` was passed; the page does not expose the adaptive level |

Board properties the generator guarantees are checked, not assumed: warnings go to stderr (`N blocks`, `target equals a single block`, `catching every block reaches the target`) and the record is still written. A snapshot with no solution — saved mid-animation, wrong frame — is refused rather than written; `--skip-invalid` keeps the rest of a batch.

Adapters live in `practice_solver/ingest.py` (`ADAPTERS`). A page with labels no adapter knows is rejected with the label list printed, which is what a new adapter needs.

| Game | Markers read | Anything the overlay does not carry |
|---|---|---|
| Number Racer | `Collectable n` blocks ordered by vertical position, one `Target n` | nothing; the blocks and the target are the whole item |
| Net the Numbers | numbered cells placed on the 5 by 5 lattice (blank cells are simply absent), plus the `Glowing net` box | the net's interior cells. The box gives its width and height only, so the shape defaults to that full rectangle and every record carries a warning saying so. Pass `--net-shape 111/010/111` when the net is a polyomino; rows are read top to bottom, `1` is a covered cell. |

The grid, cell size, and pitch are constants read off the product's canvas (`NET_LAYOUT`). Every marker is checked against that lattice, so a renderer change fails loudly instead of quietly shifting numbers to the wrong cell. The question counter is taken from the marker sitting immediately left of `of N`, which keeps bare numbers like a countdown timer out of the grid.

No capture step is automated here: the package still opens no browser and touches no network. Snapshots are local files.

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

The pure network does not reach 95%. Beam width 4 does, on every level of that tuning holdout. The same beam with flat scores does not. `pipes.pt` is about 630 KB. A beam of 32 can solve these small boards with no model at all; beam 1 cannot.

## Untouched seeds

Seed 4242 was used while choosing the beam width, so it is not a clean test. `python -m practice_solver.fresh_eval` rebuilds five new seeds from `fixtures/fresh_seeds.json` (88001, 88011, 88021, 88031, 88041), drops any board whose hash matches training or that tuning set, and does not train. Each seed keeps 40 new boards per level (1,000 boards). Brackets are 95% t intervals across the five seed rates. The minimum is the worst seed.

| Method | L1 | L2 | L3 | L4 | L5 | All |
|---|---|---|---|---|---|---|
| Exact search | 100% | 100% | 100% | 100% | 100% | 100% (1000/1000) |
| Pure network | 100% | 100% | 72.5% [64.6, 80.4] min 65% | 37.0% [26.8, 47.2] min 27.5% | 27.0% [19.0, 35.0] min 20% | 67.3% [64.6, 70.0] min 64% |
| Beam 4 | 100% | 100% | 100% | 98.5% [96.8, 100] min 97.5% | 98.5% [95.7, 100] min 95% | 99.4% [98.6, 100] min 98.5% (994/1000) |
| Best-first | 100% | 100% | 100% | 100% | 100% | 100% (1000/1000) |
| Flat beam 4 | 96.0% [94.3, 97.7] min 95% | 95.0% [89.2, 100] min 87.5% | 84.5% [81.9, 87.1] min 82.5% | 77.0% [72.4, 81.6] min 72.5% | 64.0% [56.9, 71.1] min 55% | 83.3% [81.5, 85.1] min 81.5% |
| Flat beam 1 | 12.5% [8.1, 16.9] min 7.5% | 5% | 1.0% min 0% | 1.5% min 0% | 1.0% min 0% | 4.2% [2.8, 5.6] min 2.5% |

Shape Spinner on the same seeds: network 99.6% [99.3, 99.9], minimum seed 99.5%. Exact 100%.

The practice generator cannot emit level 6 or a board larger than 6 by 6. The stress set is a separate 7 by 7 exporter (longer route, 6–12 spare pipes, 18 swaps), five seeds, 40 boards each, 200 boards total. Exact search and best-first still solve 200/200. Beam 4 falls to 79.0% [74.3, 83.7], minimum seed 75%. The pure network solves 0/200. Flat beam 4 solves 35.5%. Those 7 by 7 boards were not used to train or to pick the beam.
