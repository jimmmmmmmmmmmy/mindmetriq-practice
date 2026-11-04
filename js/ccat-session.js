// One forward-only run. The clock is a deadline, not a pauseable timer.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CCATSession = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function formatRemaining(ms) {
    const safe = Math.max(0, Number(ms) || 0);
    const seconds = Math.ceil(safe / 1000);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function blankArea() {
    return { correct: 0, attempted: 0, total: 0, timeMs: 0 };
  }

  function summarize(state) {
    const areas = { math: blankArea(), spatial: blankArea(), verbal: blankArea() };
    for (const item of state.test.items) areas[item.area].total++;
    let timeMs = 0;
    let correct = 0;
    for (const answer of state.answers) {
      const bucket = areas[answer.area];
      bucket.attempted++;
      bucket.timeMs += answer.elapsedMs;
      timeMs += answer.elapsedMs;
      if (answer.correct) {
        bucket.correct++;
        correct++;
      }
    }
    const finish = bucket => ({
      correct: bucket.correct,
      attempted: bucket.attempted,
      total: bucket.total,
      timeMs: bucket.timeMs,
      avgMs: bucket.attempted ? bucket.timeMs / bucket.attempted : null,
    });
    const byIndex = new Map(state.answers.map(answer => [answer.index, answer]));
    const missed = [];
    state.test.items.forEach((item, index) => {
      const answer = byIndex.get(index);
      if (!answer || !answer.correct) missed.push({
        number: index + 1,
        reason: answer ? "incorrect" : "unanswered",
        yourChoice: answer ? answer.choice : null,
        item,
      });
    });
    const attempted = state.answers.length;
    return {
      correct,
      total: state.test.items.length,
      attempted,
      timeMs,
      avgMs: attempted ? timeMs / attempted : null,
      areas: { math: finish(areas.math), spatial: finish(areas.spatial), verbal: finish(areas.verbal) },
      missed,
    };
  }

  function createSession(test, options) {
    const settings = options || {};
    if (!test || !Array.isArray(test.items) || !test.items.length) throw new Error("Test has no items");
    if (!Number.isFinite(test.durationMs) || test.durationMs <= 0) throw new Error("Test needs a duration");
    const now = settings.now || Date.now;
    const startedAt = settings.startedAt == null ? now() : settings.startedAt;
    const state = {
      test,
      index: 0,
      selected: null,
      answers: [],
      status: "active",
      expired: false,
      startedAt,
      deadline: startedAt + test.durationMs,
      questionStartedAt: startedAt,
      finishedAt: null,
    };

    function commit(choice, at, auto) {
      const item = state.test.items[state.index];
      state.answers.push({
        index: state.index,
        choice,
        correct: choice === item.answer,
        elapsedMs: Math.max(0, at - state.questionStartedAt),
        area: item.area,
        type: item.type,
        auto: !!auto,
      });
      state.selected = null;
      state.index += 1;
      state.questionStartedAt = at;
    }

    function expire() {
      if (state.status !== "active") return;
      const at = state.deadline;
      if (state.selected != null && state.index < state.test.items.length) commit(state.selected, at, true);
      state.status = "complete";
      state.expired = true;
      state.finishedAt = at;
      state.selected = null;
    }

    function select(choice, t) {
      const time = t == null ? now() : t;
      if (state.status === "active" && time >= state.deadline) {
        expire();
        return { ok: false, reason: "timeout" };
      }
      if (state.status !== "active") return { ok: false, reason: "complete" };
      if (!Number.isInteger(choice) || choice < 0 || choice > 4) return { ok: false, reason: "bad-choice" };
      state.selected = choice;
      return { ok: true };
    }

    function advance(t) {
      const time = t == null ? now() : t;
      if (state.status === "active" && time >= state.deadline) {
        expire();
        return { ok: true, reason: "timeout" };
      }
      if (state.status !== "active") return { ok: false, reason: "complete" };
      if (state.selected == null) return { ok: false, reason: "need-answer" };
      commit(state.selected, time, false);
      if (state.index >= state.test.items.length) {
        state.status = "complete";
        state.expired = false;
        state.finishedAt = time;
      }
      return { ok: true };
    }

    function view(t) {
      const time = t == null ? now() : t;
      if (state.status === "active" && time >= state.deadline) expire();
      const mark = state.status === "complete" ? state.finishedAt : time;
      return {
        status: state.status,
        index: state.index,
        number: Math.min(state.index, state.test.items.length - 1) + 1,
        total: state.test.items.length,
        selected: state.selected,
        timeLeftMs: Math.max(0, state.deadline - mark),
        expired: state.expired,
        item: state.status === "active" ? state.test.items[state.index] : null,
        canAdvance: state.status === "active" && state.selected != null,
        canGoBack: false,
        canPause: false,
      };
    }

    function result() {
      if (state.status !== "complete") throw new Error("The run is still going");
      return Object.assign(summarize(state), {
        seed: state.test.seed,
        kind: state.test.kind,
        area: state.test.area,
        expired: state.expired,
        wallMs: state.finishedAt - state.startedAt,
        startedAt: state.startedAt,
        finishedAt: state.finishedAt,
        durationMs: state.test.durationMs,
      });
    }

    return { select, advance, tick: view, view, score: () => summarize(state), result };
  }

  return { createSession, formatRemaining };
});
