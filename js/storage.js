// Treat localStorage as untrusted input. Practice scores are local, not verified rankings.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMQHistory = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const modes = new Set(["test", "practice", "hard"]);
  function valid(r) {
    return r && modes.has(r.mode) && Number.isInteger(r.total) && r.total > 0 && r.total <= 15 &&
      Number.isInteger(r.score) && r.score >= 0 && r.score <= r.total &&
      Number.isFinite(r.time) && r.time >= 0 && Number.isFinite(r.date) && r.date > 0 && r.date <= 8640000000000000;
  }
  function read(id, storage) {
    try {
      storage = storage || globalThis.localStorage;
      const h = JSON.parse(storage.getItem("mmq_hist_" + id) || "[]");
      return Array.isArray(h) ? h.filter(valid).slice(-50).map(r => ({
        ...r, acc: Math.round(100 * r.score / r.total)
      })) : [];
    } catch { return []; }
  }
  function save(id, record, storage) {
    try {
      storage = storage || globalThis.localStorage;
      if (!valid(record)) return;
      storage.setItem("mmq_hist_" + id, JSON.stringify([...read(id, storage), record].slice(-50)));
    } catch { /* Games still work if browser storage is disabled or full. */ }
  }
  function best(history, mode = "test") {
    return history.filter(r => r.mode === mode).reduce((b, r) =>
      !b || r.score / r.total > b.score / b.total ||
      (r.score / r.total === b.score / b.total && r.time < b.time) ? r : b, null);
  }
  return { read, save, best };
});
