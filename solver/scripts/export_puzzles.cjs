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

const count = Number(arg("--count", "40"));
const seed = Number(arg("--seed", "1000"));
const out = arg("--out", "");
const lexiconOut = arg("--lexicon", "");
if (!Number.isInteger(count) || count < 1) throw new Error("--count must be a positive integer");
const body = records(count, seed).map(row => JSON.stringify(row)).join("\n") + "\n";
if (out) fs.mkdirSync(path.dirname(out), { recursive: true });
if (out) fs.writeFileSync(out, body);
else process.stdout.write(body);
if (lexiconOut) {
  fs.mkdirSync(path.dirname(lexiconOut), { recursive: true });
  fs.writeFileSync(lexiconOut, JSON.stringify(lexicon()));
}
