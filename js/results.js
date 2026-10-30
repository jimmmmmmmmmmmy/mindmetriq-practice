// Descriptive practice feedback; no percentile or ability estimates.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MMQResults = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function summarize(results) {
    const levels = Array.from({ length: 5 }, (_, i) => ({ level: i + 1, total: 0, correct: 0, used: 0 }));
    let correct = 0, time = 0, points = 0, possible = 0, deadlines = 0, missedAtDeadline = 0;
    for (const r of results) {
      const row = levels[r.level - 1];
      row.total++; row.correct += Number(r.correct); row.used += r.used;
      correct += Number(r.correct); time += r.used; possible += r.level;
      if (r.correct) points += r.level;
      if (r.info.timedOut) { deadlines++; if (!r.correct) missedAtDeadline++; }
    }
    return { total: results.length, correct, time, points, possible, deadlines, missedAtDeadline, levels,
      meanLevel: results.length ? possible / results.length : 0,
      maxLevel: Math.max(0, ...results.map(r => r.level)) };
  }
  // Task focus follows the publisher's public task descriptions. Strategies are
  // this app's practice guidance, not an official diagnostic interpretation.
  const guidance = {
    net: { focus: 'Compare sums and positions', strategy: 'Compare legal net positions and add every covered number, including negatives.', difficulty: 'Higher tiers use larger nets, more negative numbers, and closer competing totals.' },
    racer: { focus: 'Plan the target sum', strategy: 'Use the planning time to choose a subset that reaches the target, then steer away from the rest.', difficulty: 'Higher tiers use larger numbers, more negatives and larger target subsets. Hard drill speeds up both phases.' },
    swipe: { focus: 'Compare word meanings', strategy: 'Distinguish meaning from association: related words can still belong in Other.', difficulty: 'Higher tiers use less familiar vocabulary and finer distinctions between related meanings.' },
    wordlogic: { focus: 'Keep the relationship consistent', strategy: 'Name the relationship in the first pair, then apply it in the same direction to the second pair.', difficulty: 'Higher tiers use more specialised relationships and less familiar vocabulary.' },
    pipes: { focus: 'Trace a continuous route', strategy: 'Trace from one fixed end. Each pipe must open toward its neighbour, and the neighbour must open back.', difficulty: 'Higher tiers use longer routes, more scrambled pipes, and eventually a larger board.' },
    spinner: { focus: 'Check every symbol pair', strategy: 'Check each pair for exactly one match: shape or shading. Matching both, or neither, breaks the rule.', difficulty: 'Higher tiers add wheel positions, another shape, and a third shading.' }
  };
  function feedback(summary, id) {
    const g = guidance[id];
    let observation;
    if (summary.correct === summary.total) observation = `All ${summary.total} answers were correct in this run.`;
    else {
      const missed = summary.total - summary.correct;
      observation = `${missed} of ${summary.total} answers were missed.`;
      if (summary.missedAtDeadline) observation += ` ${summary.missedAtDeadline} of those reached the time limit.`;
    }
    return { ...g, observation };
  }
  return { summarize, feedback, guidance };
});
