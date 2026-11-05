// Local practice history for aptitude mocks and drills. Untrusted storage is ignored.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CCATHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const KEY = "mmq_hist_ccat";
  const AREAS = ["math", "spatial", "verbal"];

  function roundSeconds(ms) {
    if (ms == null) return null;
    return Math.round(ms / 100) / 10;
  }

  function areaOk(area) {
    return !!area && Number.isInteger(area.correct) && Number.isInteger(area.attempted) && Number.isInteger(area.total)
      && area.correct >= 0 && area.attempted >= area.correct && area.total >= area.attempted && area.total <= 50
      && (area.avgSeconds === null || (Number.isFinite(area.avgSeconds) && area.avgSeconds >= 0 && area.avgSeconds <= 900));
  }

  function valid(record) {
    if (!record || (record.mode !== "mock" && record.mode !== "drill")) return false;
    if (record.mode === "mock" && !(record.area == null && record.total === 50)) return false;
    if (record.mode === "drill" && !(AREAS.includes(record.area) && record.total === 10)) return false;
    if (!Number.isInteger(record.score) || !Number.isInteger(record.attempted) || !Number.isInteger(record.time) || !Number.isInteger(record.seed)) return false;
    if (record.score < 0 || record.attempted < record.score || record.attempted > record.total || record.time < 0 || record.time > 900) return false;
    if (!(record.avgSeconds === null || (Number.isFinite(record.avgSeconds) && record.avgSeconds >= 0 && record.avgSeconds <= 900))) return false;
    if (!Number.isFinite(record.date) || record.date <= 0 || record.date > 8640000000000000) return false;
    if (record.seed < 0 || record.seed > 4294967295) return false;
    if (!record.areas || !AREAS.every(name => areaOk(record.areas[name]))) return false;
    const correct = AREAS.reduce((sum, name) => sum + record.areas[name].correct, 0);
    const attempted = AREAS.reduce((sum, name) => sum + record.areas[name].attempted, 0);
    const total = AREAS.reduce((sum, name) => sum + record.areas[name].total, 0);
    return correct === record.score && attempted === record.attempted && total === record.total;
  }

  function toRecord(result, date) {
    const areas = {};
    for (const name of AREAS) {
      const area = result.areas[name];
      areas[name] = {
        correct: area.correct,
        attempted: area.attempted,
        total: area.total,
        avgSeconds: roundSeconds(area.avgMs),
      };
    }
    return {
      date: date == null ? Date.now() : date,
      mode: result.kind,
      area: result.kind === "mock" ? null : result.area,
      score: result.correct,
      total: result.total,
      attempted: result.attempted,
      time: Math.max(0, Math.round(result.wallMs / 1000)),
      avgSeconds: roundSeconds(result.avgMs),
      areas,
      seed: result.seed >>> 0,
    };
  }

  function copy(record) {
    const areas = {};
    for (const name of AREAS) areas[name] = Object.assign({}, record.areas[name]);
    return {
      date: record.date,
      mode: record.mode,
      area: record.area,
      score: record.score,
      total: record.total,
      attempted: record.attempted,
      time: record.time,
      avgSeconds: record.avgSeconds,
      areas,
      seed: record.seed,
    };
  }

  function read(storage) {
    try {
      storage = storage || globalThis.localStorage;
      const parsed = JSON.parse(storage.getItem(KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(valid).slice(-50).map(copy) : [];
    } catch {
      return [];
    }
  }

  function save(record, storage) {
    try {
      storage = storage || globalThis.localStorage;
      if (!valid(record)) return false;
      storage.setItem(KEY, JSON.stringify(read(storage).concat(copy(record)).slice(-50)));
      return true;
    } catch {
      return false;
    }
  }

  function best(history) {
    return history.filter(record => record.mode === "mock").reduce((winner, record) => {
      if (!winner || record.score > winner.score || (record.score === winner.score && record.time < winner.time)) return record;
      return winner;
    }, null);
  }

  return { KEY, read, save, best, valid, toRecord };
});
