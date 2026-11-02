#!/usr/bin/env node
// Dump puzzles from this repo's generators. Reads local JS only. No network.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const { create: createGames } = require(path.join(root, "js/game-logic.js"));
const { create: createVerbal } = require(path.join(root, "js/verbal-logic.js"));
const { create: createInsights, evaluate } = require(path.join(root, "js/insights-logic.js"));
const verbalData = require(path.join(root, "js/verbal-data.js"));

function seeded(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function pipeTruth(item) {
  const cells = item.cells.map(cell => ({ t: cell.t, m: cell.m }));
  for (const place of item.path.slice(1, -1)) {
    if (cells[place].t === "p" && cells[place].m === item.need[place]) continue;
    const donor = cells.findIndex((cell, index) => cell.t === "p" && cell.m === item.need[place] && !(item.path.includes(index) && cells[index].m === item.need[index]));
    if (donor < 0) throw new Error("Pipe inventory cannot build the generator route");
    [cells[place], cells[donor]] = [cells[donor], cells[place]];
  }
  return cells.map(cell => ({ t: cell.t, m: cell.m }));
}

function lexicon() {
  return {
    synonyms: verbalData.synonyms.map(entry => entry.slice(1)[0]),
    opposites: verbalData.opposites.map(([, a, b]) => [a, b]),
    analogies: verbalData.analogies.map(([, relation, pairs]) => ({ relation, pairs }))
  };
}

function records(count, seed) {
  const games = createGames(seeded(seed + 1));
  const words = createVerbal(seeded(seed + 2));
  const insights = createInsights(seeded(seed + 3));
  const lines = [];
  const wanted = new Set(String(arg("--games", "net,racer,swipe,wordlogic,pipes,spinner,insights")).split(",").filter(Boolean));
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 20 === 0) words.reset();
    const level = (i % 5) + 1;
    if (wanted.has("net")) {
      const net = games.net.newItem(level);
      lines.push({ game: "net", level, puzzle: { g: net.g, sh: { cells: net.sh.cells, w: net.sh.w, h: net.sh.h } }, truth: { x: net.bp[0], y: net.bp[1], sum: net.best } });
    }
    if (wanted.has("racer")) {
      const racer = games.racer.newItem(level);
      lines.push({ game: "racer", level, puzzle: { nums: racer.nums, target: racer.target }, truth: { indices: racer.sol, target: racer.target } });
    }
    if (wanted.has("swipe")) {
      const swipe = words.swipe(level);
      lines.push({ game: "swipe", level, puzzle: { words: [swipe[0], swipe[1]] }, truth: { category: swipe[2] } });
    }
    if (wanted.has("wordlogic")) {
      const word = words.analogy(level);
      lines.push({ game: "wordlogic", level, puzzle: { left: [word.b[1], word.b[2]], stem: word.b[3], options: word.opts }, truth: { answer: word.b[4] } });
    }
    if (wanted.has("pipes")) {
      const pipes = games.pipes.newItem(level);
      lines.push({ game: "pipes", level, puzzle: { N: pipes.N, s: pipes.s, t: pipes.t, cells: pipes.cells.map(cell => ({ t: cell.t, m: cell.m })) }, truth: { cells: pipeTruth(pipes) } });
    }
    if (wanted.has("spinner")) {
      const spinner = games.spinner.newItem(level);
      lines.push({ game: "spinner", level, puzzle: { n: spinner.n, inner: spinner.inner, outer: spinner.outer }, truth: { rotation: spinner.sol } });
    }
    if (wanted.has("insights")) {
      const item = insights.newItem(level);
      lines.push({
        game: "insights", level,
        puzzle: { kind: item.kind, title: item.title, unit: item.unit, headers: item.headers, rows: item.rows, passage: item.passage, prompt: item.prompt, options: item.options },
        truth: { index: item.answer, value: evaluate(item.check) }
      });
    }
  }
  return lines;
}

// The practice generator rejects levels outside 1–5 and never builds a board
// larger than 6 by 6. This stress set is not that generator: 7 by 7, a longer
// forced route, more spare pipes, and more swaps. It is for evaluation only.
function stressPipes(count, seed) {
  const random = seeded(seed + 1);
  const rnd = (a, b) => a + Math.floor(random() * (b - a + 1));
  const pick = list => list[Math.floor(random() * list.length)];
  const shuffle = list => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const D = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
  const N = 7;
  const PIPES = [5, 10, 3, 6, 12, 9];
  function genPath(s, t, minLen) {
    for (let attempt = 0; attempt < 800; attempt++) {
      const path = [s];
      const seen = new Set([s]);
      let budget = 8000;
      const ok = (function dfs(c) {
        if (--budget <= 0) return false;
        if (c === t) return path.length >= minLen;
        if (path.length > minLen + 2) return false;
        const x = c % N, y = (c / N) | 0;
        for (const [dx, dy] of shuffle(D)) {
          const nx = x + dx, ny = y + dy, n = ny * N + nx;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(n)) continue;
          if (n !== t && path.length + 1 < minLen && random() < 0.1) continue;
          seen.add(n); path.push(n);
          if (dfs(n)) return true;
          path.pop(); seen.delete(n);
        }
        return false;
      })(s);
      if (ok) return path;
    }
    return null;
  }
  const bitTo = (a, b) => {
    const dx = b % N - a % N, dy = ((b / N) | 0) - ((a / N) | 0);
    return D.find(step => step[0] === dx && step[1] === dy)[2];
  };
  function connected(cells, s) {
    let c = s, out = cells[s].m, steps = 0;
    while (steps++ < N * N + 2) {
      const step = D.find(item => item[2] === out);
      if (!step) return false;
      const x = c % N + step[0], y = ((c / N) | 0) + step[1];
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const n = y * N + x, cell = cells[n];
      if (!(cell.m & OPP[out])) return false;
      if (cell.t === "e") return n !== s;
      if (cell.t !== "p") return false;
      out = cell.m & ~OPP[out]; c = n;
    }
    return false;
  }
  const lines = [];
  for (let i = 0; i < count; i++) {
    let item = null;
    for (let attempt = 0; attempt < 2000 && !item; attempt++) {
      const border = [];
      for (let cell = 0; cell < N * N; cell++) {
        const x = cell % N, y = (cell / N) | 0;
        if (x === 0 || y === 0 || x === N - 1 || y === N - 1) border.push(cell);
      }
      const s = pick(border), t = pick(border);
      const dist = Math.abs(s % N - t % N) + Math.abs(((s / N) | 0) - ((t / N) | 0));
      if (dist < 4) continue;
      const path = genPath(s, t, Math.min(dist + 15, N * N - 12));
      if (!path) continue;
      const cells = Array.from({ length: N * N }, () => ({ t: "x", m: 0 }));
      path.forEach((c, k) => {
        let m = 0;
        if (k > 0) m |= bitTo(c, path[k - 1]);
        if (k < path.length - 1) m |= bitTo(c, path[k + 1]);
        cells[c] = { t: k === 0 || k === path.length - 1 ? "e" : "p", m };
      });
      const need = {};
      path.forEach(c => { need[c] = cells[c].m; });
      const free = shuffle([...cells.keys()].filter(index => cells[index].t === "x"));
      free.slice(0, rnd(6, 12)).forEach(index => { cells[index] = { t: "p", m: pick(PIPES) }; });
      const movable = () => cells.map((cell, index) => cell.t === "p" ? index : -1).filter(index => index >= 0);
      for (let swap = 0; swap < 18; swap++) {
        const pipes = movable();
        const a = pick(pipes);
        const options = pipes.filter(index => index !== a && cells[index].m !== cells[a].m);
        if (!options.length) continue;
        const b = pick(options);
        [cells[a], cells[b]] = [cells[b], cells[a]];
      }
      if (connected(cells, s)) continue;
      item = { N, cells, s, t, path, need };
    }
    if (!item) throw new Error("Could not generate an out-of-distribution pipe board");
    lines.push({
      game: "pipes",
      level: "ood",
      distribution: "ood-7x7",
      puzzle: { N: item.N, s: item.s, t: item.t, cells: item.cells.map(cell => ({ t: cell.t, m: cell.m })) },
      truth: { cells: pipeTruth(item) }
    });
  }
  return lines;
}

const count = Number(arg("--count", "40"));
const seed = Number(arg("--seed", "1000"));
const out = arg("--out", "");
const lexiconOut = arg("--lexicon", "");
const stress = arg("--stress", "");
if (!Number.isInteger(count) || count < 1) throw new Error("--count must be a positive integer");
const body = (stress === "7x7" ? stressPipes(count, seed) : records(count, seed)).map(row => JSON.stringify(row)).join("\n") + "\n";
if (out) fs.mkdirSync(path.dirname(out), { recursive: true });
if (out) fs.writeFileSync(out, body);
else process.stdout.write(body);
if (lexiconOut) {
  fs.mkdirSync(path.dirname(lexiconOut), { recursive: true });
  fs.writeFileSync(lexiconOut, JSON.stringify(lexicon()));
}
