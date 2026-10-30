(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./verbal-data.js"));
  else root.MMQVerbal = factory(root.MMQVerbalData);
})(typeof globalThis !== "undefined" ? globalThis : this, data => {
  function create(random = Math.random) {
    const pick = a => a[Math.floor(random() * a.length)];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const pairs = [];
    for (const [level, words] of data.synonyms) for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) pairs.push([words[i], words[j], "S", level]);
    for (const [level, a, b] of data.opposites) pairs.push([a, b, "A", level]);
    for (const [level, a, b] of data.other) pairs.push([a, b, "N", level]);
    // Canonical keys prevent reversed or duplicated word pairs from appearing twice.
    const pairKey = p => p.slice(0, 2).sort().join("|");
    const uniquePairs = [...new Map(pairs.map(p => [pairKey(p), p])).values()];
    const analogies = [];
    data.analogies.forEach(([level, relation, entries], group) => {
      entries.forEach((a, i) => entries.forEach((b, j) => {
        if (i !== j) analogies.push({ level, relation, a, b, entries, key: `${group}:${Math.min(i,j)}:${Math.max(i,j)}` });
      }));
    });
    let usedPairs, usedAnalogies, categories;
    function reset() { usedPairs = new Set(); usedAnalogies = new Set(); categories = []; }
    function near(pool, level) {
      if (!Number.isInteger(level) || level < 1 || level > 5) throw new RangeError("Level must be 1–5");
      if (!pool.length) throw new Error("Verbal relationship pool exhausted");
      const distance = Math.min(...pool.map(p => Math.abs(p.level - level)));
      return pool.filter(p => Math.abs(p.level - level) === distance);
    }
    function swipe(level) {
      if (!categories.length) categories = shuffle(["S", "A", "N"]);
      const category = categories.pop();
      const pool = uniquePairs.filter(p => p[2] === category && !usedPairs.has(pairKey(p))).map(pair => ({ pair, level: pair[3] }));
      const p = pick(near(pool, level)).pair;
      usedPairs.add(pairKey(p));
      const result = random() < .5 ? p.slice() : [p[1], p[0], p[2], p[3]];
      result.level = p[3];
      return result;
    }
    function analogy(level) {
      const p = pick(near(analogies.filter(a => !usedAnalogies.has(a.key)), level));
      usedAnalogies.add(p.key);
      const excluded = new Set([...p.a, ...p.b]);
      const distractors = shuffle(p.entries.map(e => e[1]).filter(w => !excluded.has(w))).slice(0, 4);
      if (distractors.length !== 4) throw new Error("An analogy needs four distinct distractors");
      return { level: p.level, relation: p.relation, b: [p.level, ...p.a, ...p.b, distractors], opts: shuffle([p.b[1], ...distractors]) };
    }
    reset();
    return { reset, swipe, analogy };
  }
  return { create };
});
