// Full-mock order and local session. Section lengths follow the public overviews.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMQBattery = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const order = Object.freeze([
    { id: "insights", href: "numerical-insights.html", title: "Numerical Insights", items: 15, minutes: 15 },
    { id: "net", href: "net-the-numbers.html", title: "Net the Numbers", items: 12, minutes: 4 },
    { id: "racer", href: "number-racer.html", title: "Number Racer", items: 12, minutes: 6 },
    { id: "swipe", href: "link-swipe.html", title: "Link Swipe", items: 15, minutes: 6 },
    { id: "wordlogic", href: "word-logic.html", title: "Word Logic", items: 15, minutes: 6 },
    { id: "pipes", href: "pipe-puzzle.html", title: "Pipe Puzzle", items: 10, minutes: 4 },
    { id: "spinner", href: "shape-spinner.html", title: "Shape Spinner", items: 10, minutes: 4 }
  ]);
  const CURRENT = "mmq_battery_current";
  const HIST = "mmq_battery_hist";
  const questions = order.reduce((sum, section) => sum + section.items, 0);
  const minutes = order.reduce((sum, section) => sum + section.minutes, 0);

  function memory(storage) { return storage || globalThis.localStorage; }
  function validSection(section, index) {
    const expected = order[index];
    return !!expected && section && section.id === expected.id && section.total === expected.items &&
      Number.isInteger(section.score) && section.score >= 0 && section.score <= section.total &&
      Number.isFinite(section.time) && section.time >= 0 && section.time <= 24 * 60 * 60 &&
      Number.isFinite(section.date) && section.date > 0;
  }
  function summarize(sections) {
    const score = sections.reduce((sum, section) => sum + section.score, 0);
    const total = sections.reduce((sum, section) => sum + section.total, 0);
    const time = sections.reduce((sum, section) => sum + section.time, 0);
    return {
      score, total, time,
      acc: total ? Math.round(100 * score / total) : 0,
      meanResponse: total ? time / total : 0,
      sections
    };
  }
  function readSession(storage) {
    try {
      const raw = JSON.parse(memory(storage).getItem(CURRENT) || "null");
      if (!raw || !Number.isInteger(raw.index) || raw.index < 0 || raw.index > order.length) return null;
      if (!Array.isArray(raw.sections) || raw.sections.length !== raw.index) return null;
      if (!raw.sections.every(validSection)) return null;
      return { started: Number(raw.started) || Date.now(), index: raw.index, sections: raw.sections };
    } catch { return null; }
  }
  function history(storage) {
    try {
      const saved = JSON.parse(memory(storage).getItem(HIST) || "[]");
      if (!Array.isArray(saved)) return [];
      return saved.filter(run => run && Array.isArray(run.sections) && run.sections.length === order.length &&
        run.sections.every(validSection) && Number.isFinite(run.date)).slice(-20).map(run => ({
          ...summarize(run.sections), date: run.date
        }));
    } catch { return []; }
  }
  function write(storage, key, value) {
    try { memory(storage).setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable. */ }
  }
  function begin(storage) {
    const session = { started: Date.now(), index: 0, sections: [] };
    write(storage, CURRENT, session);
    return session;
  }
  function clear(storage) {
    try { memory(storage).removeItem(CURRENT); } catch { /* ignore */ }
  }
  function record(id, rec, storage) {
    const session = readSession(storage);
    if (!session || session.index >= order.length || order[session.index].id !== id) return null;
    if (!rec || rec.total !== order[session.index].items || !Number.isInteger(rec.score) || rec.score < 0 || rec.score > rec.total) return null;
    const section = {
      id, score: rec.score, total: rec.total,
      time: Number.isFinite(rec.time) ? rec.time : 0,
      date: Number.isFinite(rec.date) ? rec.date : Date.now()
    };
    session.sections.push(section);
    session.index += 1;
    if (session.index >= order.length) {
      const summary = { ...summarize(session.sections), date: Date.now() };
      write(storage, HIST, [...history(storage), summary].slice(-20));
      clear(storage);
      return { done: true, summary };
    }
    write(storage, CURRENT, session);
    return { done: false, session };
  }
  function gate(id, storage) {
    const session = readSession(storage);
    if (!session) return { action: "redirect", href: "mock.html" };
    if (session.index >= order.length) return { action: "redirect", href: "mock.html?results=1" };
    const section = order[session.index];
    if (section.id !== id) return { action: "redirect", href: `${section.href}?battery=1` };
    return { action: "ok", index: session.index, count: order.length, title: section.title, minutes: section.minutes, items: section.items };
  }
  function nextHref(storage) {
    const session = readSession(storage);
    if (!session || session.index >= order.length) return "mock.html?results=1";
    return `${order[session.index].href}?battery=1`;
  }
  return { order, questions, minutes, begin, clear, record, gate, nextHref, history, readSession, summarize };
});
