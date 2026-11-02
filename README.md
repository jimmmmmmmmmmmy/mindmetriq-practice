# MindmetriQ practice

Unofficial personal practice for a Test Partnership battery: Insights Numerical, then the six MindmetriQ games. Open [the practice hub](https://jimmmmmmmmmmmy.github.io/mindmetriq-practice/index.html), or open `index.html` locally. No build, server, account, or install is required. Scores stay in this browser. The same files are what GitHub Pages serves; there is no separate deploy step.

On a phone, open that hub URL in the browser. The games use a narrow column. The full mock lists every section and can be resumed from `mock.html`.

These puzzles are generated in the browser. They are not the publisher's items, and the scores are not official percentiles.

## Run the tests

```bash
npm test
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install --with-deps chromium
npm run test:browser
```

## Full mock

`mock.html` runs one sitting of about 45 minutes: Numerical Insights (15 questions, 15:00), then the six games at this app's timed-test lengths. Published section times below include instructions, so the answer clocks are shorter than the advertised minutes. Together they are the public 15 + about 30 minutes.

| Section | Questions | Published length | This app |
|---|---:|---:|---|
| Numerical Insights | 15 | 15 min | 15:00 for the section. Practice is 4 questions, 75 s each. |
| Net the Numbers | 12 | 4 min | 20 s per question |
| Number Racer | 12 | 6 min | 5 s planning, then 8 numbers at 1.625 s |
| Link Swipe | 15 | 6 min | 6 s per pair |
| Word Logic | 15 | 6 min | 15 s per question, three +10 s boosts |
| Pipe Puzzle | 10 | 4 min | 20 s per puzzle |
| Shape Spinner | 10 | 4 min | 12 s per wheel |

Each game also has a short practice round and a hard drill with 25% less time. A correct answer raises the next requested level and a miss lowers it, within levels 1–5. The result screen shows accuracy, response time, and difficulty. History is kept in `localStorage`. Best badges count standalone timed runs and full-mock sections, not practice or hard drill.

## Sources

- [MindmetriQ game tasks and current question counts](https://www.testpartnership.com/gamified-assessment.html)
- [Insights Numerical: 15 questions, 15 minutes, charts and tables, adaptive scoring](https://www.testpartnership.com/numerical.html)
- [Insights technical manual: graph, table, or passage; GCSE arithmetic; calculator allowed](https://www.testpartnership.com/samplereports/psychometric-properties.pdf)
- [MindmetriQ technical manual: about 30 minutes for all six games, Rasch scoring](https://www.testpartnership.com/fact-sheets/MindmetriQ-Technical-Manual.pdf)
- [Six-question numerical preview](https://www.testpartnership.com/free/numerical/1/). The preview is not reused here.

## What the public pages do not specify

The live Insights screen was not available, so this app does not copy its option count or whether several questions share one chart. Each generated question has its own exhibit and five choices. A different product, Smart Numerical, does say three questions share an exhibit; that layout is not described for Insights.

Per-question seconds inside the real games are not published. This app keeps the timers it already used. Word Logic is 15 questions on the current overview and 12 in the older technical manual; the app follows the overview.

Aurora's careers pages describe quantitative assessments and link practice on the SHL site. They do not name Test Partnership. This hub follows the Insights-plus-six-games battery described for the sitting, not those SHL pages.
