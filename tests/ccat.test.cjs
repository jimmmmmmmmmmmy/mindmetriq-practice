const { test } = require("node:test");
const assert = require("node:assert/strict");
const items = require("../js/ccat-items");
const sessionApi = require("../js/ccat-session");
const history = require("../js/ccat-history");

const { buildTest, sampleItem, catalog, fingerprint, figureKey, banks } = items;
const { createSession, formatRemaining } = sessionApi;

function hasNumber(text, value) {
  return new RegExp(`(?<![\\d])${value}(?![\\d])`).test(text);
}

function hamming(left, right) {
  assert.equal(left.length, right.length);
  let count = 0;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) count++;
  return count;
}

function expectFig(kind, rot, fill, count) {
  const rotational = kind === "arrow" || kind === "triangle";
  return { kind, rot: rotational ? rot : 0, fill, count };
}

function wordAnswer(meta) {
  switch (meta.rule) {
    case "sum": return meta.a + meta.b;
    case "diff": return meta.a - meta.b;
    case "product": return meta.a * meta.b;
    case "money": return meta.a * meta.c + meta.b * meta.d;
    case "rate": return meta.pages / meta.rate;
    case "leftover": return meta.n % meta.k;
    case "change": return meta.bill - meta.price * meta.qty;
    case "twostep": return meta.s + meta.r * meta.h - meta.t;
    case "work": return meta.a * meta.b / (meta.a + meta.b);
    default: throw new Error("Unknown word rule " + meta.rule);
  }
}

function ratioAnswer(meta) {
  if (meta.rule === "scale") return meta.n / meta.a * meta.b;
  if (meta.rule === "split") return Math.max(meta.a, meta.b) * meta.total / (meta.a + meta.b);
  if (meta.rule === "mix") return meta.total * meta.a / (meta.a + meta.b);
  throw new Error("Unknown ratio rule " + meta.rule);
}

function percentAnswer(meta) {
  if (meta.rule === "increase") return meta.base * (100 + meta.rate) / 100;
  if (meta.rule === "of") return meta.base * meta.rate / 100;
  if (meta.rule === "discount") return meta.base * (100 - meta.rate) / 100;
  if (meta.rule === "reverse") return meta.sale * 100 / (100 - meta.rate);
  if (meta.rule === "portion") return meta.part * 100 / meta.whole;
  throw new Error("Unknown percent rule " + meta.rule);
}

function seriesTerms(meta) {
  if (meta.rule === "arith") return Array.from({ length: 6 }, (_, i) => meta.start + i * meta.diff);
  if (meta.rule === "geo") return Array.from({ length: 6 }, (_, i) => meta.start * meta.ratio ** i);
  if (meta.rule === "square") return Array.from({ length: 6 }, (_, i) => (meta.start + i) ** 2 + meta.add);
  if (meta.rule === "fib") {
    const terms = [meta.a, meta.b];
    while (terms.length < 6) terms.push(terms[terms.length - 2] + terms[terms.length - 1]);
    return terms;
  }
  if (meta.rule === "alt") {
    const terms = [meta.start];
    for (const diff of [meta.p, meta.q, meta.p, meta.q, meta.p]) terms.push(terms[terms.length - 1] + diff);
    return terms;
  }
  if (meta.rule === "accel") {
    const terms = [meta.start];
    for (let i = 0; i < 5; i++) terms.push(terms[terms.length - 1] + meta.first + i * meta.step);
    return terms;
  }
  throw new Error("Unknown series rule " + meta.rule);
}

function seriesFrames(meta) {
  if (meta.rule === "cycle") {
    assert.equal(meta.kinds.length, 3);
    return Array.from({ length: 5 }, (_, i) => expectFig(meta.kinds[i % 3], 0, meta.fill, meta.count));
  }
  if (meta.rule === "rotate") return Array.from({ length: 5 }, (_, i) => expectFig("arrow", (meta.start + i * 90) % 360, meta.fill, meta.count));
  if (meta.rule === "grow") return Array.from({ length: 5 }, (_, i) => expectFig(meta.kind, 0, meta.fill, i + 1));
  if (meta.rule === "alternate") {
    assert.deepEqual(meta.fills, ["solid", "none"]);
    return Array.from({ length: 5 }, (_, i) => expectFig(meta.kinds[i % 2], 0, i % 2 ? "none" : "solid", meta.count));
  }
  throw new Error("Unknown shape rule " + meta.rule);
}

function matrixCells(meta) {
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      if (meta.rule === "sumgrid") cells.push(expectFig(meta.kind, 0, "solid", row + column + 1));
      else if (meta.rule === "latin") cells.push(expectFig(meta.symbols[(row + column + meta.shift) % 3], 0, "solid", 1));
      else if (meta.rule === "turngrid") cells.push(expectFig("arrow", column * 90, meta.fill, row + 1));
      else throw new Error("Unknown matrix rule " + meta.rule);
    }
  }
  return cells;
}

function forcedEnds(people, befores) {
  const before = new Map(people.map(name => [name, 0]));
  const after = new Map(people.map(name => [name, 0]));
  for (const [earlier, later] of befores) {
    before.set(later, before.get(later) + 1);
    after.set(earlier, after.get(earlier) + 1);
  }
  const firsts = people.filter(name => before.get(name) === 0);
  const lasts = people.filter(name => after.get(name) === 0);
  assert.equal(firsts.length, 1);
  assert.equal(lasts.length, 1);
  return [firsts[0], lasts[0]];
}

function assertOneAnswer(item, answerKey) {
  assert.equal(item.choices.length, 5);
  assert.equal(item.choices[item.answer].key, String(answerKey));
  assert.equal(item.choices.filter(choice => choice.key === String(answerKey)).length, 1);
}

function assertNumeric(item, answer) {
  assert.equal(Number.isInteger(answer), true, item.prompt);
  assertOneAnswer(item, answer);
  assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
  assert.ok(item.explanation.endsWith(`Answer: ${answer}.`), item.explanation);
}

function checkItem(item) {
  assert.ok(item.prompt && item.explanation);
  assert.ok(item.difficulty >= 1 && item.difficulty <= 5);
  assert.equal(item.choices.length, 5);
  assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer <= 4);
  const rule = item.meta.rule;
  if (item.area === "math" && item.type === "word") {
    const fields = { sum: ["a", "b"], diff: ["a", "b"], product: ["a", "b"], money: ["a", "b", "c", "d"], rate: ["rate", "pages"], leftover: ["n", "k"], change: ["bill", "price", "qty"], twostep: ["s", "r", "h", "t"], work: ["a", "b"] };
    for (const field of fields[rule]) assert.equal(hasNumber(item.prompt, item.meta[field]), true, item.prompt + " missing " + field);
    assertNumeric(item, wordAnswer(item.meta));
    return;
  }
  if (item.area === "math" && item.type === "ratio") {
    for (const field of item.meta.rule === "scale" ? ["a", "b", "n"] : ["a", "b", "total"]) assert.equal(hasNumber(item.prompt, item.meta[field]), true, item.prompt);
    assertNumeric(item, ratioAnswer(item.meta));
    return;
  }
  if (item.area === "math" && item.type === "percent") {
    const fields = { increase: ["base", "rate"], of: ["base", "rate"], discount: ["base", "rate"], reverse: ["sale", "rate"], portion: ["part", "whole"] };
    for (const field of fields[rule]) assert.equal(hasNumber(item.prompt, item.meta[field]), true, item.prompt);
    assertNumeric(item, percentAnswer(item.meta));
    return;
  }
  if (item.area === "math" && item.type === "series") {
    const terms = seriesTerms(item.meta);
    assert.deepEqual(item.prompt.match(/\d+/g).map(Number), terms.slice(0, 5));
    assertNumeric(item, terms[5]);
    return;
  }
  if (item.type === "syllogism") {
    const meta = item.meta;
    assert.equal(new Set(item.choices.map(choice => choice.text)).size, 5);
    if (rule === "chain") {
      const correct = `${meta.person}'s badge belongs to ${meta.c}.`;
      assert.ok(item.prompt.includes(`Every ${meta.a} badge belongs to ${meta.b}.`));
      assert.ok(item.prompt.includes(`Every ${meta.b} badge belongs to ${meta.c}.`));
      assert.ok(item.prompt.includes(`${meta.person}'s badge belongs to ${meta.a}.`));
      assert.equal(item.choices[item.answer].text, correct);
      assert.equal(item.choices.filter(choice => choice.text === correct).length, 1);
      assert.equal(item.choices.filter(choice => choice.text === `${meta.person}'s badge belongs to ${meta.b}.`).length, 0);
      assert.equal(item.choices.filter(choice => choice.text === `Every ${meta.a} badge belongs to ${meta.c}.`).length, 0);
      return;
    }
    if (rule === "none") {
      const correct = `No ${meta.c} badge belongs to ${meta.b}.`;
      assert.ok(item.prompt.includes(`No ${meta.a} badge belongs to ${meta.b}.`));
      assert.ok(item.prompt.includes(`Every ${meta.c} badge belongs to ${meta.a}.`));
      assert.equal(item.choices[item.answer].text, correct);
      assert.equal(item.choices.filter(choice => choice.text === correct).length, 1);
      return;
    }
    if (rule === "tollens") {
      const correct = `The ${meta.thing} is not locked.`;
      assert.ok(item.prompt.includes(`If the ${meta.thing} is locked, then the ${meta.lamp} is on.`));
      assert.ok(item.prompt.includes(`The ${meta.lamp} is off.`));
      assert.equal(item.choices[item.answer].text, correct);
      assert.equal(item.choices.filter(choice => choice.text === correct).length, 1);
      assert.equal(item.choices.filter(choice => choice.text === `The ${meta.thing} is locked.`).length, 1);
      return;
    }
    if (rule === "exactly") {
      const correct = `The ${meta.z} crate holds the spare key.`;
      assert.ok(item.prompt.includes("Exactly one crate holds the spare key"));
      assert.ok(item.prompt.includes(`The ${meta.x} crate does not hold it.`));
      assert.ok(item.prompt.includes(`The ${meta.y} crate does not hold it.`));
      assert.equal(new Set([meta.x, meta.y, meta.z]).size, 3);
      assert.equal(item.choices[item.answer].text, correct);
      assert.equal(item.choices.filter(choice => choice.text === correct).length, 1);
      return;
    }
    if (rule === "order") {
      const [first, last] = forcedEnds(meta.people, meta.befores);
      const correct = `${first} finishes first.`;
      assert.equal(item.choices[item.answer].text, correct);
      assert.equal(item.choices.filter(choice => choice.text === correct).length, 1);
      assert.equal(item.choices.filter(choice => choice.text === `${last} finishes last.`).length, 0);
      for (const [earlier, later] of meta.befores) {
        assert.ok(item.prompt.includes(`${earlier} finishes before ${later}.`) || (later === last && item.prompt.includes(`${last} finishes after`)));
        assert.equal(item.choices.filter(choice => choice.text === `${earlier} finishes before ${later}.`).length, 0);
      }
      return;
    }
    throw new Error("Unknown syllogism " + rule);
  }
  if (item.type === "analogy") {
    const relation = banks.RELATIONS.find(entry => entry.id === item.meta.relation);
    assert.ok(relation.pairs.some(pair => pair[0] === item.meta.left[0] && pair[1] === item.meta.left[1]));
    assert.ok(relation.pairs.some(pair => pair[0] === item.meta.right[0] && pair[1] === item.meta.right[1]));
    assert.notDeepEqual(item.meta.left, item.meta.right);
    const seconds = new Set(relation.pairs.map(pair => pair[1]));
    assert.equal(item.choices[item.answer].key, item.meta.right[1]);
    assert.equal(item.choices.filter(choice => seconds.has(choice.key)).length, 1);
    assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
    assert.ok(item.prompt.toLowerCase().includes(item.meta.left[0]));
    assert.ok(item.prompt.toLowerCase().includes(item.meta.right[0]));
    return;
  }
  if (item.type === "lexical") {
    const correct = rule === "synonym" ? item.meta.syn : item.meta.ant;
    if (rule !== "synonym" && rule !== "antonym") throw new Error(rule);
    assert.equal(item.choices[item.answer].key, correct);
    assert.equal(item.choices.filter(choice => choice.key === correct).length, 1);
    assert.ok(item.choices.some(choice => choice.key === item.meta.syn));
    assert.ok(item.choices.some(choice => choice.key === item.meta.ant));
    assert.ok(item.prompt.includes(item.meta.word.toUpperCase()));
    assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
    return;
  }
  if (item.type === "cloze") {
    const bank = banks.CLOZE.find(entry => entry.sentence === item.prompt);
    assert.ok(bank, item.prompt);
    assert.equal(item.choices[item.answer].key, bank.answer);
    assert.equal(item.choices.filter(choice => choice.key === bank.answer).length, 1);
    assert.equal(item.explanation, bank.explanation);
    assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
    return;
  }
  if (item.type === "detail") {
    if (rule === "exact") {
      assert.equal(item.stimulus.text, item.meta.code);
      assertOneAnswer(item, item.meta.code);
      for (const choice of item.choices) {
        assert.equal(choice.key.length, item.meta.code.length);
        if (choice.key !== item.meta.code) assert.ok(hamming(choice.key, item.meta.code) >= 1);
      }
      return;
    }
    if (rule === "hamming") {
      const distance = hamming(item.meta.left, item.meta.right);
      assert.ok(distance > 0);
      assert.equal(item.stimulus.left, item.meta.left);
      assert.equal(item.stimulus.right, item.meta.right);
      assertOneAnswer(item, distance);
      assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
      return;
    }
    if (rule === "pattern") {
      const pattern = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;
      const fails = item.choices.map((choice, index) => pattern.test(choice.key) ? -1 : index).filter(index => index >= 0);
      assert.deepEqual(fails, [item.answer]);
      assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
      return;
    }
    throw new Error("Unknown detail rule " + rule);
  }
  if (item.area === "spatial" && item.type === "series") {
    const frames = seriesFrames(item.meta);
    assert.deepEqual(item.stimulus.frames, frames.slice(0, 4));
    assert.equal(item.stimulus.frames.length, 4);
    assert.deepEqual(item.choices[item.answer].figure, frames[4]);
    assert.equal(item.choices.filter(choice => figureKey(choice.figure) === figureKey(frames[4])).length, 1);
    assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
    return;
  }
  if (item.type === "matrix") {
    const cells = matrixCells(item.meta);
    assert.equal(item.stimulus.cells.length, 9);
    assert.equal(item.stimulus.cells[8], null);
    assert.deepEqual(item.stimulus.cells.slice(0, 8), cells.slice(0, 8));
    assert.deepEqual(item.choices[item.answer].figure, cells[8]);
    assert.equal(item.choices.filter(choice => figureKey(choice.figure) === figureKey(cells[8])).length, 1);
    assert.equal(new Set(item.choices.map(choice => choice.key)).size, 5);
    return;
  }
  if (item.type === "odd") {
    const field = { shape: "kind", rotate: "rot", fill: "fill", count: "count" }[rule];
    if (!field) throw new Error(rule);
    for (const key of ["kind", "rot", "fill", "count"]) {
      if (key === field) assert.notEqual(item.meta.common[key], item.meta.odd[key]);
      else assert.equal(item.meta.common[key], item.meta.odd[key]);
    }
    if (rule === "rotate") assert.equal(item.meta.common.kind, "arrow");
    const keys = item.choices.map(choice => figureKey(choice.figure));
    assert.equal(keys.filter(key => key === figureKey(item.meta.odd)).length, 1);
    assert.equal(keys.filter(key => key === figureKey(item.meta.common)).length, 4);
    assert.equal(item.answer, keys.indexOf(figureKey(item.meta.odd)));
    return;
  }
  throw new Error("Unchecked item " + item.area + " " + item.type);
}

const SPECS = [
  ["math", "word", 9],
  ["math", "ratio", 3],
  ["math", "percent", 5],
  ["math", "series", 6],
  ["math", "syllogism", 5],
  ["verbal", "analogy", 1],
  ["verbal", "lexical", 2],
  ["verbal", "cloze", 1],
  ["verbal", "detail", 3],
  ["spatial", "series", 4],
  ["spatial", "matrix", 3],
  ["spatial", "odd", 4],
];

for (const [area, type, variants] of SPECS) {
  test(`${area} ${type} has one recomputed answer for every difficulty, variant, and seed`, () => {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      for (let variant = 0; variant < variants; variant++) {
        for (const seed of [1, 8, 27, 100]) {
          checkItem(sampleItem(area, type, difficulty, seed * 97 + difficulty * 11 + variant, variant));
        }
      }
    }
  });
}

test("authored banks have one keyed answer and no duplicate stems", () => {
  assert.equal(new Set(banks.CLOZE.map(entry => entry.sentence)).size, banks.CLOZE.length);
  for (const entry of banks.CLOZE) {
    assert.equal(entry.choices.length, 5);
    assert.equal(new Set(entry.choices).size, 5);
    assert.equal(entry.choices.filter(choice => choice === entry.answer).length, 1);
    assert.ok(entry.sentence.includes("______"));
    assert.ok(entry.explanation);
  }
  const seenWords = new Set();
  for (const entry of banks.LEX) {
    const all = [entry.word, entry.syn, entry.ant, ...entry.decoys];
    assert.equal(new Set(all).size, 7);
    assert.equal(entry.decoys.length, 4);
    assert.equal(seenWords.has(entry.word), false);
    seenWords.add(entry.word);
  }
  const words = new Set();
  for (const relation of banks.RELATIONS) {
    for (const pair of relation.pairs) {
      assert.equal(words.has(pair[0]), false);
      assert.equal(words.has(pair[1]), false);
      words.add(pair[0]);
      words.add(pair[1]);
    }
  }
});

test("a full mock is deterministic, mixed, ramped, and unique", () => {
  const counts = catalog();
  assert.equal(counts.families, 12);
  assert.equal(counts.mathTemplates, 28);
  assert.equal(counts.spatialRules, 11);
  assert.equal(counts.clozeItems, 18);
  assert.equal(counts.lexicalEntries, 20);
  let early = 0;
  let late = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const first = buildTest({ seed, kind: "mock" });
    const second = buildTest({ seed, kind: "mock" });
    assert.equal(first.durationMs, 15 * 60 * 1000);
    assert.equal(first.items.length, 50);
    assert.deepEqual(first.items.map(fingerprint), second.items.map(fingerprint));
    assert.equal(new Set(first.items.map(item => item.dedupe)).size, 50);
    const tally = { math: 0, verbal: 0, spatial: 0 };
    const gap = { math: 0, verbal: 0, spatial: 0 };
    let previous = "";
    let run = 0;
    first.items.forEach((item, index) => {
      checkItem(item);
      tally[item.area]++;
      for (const area of Object.keys(gap)) gap[area] = item.area === area ? 0 : gap[area] + 1;
      for (const area of Object.keys(gap)) assert.ok(gap[area] <= 3, area);
      run = item.area === previous ? run + 1 : 1;
      previous = item.area;
      assert.ok(run < 3);
      if (seed === 1 && index < 10) early += item.difficulty;
      if (seed === 1 && index >= 40) late += item.difficulty;
    });
    assert.deepEqual(tally, { math: 18, verbal: 16, spatial: 16 });
  }
  assert.ok(early < late);
  const other = buildTest({ seed: 99, kind: "mock" });
  assert.notDeepEqual(buildTest({ seed: 1, kind: "mock" }).items.map(fingerprint), other.items.map(fingerprint));
});

test("drills stay in one area and use the configured pace", () => {
  for (const area of ["math", "spatial", "verbal"]) {
    const drill = buildTest({ seed: 5, kind: "drill", area, secondsPerQuestion: 18 });
    assert.equal(drill.items.length, 10);
    assert.equal(drill.durationMs, 180000);
    assert.equal(drill.area, area);
    assert.ok(drill.items.every(item => item.area === area));
    drill.items.forEach(checkItem);
    assert.equal(new Set(drill.items.map(item => item.dedupe)).size, 10);
  }
  assert.equal(buildTest({ seed: 1, kind: "drill", area: "math", secondsPerQuestion: 12 }).durationMs, 120000);
  assert.throws(() => buildTest({ seed: 1, kind: "drill", area: "math", secondsPerQuestion: 7 }), RangeError);
  assert.equal(buildTest({ seed: 1, kind: "mock", secondsPerQuestion: 12 }).durationMs, 900000);
});

function mini(area, answer) {
  return {
    area,
    type: "word",
    answer,
    prompt: "Prompt",
    explanation: "Because.",
    stimulus: null,
    choices: [0, 1, 2, 3, 4].map(index => ({ key: String(index), text: String(index) })),
  };
}

test("the clock auto-submits at 0:00 and will not advance without an answer or go back", () => {
  assert.equal(formatRemaining(15 * 60 * 1000), "15:00");
  assert.equal(formatRemaining(0), "0:00");
  assert.equal(formatRemaining(1), "0:01");
  assert.equal(formatRemaining(60000), "1:00");
  const testRun = { seed: 3, kind: "drill", area: "math", durationMs: 5000, items: [mini("math", 2), mini("verbal", 0), mini("spatial", 4)] };
  const run = createSession(testRun, { startedAt: 0 });
  assert.deepEqual(Object.keys(run).sort(), ["advance", "result", "score", "select", "tick", "view"]);
  assert.equal(run.view(0).canGoBack, false);
  assert.equal(run.view(0).canPause, false);
  assert.equal(run.view(0).timeLeftMs, 5000);
  assert.equal(run.view(0).number, 1);
  assert.equal(run.advance(1000).reason, "need-answer");
  assert.equal(run.view(1000).index, 0);
  run.select(0, 1000);
  run.select(2, 1200);
  assert.equal(run.advance(2000).ok, true);
  assert.equal(run.view(2000).number, 2);
  assert.equal(run.advance(2200).reason, "need-answer");
  assert.equal(run.score().correct, 1);
  run.select(1, 4000);
  assert.equal(run.tick(4999).status, "active");
  assert.equal(run.tick(5000).status, "complete");
  assert.equal(run.view(5000).expired, true);
  assert.equal(run.view(5000).timeLeftMs, 0);
  assert.equal(formatRemaining(run.view(5000).timeLeftMs), "0:00");
  const outcome = run.result();
  assert.equal(outcome.attempted, 2);
  assert.equal(outcome.correct, 1);
  assert.equal(outcome.total, 3);
  assert.equal(outcome.areas.math.correct, 1);
  assert.equal(outcome.areas.math.avgMs, 2000);
  assert.equal(outcome.areas.verbal.attempted, 1);
  assert.equal(outcome.areas.verbal.correct, 0);
  assert.equal(outcome.areas.verbal.timeMs, 3000);
  assert.equal(outcome.areas.spatial.attempted, 0);
  assert.equal(outcome.areas.spatial.avgMs, null);
  assert.equal(outcome.avgMs, 2500);
  assert.equal(outcome.wallMs, 5000);
  assert.deepEqual(outcome.missed.map(miss => miss.reason), ["incorrect", "unanswered"]);
  assert.equal(outcome.missed[0].yourChoice, 1);
  assert.equal(outcome.missed[1].yourChoice, null);
  assert.equal(run.advance(6000).reason, "complete");
  assert.equal(run.select(0, 6000).reason, "complete");
  assert.equal(run.score().correct, 1);

  const blank = createSession(testRun, { startedAt: 10 });
  blank.tick(5010);
  assert.equal(blank.result().attempted, 0);
  assert.equal(blank.result().expired, true);
  assert.equal(blank.result().wallMs, 5000);
});

test("a perfect drill scores 10 and a selected answer is what counts at the buzzer", () => {
  const drill = buildTest({ seed: 4, kind: "drill", area: "verbal", secondsPerQuestion: 8 });
  let time = 1000;
  const run = createSession(drill, { startedAt: time });
  for (let i = 0; i < 10; i++) {
    const item = run.view(time).item;
    assert.equal(run.advance(time).ok, false);
    run.select(item.answer === 0 ? 1 : 0, time + 100);
    run.select(item.answer, time + 200);
    assert.equal(run.advance(time + 500).ok, true);
    time += 500;
  }
  const outcome = run.result();
  assert.equal(outcome.correct, 10);
  assert.equal(outcome.attempted, 10);
  assert.equal(outcome.missed.length, 0);
  assert.equal(outcome.areas.verbal.correct, 10);
  assert.equal(outcome.areas.math.total, 0);
  assert.equal(outcome.avgMs, 500);
  assert.equal(outcome.expired, false);
  const record = history.toRecord(outcome, 1_700_000_000_000);
  assert.equal(history.valid(record), true);
  assert.equal(record.mode, "drill");
  assert.equal(record.area, "verbal");
  assert.equal(record.score, 10);
});

test("history keeps valid runs, drops junk, and ranks full mocks", () => {
  const memory = value => ({ getItem: () => value, setItem(key, next) { value = next; } });
  const store = memory("[]");
  const mock = buildTest({ seed: 11, kind: "mock" });
  const run = createSession(mock, { startedAt: 0 });
  run.select(0, 1000);
  run.tick(mock.durationMs);
  const saved = history.toRecord(run.result(), 50_000);
  assert.equal(history.save(saved, store), true);
  assert.equal(history.read(store).length, 1);
  assert.equal(history.read(store)[0].total, 50);
  const finished = createSession(buildTest({ seed: 2, kind: "drill", area: "math" }), { startedAt: 0 });
  finished.tick(180000);
  const drillRecord = history.toRecord(finished.result(), 60_000);
  drillRecord.score = 10;
  drillRecord.attempted = 10;
  drillRecord.areas.math.correct = 10;
  drillRecord.areas.math.attempted = 10;
  assert.equal(history.save(drillRecord, store), true);
  assert.equal(history.best(history.read(store)).mode, "mock");
  assert.equal(history.save({ ...saved, mode: "<img>" }, store), false);
  assert.equal(history.save({ ...saved, total: 15 }, store), false);
  assert.deepEqual(history.read(memory("{}")), []);
  assert.deepEqual(history.read(memory("nope")), []);
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("full"); } };
  assert.deepEqual(history.read(denied), []);
  assert.equal(history.save(saved, denied), false);
  const capped = memory("[]");
  for (let i = 0; i < 60; i++) history.save({ ...saved, date: i + 1, time: i }, capped);
  const rows = history.read(capped);
  assert.equal(rows.length, 50);
  assert.equal(rows[0].date, 11);
  assert.equal(history.best([{ ...saved, score: 20, time: 800 }, { ...saved, score: 20, time: 700 }, drillRecord]).time, 700);
});
