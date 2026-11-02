const { test } = require('node:test');
const assert = require('node:assert/strict');
const insights = require('../js/insights-logic');
const battery = require('../js/battery');
const review = require('../js/review');

function seeded(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const memory = () => { const bag = new Map(); return { getItem: key => bag.has(key) ? bag.get(key) : null, setItem: (key, value) => bag.set(key, value), removeItem: key => bag.delete(key) }; };

test('every generated insights item matches its exhibit and has one correct option', () => {
  const kinds = new Set();
  let negativeChange = 0;
  for (let level = 1; level <= 5; level++) {
    const gen = insights.create(seeded(70 + level));
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      const item = gen.newItem(level);
      const answer = insights.evaluate(item.check);
      assert.equal(item.options[item.answer], answer);
      assert.equal(new Set(item.options).size, 5);
      assert.equal(item.options.filter(option => option === answer).length, 1);
      assert.equal(item.level, level);
      kinds.add(item.kind);
      const flat = item.rows ? item.rows.flatMap(row => row.values) : [];
      if (item.check.op === 'read') assert.equal(item.rows[0].values[item.check.index], answer);
      if (item.check.op === 'diff') assert.equal(item.check.a - item.check.b, answer);
      if (item.check.op === 'avg' || item.check.op === 'sum') assert.deepEqual(item.rows[0].values, item.check.values);
      if (item.check.op === 'change') assert(flat.includes(item.check.from) && flat.includes(item.check.to));
      if (item.check.op === 'increaseAdd' || item.check.op === 'shareDiff') assert(flat.includes(item.check.base || item.check.a));
      if (item.check.op === 'share') {
        const columnSums = item.headers.map((_, index) => item.rows.reduce((sum, row) => sum + row.values[index], 0));
        const rowSums = item.rows.map(row => row.values.reduce((sum, value) => sum + value, 0));
        assert(flat.includes(item.check.part) || columnSums.includes(item.check.part));
        assert(rowSums.includes(item.check.total) || flat.reduce((sum, value) => sum + value, 0) === item.check.total);
      }
      if (item.check.op === 'output') {
        assert.match(item.passage, new RegExp(String(item.check.rate)));
        assert.match(item.passage, new RegExp(String(item.check.hours)));
        assert.match(item.passage, new RegExp(String(100 - item.check.keep) + '%'));
      }
      if (item.check.op === 'change' && answer < 0) negativeChange++;
      const diagram = insights.diagram(item);
      assert(!diagram.includes('<script'));
      if (item.kind !== 'passage') item.rows.forEach(row => row.values.forEach(value => assert.match(diagram, new RegExp(`>${value}<`))));
      seen.add(item.prompt + '|' + answer + '|' + JSON.stringify(item.rows || item.passage));
      const solved = review.render('insights', item);
      const missed = review.render('insights', { ...item, selected: item.options.findIndex(option => option !== answer) }, 'submitted');
      assert.match(solved, new RegExp(`>${answer}<small>Correct answer`));
      assert.match(missed, /Your answer/);
      assert.match(solved, /Working:/);
    }
    assert.equal(seen.size, 80, 'a run must not repeat an exhibit');
  }
  const run = insights.create(seeded(99));
  for (let i = 0; i < 15; i++) run.newItem((i % 5) + 1);
  assert.deepEqual([...kinds].sort(), ['bar', 'line', 'passage', 'table']);
  assert(negativeChange > 0);
});

test('insights review escapes exhibit text and explains an unreached question', () => {
  const html = insights.diagram({ kind: 'passage', title: '<img src=x onerror=alert(1)>', passage: 'A "shift" lasts 4 hours.', unanswered: false });
  assert(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  assert.match(review.render('insights', { unanswered: true }), /Not reached|not reached/i);
});

test('calculator does arithmetic used by the numerical section', () => {
  const calc = insights.calculator();
  assert.equal(calc.press('1'), '1');
  assert.equal(calc.press('2'), '12');
  assert.equal(calc.press('+'), '12');
  assert.equal(calc.press('5'), '5');
  assert.equal(calc.press('='), '17');
  '200'.split('').forEach(key => calc.press(key));
  assert.equal(calc.press('*'), '200');
  '15'.split('').forEach(key => calc.press(key));
  assert.equal(calc.press('%'), '0.15');
  assert.equal(calc.press('='), '30');
  assert.equal(calc.press('/'), '30');
  assert.equal(calc.press('0'), '0');
  assert.equal(calc.press('='), 'Error');
  assert.equal(calc.press('C'), '0');
  assert.equal(calc.press('9'), '9');
});

test('bad insight levels are rejected', () => {
  const gen = insights.create(seeded(1));
  assert.throws(() => gen.newItem(0), RangeError);
  assert.throws(() => gen.newItem(1.5), RangeError);
});

test('full mock is 45 published minutes and stores accuracy with response time', () => {
  assert.equal(battery.minutes, 45);
  assert.equal(battery.questions, 89);
  assert.deepEqual(battery.order.map(section => section.items), [15, 12, 12, 15, 15, 10, 10]);
  const storage = memory();
  assert.equal(battery.readSession(storage), null);
  assert.equal(battery.gate('net', storage).href, 'mock.html');
  battery.begin(storage);
  assert.equal(battery.gate('insights', storage).index, 0);
  assert.equal(battery.gate('net', storage).href, 'numerical-insights.html?battery=1');
  assert.equal(battery.record('net', { score: 1, total: 12, time: 4, date: 2 }, storage), null);
  const first = battery.record('insights', { score: 12, total: 15, time: 640, date: 3 }, storage);
  assert.equal(first.done, false);
  assert.equal(battery.nextHref(storage), 'net-the-numbers.html?battery=1');
  battery.order.slice(1, -1).forEach(section => {
    const step = battery.record(section.id, { score: section.items - 1, total: section.items, time: section.items * 3, date: 4 }, storage);
    assert.equal(step.done, false);
  });
  const last = battery.order.at(-1);
  const done = battery.record(last.id, { score: last.items, total: last.items, time: 40, date: 5 }, storage);
  assert.equal(done.done, true);
  assert.equal(done.summary.total, 89);
  assert.equal(done.summary.score, 12 + battery.order.slice(1, -1).reduce((sum, section) => sum + section.items - 1, 0) + last.items);
  assert.equal(done.summary.acc, Math.round(100 * done.summary.score / 89));
  assert.ok(done.summary.meanResponse > 0);
  assert.equal(battery.readSession(storage), null);
  assert.equal(battery.history(storage).length, 1);
  assert.equal(battery.history(storage)[0].sections.length, 7);
  assert.equal(battery.nextHref(storage), 'mock.html?results=1');
  storage.setItem('mmq_battery_current', '{');
  assert.equal(battery.readSession(storage), null);
  storage.setItem('mmq_battery_hist', JSON.stringify([{ sections: [{ id: 'net', score: 1, total: 12, time: 1, date: 1 }] }]));
  assert.deepEqual(battery.history(storage), []);
});
