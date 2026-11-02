const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/game-logic');
const verbal = require('../js/verbal-logic');
const insights = require('../js/insights-logic');
const solver = require('../js/solver');

function seeded(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function roundTrip(game, item) {
  const puzzle = solver.exportPuzzle(game, JSON.parse(JSON.stringify(item)));
  const encoded = JSON.stringify(puzzle);
  assert.doesNotMatch(encoded, /"(best|bp|sol|path|need|relation|check|explain)"/);
  const solved = solver.solve(JSON.parse(encoded));
  assert.equal(solver.solve(JSON.parse(encoded)).steps.join('\n'), solved.steps.join('\n'));
  assert.ok(solved.steps.length >= 2);
  assert.equal(solved.game, game);
  return solved;
}

for (let level = 1; level <= 5; level++) {
  test(`level ${level}: solvers match generator ground truth`, () => {
    const logic = create(seeded(500 + level));
    const words = verbal.create(seeded(800 + level));
    const numbers = insights.create(seeded(900 + level));
    for (let i = 0; i < 25; i++) {
      const net = logic.net.newItem(level);
      const netSolved = roundTrip('net', net);
      assert.deepEqual([netSolved.answer.x, netSolved.answer.y], net.bp);
      assert.equal(netSolved.answer.sum, net.best);

      const racer = logic.racer.newItem(level);
      const racerSolved = roundTrip('racer', racer);
      assert.equal(racerSolved.answer.indices.reduce((sum, index) => sum + racer.nums[index], 0), racer.target);
      assert.ok(racerSolved.answer.indices.length >= 2);
      assert.ok(racerSolved.answer.indices.length < racer.nums.length);

      const swipe = words.swipe(level);
      assert.equal(roundTrip('swipe', swipe).answer, swipe[2]);

      const analogy = words.analogy(level);
      assert.equal(roundTrip('wordlogic', analogy).answer, analogy.b[4]);

      const pipes = logic.pipes.newItem(level);
      const pipeSolved = roundTrip('pipes', pipes);
      assert.equal(logic.pipes.connected(pipeSolved.answer.cells, pipes.s, pipes.N), true);
      assert.deepEqual(pipeSolved.answer.cells.map(entry => entry.t), pipes.cells.map(entry => entry.t));
      assert.deepEqual(pipeSolved.answer.cells.map(entry => entry.m).sort(), pipes.cells.map(entry => entry.m).sort());
      pipes.cells.forEach((entry, index) => { if (entry.t !== 'p') assert.deepEqual(pipeSolved.answer.cells[index], entry); });

      const spinner = logic.spinner.newItem(level);
      const spinSolved = roundTrip('spinner', spinner);
      assert.equal(spinSolved.answer, spinner.sol);
      assert.equal(logic.spinner.valid(spinner.inner, spinner.outer, spinSolved.answer), true);

      const insight = numbers.newItem(level);
      const insightSolved = roundTrip('insights', insight);
      assert.equal(insightSolved.answer.index, insight.answer);
      assert.equal(insightSolved.answer.value, insight.options[insight.answer]);
      assert.equal(insightSolved.answer.value, insights.evaluate(insight.check));
    }
  });
}

test('solver refuses to treat a stored answer key as the puzzle', () => {
  assert.equal(solver.exportPuzzle('insights', { unanswered: true }), null);
  assert.throws(() => solver.solve({ game: 'missing' }), /Unknown puzzle/);
});
