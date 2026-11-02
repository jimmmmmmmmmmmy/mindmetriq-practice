// Solves puzzles produced by this repo's generators. It never fetches, scrapes,
// screenshots, or drives an external assessment. Answer keys on a saved snapshot
// are removed by exportPuzzle before any search runs.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./verbal-data.js"));
  else root.MMQSolver = factory(root.MMQVerbalData);
})(typeof globalThis !== "undefined" ? globalThis : this, data => {
  const DIRS = { 1: [0, -1, 4], 2: [1, 0, 8], 4: [0, 1, 1], 8: [-1, 0, 2] };
  const WAY = { 1: "up", 2: "right", 4: "down", 8: "left" };
  const PIPE = { 5: "vertical", 10: "horizontal", 3: "north-east", 6: "south-east", 12: "south-west", 9: "north-west" };

  function lexicon() {
    const synonyms = new Map();
    const opposites = new Set();
    const groups = [];
    (data.synonyms || []).forEach(([, group]) => {
      group.forEach(word => synonyms.set(word, group));
    });
    (data.opposites || []).forEach(([, a, b]) => opposites.add([a, b].sort().join("|")));
    (data.analogies || []).forEach(([, relation, entries]) => {
      const forward = new Map(entries);
      groups.push({ relation, forward, pairs: new Set(entries.map(([a, b]) => a + "|" + b)) });
    });
    return { synonyms, opposites, groups };
  }
  const words = data ? lexicon() : null;

  function cell(index, width) {
    return `row ${Math.floor(index / width) + 1}, column ${index % width + 1}`;
  }
  function exportPuzzle(game, item) {
    if (!item || item.unanswered) return null;
    if (game === "net") return { game, g: item.g.slice(), sh: { cells: item.sh.cells.map(pair => pair.slice()), w: item.sh.w, h: item.sh.h } };
    if (game === "racer") return { game, nums: item.nums.slice(), target: item.target };
    if (game === "swipe") {
      const pair = item.words || item;
      return { game, words: [pair[0], pair[1]] };
    }
    if (game === "wordlogic") return { game, left: [item.b[1], item.b[2]], stem: item.b[3], options: item.opts.slice() };
    if (game === "pipes") return { game, N: item.N, s: item.s, t: item.t, cells: item.cells.map(entry => ({ t: entry.t, m: entry.m })) };
    if (game === "spinner") return { game, n: item.n, inner: item.inner.map(symbol => ({ ...symbol })), outer: item.outer.map(symbol => ({ ...symbol })) };
    if (game === "insights") return {
      game, kind: item.kind, title: item.title, unit: item.unit,
      headers: item.headers ? item.headers.slice() : null,
      rows: item.rows ? item.rows.map(row => ({ name: row.name, values: row.values.slice() })) : null,
      passage: item.passage || null, prompt: item.prompt, options: item.options.slice()
    };
    throw new Error("Unknown puzzle");
  }

  function solveNet(puzzle) {
    const { g, sh } = puzzle;
    const ranked = [];
    for (let y = 0; y + sh.h <= 5; y++) for (let x = 0; x + sh.w <= 5; x++) {
      const values = sh.cells.map(([dx, dy]) => g[(y + dy) * 5 + x + dx]);
      ranked.push({ x, y, sum: values.reduce((total, value) => total + value, 0), values });
    }
    ranked.sort((a, b) => b.sum - a.sum || a.y - b.y || a.x - b.x);
    const best = ranked[0];
    const negatives = best.values.filter(value => value < 0);
    return {
      method: "Score every legal placement. The net cannot rotate.",
      answer: { x: best.x, y: best.y, sum: best.sum },
      steps: [
        `There are ${ranked.length} places the net can sit on the 5 by 5 grid.`,
        `Add every covered number, including blanks as 0.${negatives.length ? ` The best cover still includes ${negatives.join(" and ")}.` : ""}`,
        `The highest total is ${best.sum} with the net's top-left on row ${best.y + 1}, column ${best.x + 1}.`,
        ranked.length > 1 ? `The next best total is ${ranked[1].sum}, so the margin is ${best.sum - ranked[1].sum}.` : "Only one placement exists."
      ]
    };
  }

  function solveRacer(puzzle) {
    const { nums, target } = puzzle;
    let best = null;
    for (let mask = 1; mask < (1 << nums.length) - 1; mask++) {
      const indices = [];
      let sum = 0;
      nums.forEach((value, index) => { if (mask & (1 << index)) { indices.push(index); sum += value; } });
      if (sum === target && (!best || indices.length < best.length)) best = indices;
    }
    if (!best) throw new Error("No racer subset");
    const shown = best.map(index => nums[index]);
    return {
      method: "Search subsets from the smallest upward and stop at the first exact total.",
      answer: { indices: best, sum: target },
      steps: [
        `${nums.length} falling numbers have ${2 ** nums.length - 2} non-empty proper subsets. A fast pass checks pairs before larger groups.`,
        `The shortest exact group is ${shown.map(value => value < 0 ? `(${value})` : value).join(" + ")} = ${target}.`,
        `Catch falling numbers ${best.map(index => index + 1).join(", ")} and leave the others.`
      ]
    };
  }

  function solveSwipe(puzzle) {
    if (!words) throw new Error("Word bank unavailable");
    const [a, b] = puzzle.words;
    const key = [a, b].sort().join("|");
    let answer = "N";
    let why = `${a} and ${b} are linked, but they are not a synonym pair or an opposite pair. Swipe Other.`;
    if (words.opposites.has(key)) {
      answer = "A";
      why = `${a} and ${b} are a stored opposite pair. Swipe left.`;
    } else if (words.synonyms.get(a) && words.synonyms.get(a) === words.synonyms.get(b)) {
      answer = "S";
      why = `${a} and ${b} belong to the same synonym group. Swipe right.`;
    }
    return {
      method: "Check the opposite list, then the synonym groups, and treat every remaining pair as Other.",
      answer,
      steps: [
        "Decide from meaning, not from topic. Related objects can still be Other.",
        why
      ]
    };
  }

  function solveWord(puzzle) {
    if (!words) throw new Error("Word bank unavailable");
    const found = words.groups.find(group => group.pairs.has(puzzle.left.join("|")));
    if (!found) throw new Error("Analogy pair is not in the practice bank");
    const answer = found.forward.get(puzzle.stem);
    if (!puzzle.options.includes(answer)) throw new Error("Analogy answer is not an option");
    return {
      method: "Name the example relation, keep its direction, then look for that pair in the choices.",
      answer,
      steps: [
        `${puzzle.left[0]} → ${puzzle.left[1]} is "${found.relation}".`,
        `Apply it in the same direction to ${puzzle.stem}. The matching pair is ${puzzle.stem} → ${answer}.`,
        `Choose ${answer}. The other four choices are from the same family but the wrong partner.`
      ]
    };
  }

  function solvePipes(puzzle) {
    const { N, cells, s, t } = puzzle;
    const counts = new Map();
    cells.forEach(entry => { if (entry.t === "p") counts.set(entry.m, (counts.get(entry.m) || 0) + 1); });
    const startBits = [1, 2, 4, 8].filter(bit => cells[s].m & bit);
    if (startBits.length !== 1) throw new Error("Pipe start is ambiguous");
    const assignment = new Map();
    const trace = [];
    function distance(index) {
      return Math.abs(index % N - t % N) + Math.abs(Math.floor(index / N) - Math.floor(t / N));
    }
    function search(index, outBit, path) {
      const [dx, dy, entryBit] = DIRS[outBit];
      const x = index % N + dx;
      const y = Math.floor(index / N) + dy;
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const next = y * N + x;
      if (path.includes(next)) return false;
      const tile = cells[next];
      if (tile.t === "e") return next === t && !!(tile.m & entryBit);
      if (tile.t !== "p") return false;
      const choices = [...counts.keys()].filter(mask => counts.get(mask) > 0 && (mask & entryBit) && DIRS[mask & ~entryBit]);
      choices.sort((a, b) => {
        const step = mask => {
          const exit = mask & ~entryBit;
          const [sx, sy] = DIRS[exit];
          const nx = x + sx, ny = y + sy;
          return nx < 0 || ny < 0 || nx >= N || ny >= N ? 99 : distance(ny * N + nx);
        };
        return step(a) - step(b);
      });
      for (const mask of choices) {
        counts.set(mask, counts.get(mask) - 1);
        assignment.set(next, mask);
        trace.push({ index: next, mask, entryBit });
        if (search(next, mask & ~entryBit, [...path, next])) return true;
        trace.pop();
        assignment.delete(next);
        counts.set(mask, counts.get(mask) + 1);
      }
      return false;
    }
    if (!search(s, startBits[0], [s])) throw new Error("No pipe route");
    const solved = cells.map(entry => ({ t: entry.t, m: entry.m }));
    const bag = [];
    counts.forEach((count, mask) => { for (let i = 0; i < count; i++) bag.push(mask); });
    cells.forEach((entry, index) => {
      if (entry.t !== "p") return;
      solved[index] = { t: "p", m: assignment.has(index) ? assignment.get(index) : bag.pop() };
    });
    const swaps = [];
    const work = cells.map(entry => entry.m);
    const movable = cells.map((entry, index) => entry.t === "p" ? index : -1).filter(index => index >= 0);
    movable.forEach(index => {
      if (work[index] === solved[index].m) return;
      const donor = movable.find(other => other !== index && work[other] === solved[index].m && work[other] !== solved[other].m);
      if (donor == null) return;
      swaps.push([index, donor]);
      [work[index], work[donor]] = [work[donor], work[index]];
    });
    return {
      method: "Follow the only opening out of the start. At each blue tile, spend a pipe that accepts that entry and sends the route onward.",
      answer: { cells: solved, swaps },
      steps: [
        `The fixed start opens ${WAY[startBits[0]]}. Grey tiles and both ends stay put; only blue pipes can change places.`,
        ...trace.map((move, index) => `Step ${index + 1}: put a ${PIPE[move.mask] || "pipe"} on ${cell(move.index, N)}. It must be open ${WAY[move.entryBit]} to receive the flow.`),
        swaps.length ? `One swap sequence has ${swaps.length} exchange${swaps.length === 1 ? "" : "s"}, starting with tiles ${swaps[0][0] + 1} and ${swaps[0][1] + 1}.` : "The pipes already form a connected route."
      ]
    };
  }

  function pairOk(a, b) { return (a.s === b.s) !== (a.f === b.f); }
  function solveSpinner(puzzle) {
    const { n, inner, outer } = puzzle;
    const anchor = [];
    const failures = [];
    let answer = null;
    for (let rotation = 0; rotation < n; rotation++) {
      const partner = inner[(n - rotation) % n];
      if (!pairOk(outer[0], partner)) continue;
      anchor.push(rotation);
      let bad = -1;
      for (let i = 0; i < n; i++) {
        if (!pairOk(outer[i], inner[(i - rotation + n) % n])) { bad = i; break; }
      }
      if (bad < 0) { answer = rotation; break; }
      failures.push(`Rotation ${rotation} reaches the first outer symbol but fails at pair ${bad + 1}.`);
    }
    if (answer == null) throw new Error("No spinner position");
    return {
      method: "Test the first outer symbol against every inner symbol, then fully check only the rotations that survive.",
      answer,
      steps: [
        `The wheel has ${n} positions. Pair 1 eliminates ${n - anchor.length} rotation${n - anchor.length === 1 ? "" : "s"} immediately.`,
        ...failures,
        `Rotation ${answer} is the one where every pair shares shape or shading, but not both.`
      ]
    };
  }

  function column(puzzle, header) {
    const index = puzzle.headers.indexOf(header);
    if (index < 0) throw new Error("Column not in exhibit");
    return index;
  }
  function rowByName(puzzle, name) {
    const row = puzzle.rows.find(entry => entry.name === name);
    if (!row) throw new Error("Row not in exhibit");
    return row;
  }
  function solveInsights(puzzle) {
    const prompt = puzzle.prompt;
    let value;
    let steps;
    const percent = prompt.match(/^(.+) then rises by (\d+)%, and (\d+) further .+ are added\. What is the new \1 figure\?$/);
    const gap = prompt.match(/^In (.+), how many percentage points higher is (.+)'s share of that column than (.+)'s share\?$/);
    const combined = prompt.match(/^In (.+), what percent of all .+ in the table came from (.+) and (.+) combined\?$/);
    const change = prompt.match(/^By what percent did (.+) change from (.+) to (.+?)\?/);
    const share = prompt.match(/^What percent of (.+)'s (.+) fell in (.+)\?$/);
    const average = prompt.match(/^What was the average number of (.+) per period for (.+)\?$/);
    const diff = prompt.match(/^How many more (.+) did (.+) record in (.+) than in (.+)\?$/);
    const read = prompt.match(/^How many (.+) did (.+) record in (.+)\?$/);
    if (puzzle.kind === "passage") {
      const passage = puzzle.passage.match(/handles (\d+) .+ an hour\. One shift lasts (\d+) hours, and (\d+)% of the shift/);
      if (!passage) throw new Error("Passage figures not found");
      const rate = Number(passage[1]), hours = Number(passage[2]), loss = Number(passage[3]), keep = 100 - loss;
      value = rate * hours * keep / 100;
      steps = [
        `Packing time is ${hours} hours minus ${loss}%, which is ${hours} × ${keep} / 100 = ${hours * keep / 100} hours.`,
        `${hours * keep / 100} × ${rate} per hour = ${value}.`
      ];
    } else if (percent) {
      const header = percent[1];
      const rise = Number(percent[2]);
      const extra = Number(percent[3]);
      const base = rowByName(puzzle, puzzle.rows[0].name).values[column(puzzle, header)];
      const raised = base * (100 + rise) / 100;
      value = raised + extra;
      steps = [
        `${header} shows ${base}.`,
        `A ${rise}% rise makes ${base} × ${(100 + rise) / 100} = ${raised}.`,
        `Add the extra ${extra}: ${raised} + ${extra} = ${value}.`
      ];
    } else if (gap) {
      const index = column(puzzle, gap[1]);
      const high = rowByName(puzzle, gap[2]).values[index];
      const low = rowByName(puzzle, gap[3]).values[index];
      const total = puzzle.rows.reduce((sum, row) => sum + row.values[index], 0);
      value = (high - low) * 100 / total;
      steps = [
        `${gap[1]} totals ${total}. ${gap[2]} is ${high} (${high * 100 / total}%) and ${gap[3]} is ${low} (${low * 100 / total}%).`,
        `The gap is ${high * 100 / total} − ${low * 100 / total} = ${value} percentage points. Use the column only, not the rest of the table.`
      ];
    } else if (combined) {
      const index = column(puzzle, combined[1]);
      const part = rowByName(puzzle, combined[2]).values[index] + rowByName(puzzle, combined[3]).values[index];
      const total = puzzle.rows.reduce((sum, row) => sum + row.values.reduce((inner, value) => inner + value, 0), 0);
      value = part * 100 / total;
      steps = [
        `${combined[1]} for ${combined[2]} and ${combined[3]} is ${part}.`,
        `The whole table is ${total}. ${part} / ${total} × 100 = ${value}.`
      ];
    } else if (change) {
      const row = rowByName(puzzle, change[1]);
      const from = row.values[column(puzzle, change[2])];
      const to = row.values[column(puzzle, change[3])];
      value = (to - from) * 100 / from;
      steps = [
        `${change[2]} is ${from} and ${change[3]} is ${to}.`,
        `(${to} − ${from}) / ${from} × 100 = ${value}. A fall is negative.`
      ];
    } else if (share) {
      const row = rowByName(puzzle, share[1]);
      const part = row.values[column(puzzle, share[3])];
      const total = row.values.reduce((sum, entry) => sum + entry, 0);
      value = part * 100 / total;
      steps = [
        `${share[3]} is ${part}. The ${share[1]} row totals ${total}.`,
        `${part} / ${total} × 100 = ${value}. Divide by the row you were asked about.`
      ];
    } else if (average) {
      const row = rowByName(puzzle, average[2]);
      const total = row.values.reduce((sum, entry) => sum + entry, 0);
      value = total / row.values.length;
      steps = [
        `Add ${row.values.join(" + ")} = ${total}.`,
        `Divide by ${row.values.length} periods: ${total} / ${row.values.length} = ${value}.`
      ];
    } else if (diff) {
      const row = rowByName(puzzle, diff[2]);
      const left = row.values[column(puzzle, diff[3])];
      const right = row.values[column(puzzle, diff[4])];
      value = left - right;
      steps = [
        `${diff[3]} is ${left} and ${diff[4]} is ${right}.`,
        `${left} − ${right} = ${value}. Subtract in the asked order.`
      ];
    } else if (read) {
      value = rowByName(puzzle, read[2]).values[column(puzzle, read[3])];
      steps = [
        `Find the ${read[2]} row and the ${read[3]} column. Their intersection is ${value}.`,
        "Stop there. A nearby total or another column is a distractor."
      ];
    } else throw new Error("Unrecognised insights question");
    if (!Number.isInteger(value)) throw new Error("Insights solver produced a non-integer");
    const index = puzzle.options.indexOf(value);
    if (index < 0) throw new Error("Solved value is not an option");
    return { method: "Use only the row and column named in the question, then one arithmetic step at a time.", answer: { index, value }, steps };
  }

  function solve(puzzle) {
    if (!puzzle || typeof puzzle.game !== "string") throw new TypeError("Puzzle must be an exported object");
    if (puzzle.game === "net") return { game: puzzle.game, ...solveNet(puzzle) };
    if (puzzle.game === "racer") return { game: puzzle.game, ...solveRacer(puzzle) };
    if (puzzle.game === "swipe") return { game: puzzle.game, ...solveSwipe(puzzle) };
    if (puzzle.game === "wordlogic") return { game: puzzle.game, ...solveWord(puzzle) };
    if (puzzle.game === "pipes") return { game: puzzle.game, ...solvePipes(puzzle) };
    if (puzzle.game === "spinner") return { game: puzzle.game, ...solveSpinner(puzzle) };
    if (puzzle.game === "insights") return { game: puzzle.game, ...solveInsights(puzzle) };
    throw new Error("Unknown puzzle");
  }

  return { exportPuzzle, solve };
});
