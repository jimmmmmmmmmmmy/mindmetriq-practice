# MindmetriQ practice games

Open [the practice hub](https://jimmmmmmmmmmmy.github.io/mindmetriq-practice/index.html), or open `index.html` locally. No build, server, account, or runtime dependencies are required. Scores stay in this browser.

These are unofficial personal-practice remakes, unaffiliated with Test Partnership. The six tasks and full-test item counts match its [current overview](https://www.testpartnership.com/gamified-assessment.html). Practice timers, generated content, difficulty levels, and scores are this app's own; they do not reproduce the proprietary item bank, calibrated adaptive algorithm, or norm scores.

| Game | Timed-test items | Practice-app timing | Rule |
|---|---:|---|---|
| Net the Numbers | 12 | 20 s per question | Move a fixed net to the highest sum, including negative totals. |
| Number Racer | 12 | 5 s planning, then 9.25–10.2 s falling | Catch a subset that adds to the exact target; avoid the rest. |
| Link Swipe | 15 | 6 s per pair | Same meaning, opposite meaning, or another relationship. |
| Word Logic | 15 | 15 s per question; three +10 s boosts per run | Complete an analogy using the same relationship. |
| Pipe Puzzle | 10 | 20 s per puzzle | Swap movable tiles to connect the fixed ends; no rotation. |
| Shape Spinner | 10 | 12 s per wheel | Every pair must share shape XOR shading. |

Every game also has a three-item practice run with feedback and a hard drill with 25% less time. Racer hard drill reduces both planning and falling time. Correct answers raise the next requested level; wrong answers lower it, within levels 1–5. The result table records the actual selected difficulty. Best timed-test scores exclude practice and hard drill.

## How rounds work

`js/game-logic.js` generates numerical and spatial puzzles at runtime. Net placements and spinner rotations are exhaustively checked for a unique best answer. Racer targets require collecting at least two numbers; catching everything cannot solve a round. Multiple valid subsets are accepted. Pipe puzzles start as a valid route and are scrambled through reversible swaps, preserving the required pipe inventory and fixed tiles. Random search is bounded so generation cannot loop forever.

`js/verbal-data.js` contains curated word relationships. `js/verbal-logic.js` composes analogies by combining two examples of the same relationship, then draws distinct distractors and shuffles the options. Link Swipe draws balanced categories and randomly orders each pair. A run never repeats an unordered word pair or the same two analogy examples. Word relationships are curated rather than inferred from random words; difficulty is approximate, not psychometrically calibrated.

`js/harness.js` owns the run, deadline, score, and transition to the next item. Inputs check the deadline before changing the puzzle, and each item can score only once. Net and spinner submit the current position at timeout; racer checks the caught sum; unanswered verbal and pipe items fail. Dropped frames do not extend racer time or award catches for long unseen intervals. `js/storage.js` validates saved records and tolerates blocked, full, or corrupt storage.

## Logic audit fixes

1. Centralized the six duplicated timer/scoring controllers and blocked late answers, duplicate submissions, and swaps during feedback.
2. Made spinner submission and timeout snap and score the visible dragged angle. Cancelled swipes no longer submit, and fresh items reset drag state.
3. Made racer timing follow elapsed time, fixed collision stepping, pre-generated falling positions, reset held controls on blur, and applied hard timing to planning too.
4. Replaced ambiguous verbal banks, fixed keyboard selection and boost deadlines, bounded generator searches, and repaired pipe-path backtracking.
5. Validated history before rendering it, separated best timed-test scores from hard drills, and limited solver helpers to the explicit `?debug=1` development URL.

## Run checks

Node 22 or newer, with no npm install required:

```sh
npm test
```

Browser regressions use Python 3.10+ and Chromium:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python -m unittest discover -s tests -p 'test_browser.py' -v
```

The Node suite independently checks 20,000 generated numerical/spatial puzzles and 15,000 verbal questions across all five levels, plus collisions, alternative racer solutions, malformed pipes, and history recovery. Browser tests cover complete runs, replay, deadlines without animation frames, boosts, input locking, visible spinner positions, touch/keyboard controls, and production URLs. GitHub Actions runs both suites on pull requests and changes to `main`.

For development, append `?debug=1` to a game URL to expose its state and solver helpers. This is a local practice app: browser code and local scores are inspectable and editable, so it should not be used for verified competitive rankings or hiring decisions.
