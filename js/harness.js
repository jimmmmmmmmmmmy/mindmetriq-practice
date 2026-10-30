// Shared run lifecycle, deadlines, adaptive difficulty and scoring.
const H = (() => {
  const $ = s => document.querySelector(s);
  let G, mode, idx, level, results, tItemStart, limit = 0, raf, itemDone = true, nextTimer, runStart, itemLevel, expiring = false;
  const fmt = s => { s = Math.round(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const MODES = g => ({
    test: { label: "Timed test", n: g.items, timer: 1, start: 2, feedback: false, desc: `${g.items} questions · ${g.timerText} · adaptive difficulty` },
    practice: { label: "Practice round", n: 3, timer: 1, start: 1, feedback: true, desc: "3 questions with feedback after each answer" },
    hard: { label: "Hard drill", n: g.items, timer: 0.75, start: 4, feedback: false, desc: `${g.items} questions · 25% less time · starts at the hardest levels` },
  });
  function init(game) {
    G = game;
    document.title = G.title + " practice";
    document.documentElement.style.setProperty("--accent", G.accent);
    if (G.bg) document.documentElement.style.setProperty("--bg", G.bg);
    const ms = MODES(G);
    $("#app").innerHTML = `
    <section class="screen on" id="sIntro"><div class="pad">
      <a class="back" href="index.html">&larr; All games</a>
      <div style="height:24px"></div>
      <div class="cat"><i></i>${G.cat}</div><h1>${G.title}</h1>
      <div class="rules">${G.rules}</div>
      <div class="modes">${Object.entries(ms).map(([k, m]) => `<button class="btn ${k === "test" ? "primary" : ""}" data-mode="${k}">${m.label}<small>${m.desc}</small></button>`).join("")}</div>
      <div class="hist" id="histIntro"></div>
      <div class="note">Unofficial practice mock. Fresh puzzles and curated word relationships. Timings and scores are for this practice app.</div>
    </div></section>
    <section class="screen" id="sGame">
      <div class="hud"><span><b id="hNum">1</b> <span style="opacity:.6">of <span id="hTot">12</span></span></span><span class="ttl" id="hMode"></span><span id="hTime"></span></div>
      <div class="tbar"><div id="hBar"></div></div>
      <div id="stage"></div>
      <div class="flash" id="flash"><span></span></div>
      <div class="foot" id="foot"></div>
    </section>
    <section class="screen" id="sEnd"><div class="pad" id="endBody"></div></section>`;
    document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => start(b.dataset.mode));
    showHist("#histIntro");
    G.setup($("#stage"), $("#foot"));
    window.addEventListener("keydown", e => { if ($("#sGame").classList.contains("on") && accepting() && G.key) { if (G.key(e) !== false && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault(); } });
  }
  function show(id) { document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id)); }
  function start(m) {
    clearTimeout(nextTimer); cancelAnimationFrame(raf);
    if (G.stop) G.stop();
    mode = Object.assign({ key: m }, MODES(G)[m]); idx = 0; level = mode.start; results = []; runStart = performance.now();
    $("#hTot").textContent = mode.n; $("#hMode").textContent = m === "practice" ? "Practice" : m === "hard" ? "Hard drill" : G.title;
    if (G.onStart) G.onStart(mode);
    show("sGame"); next();
  }
  function next() {
    if (idx >= mode.n) return end();
    $("#hNum").textContent = idx + 1;
    itemDone = true;
    let item;
    try { item = G.newItem(level); } catch (error) {
      console.error(error);
      $("#endBody").innerHTML = '<h2>Puzzle generation failed</h2><p>Your run was not saved. Please start a fresh run.</p><button class="btn" id="retry">Back to menu</button>';
      $("#retry").onclick = () => show("sIntro"); show("sEnd"); return;
    }
    itemLevel = item.level || level;
    limit = G.itemLimit ? G.itemLimit(item) : G.perItem * mode.timer;
    tItemStart = performance.now(); itemDone = false;
    G.render(item);
    cancelAnimationFrame(raf); tick();
  }
  function elapsed() { return (performance.now() - tItemStart) / 1000; }
  function expire() {
    if (itemDone || expiring) return;
    expiring = true;
    try {
      const r = G.timeout ? G.timeout() : { correct: false, note: "Time ran out" };
      recordAnswer(r.correct, { ...r, timedOut: true });
    } finally { expiring = false; }
  }
  function accepting() {
    if (itemDone || expiring) return false;
    if (limit && elapsed() >= limit) { expire(); return false; }
    return true;
  }
  function tick() {
    if (itemDone) return;
    const e = elapsed();
    if (limit) {
      const left = Math.max(0, limit - e);
      $("#hTime").textContent = Math.ceil(left);
      $("#hBar").style.width = (100 * left / limit) + "%";
      if (left <= 0) { expire(); return; }
    }
    raf = requestAnimationFrame(tick);
  }
  function addTime(s) { if (!accepting() || !Number.isFinite(s) || s <= 0) return false; limit += s; return true; }
  function answer(correct, info = {}) {
    if (!accepting()) return false;
    recordAnswer(correct, info);
    return true;
  }
  function recordAnswer(correct, info) {
    itemDone = true; cancelAnimationFrame(raf);
    if (G.stop) G.stop();
    const used = Math.min(elapsed(), limit || 1e9);
    const snapshot = structuredClone(G.snapshot(info));
    results.push({ correct: !!correct, used, level: itemLevel, info: { ...info }, snapshot });
    const fb = mode.feedback;
    flash(correct ? (fb ? "Correct" : "") : (info.timedOut ? "Time's up" : "Incorrect") + (fb && info.note ? " — " + info.note : ""), correct ? "ok" : "bad", fb ? (correct ? 900 : 2600) : 450);
    level = Math.max(1, Math.min(5, level + (correct ? 1 : -1)));
    idx++;
    nextTimer = setTimeout(next, (fb ? (correct ? 950 : 2700) : 500) + (info.delay || 0));
  }
  function flash(t, cls, ms) {
    const f = $("#flash"); if (!t) return; f.className = "flash on " + cls; f.firstChild.textContent = t;
    clearTimeout(f._t); f._t = setTimeout(() => f.className = "flash", ms);
  }
  function hist() { return MMQHistory.read(G.id); }
  function showHist(sel) {
    const h = hist(); const el = document.querySelector(sel); if (!el) return;
    if (!h.length) { el.innerHTML = ""; return; }
    const best = MMQHistory.best(h);
    el.innerHTML = `<h2 style="font-size:18px;margin-top:18px">Your history</h2>` +
      (best ? `<div>Best timed test: <b>${best.score}/${best.total}</b> (${best.mode}, ${new Date(best.date).toLocaleDateString()})</div>` : "") +
      `<table class="rev">${h.slice(-5).reverse().map(r => `<tr><td>${new Date(r.date).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td>${r.mode}</td><td>${r.score}/${r.total}</td><td>${r.acc}%</td><td>${fmt(r.time)}</td></tr>`).join("")}</table>`;
  }
  function end() {
    const summary = MMQResults.summarize(results), guidance = MMQResults.feedback(summary, G.id);
    const { total: n, correct: c, time } = summary, wall = (performance.now() - runStart) / 1000;
    const escape = MMQReview.escape;
    const rec = { date: Date.now(), mode: mode.key, score: c, total: n, acc: Math.round(100 * c / n), time: Math.round(time), maxLevel: summary.maxLevel };
    MMQHistory.save(G.id, rec);
    $("#endBody").innerHTML = `<a class="back" href="index.html">&larr; All games</a><div style="height:14px"></div>
      <div class="cat"><i></i>${G.cat}</div><h1>${G.title}</h1><h2>Finished</h2>
      <div class="stat">
        <div><b id="endScore">${c} / ${n}</b><span>Score (correct)</span></div>
        <div><b id="endAcc">${rec.acc}%</b><span>Accuracy</span></div>
        <div><b>${fmt(time)}</b><span>Time used on questions</span></div>
        <div><b>${(time / n).toFixed(1)}s</b><span>Average per question</span></div>
        <div><b>${summary.points} / ${summary.possible}</b><span>Practice points</span></div>
        <div><b>${rec.maxLevel} / 5</b><span>Highest level reached</span></div>
      </div>
      <section class="result-section run-feedback" aria-label="Practice feedback">
        <b>${escape(guidance.focus)}</b><p>${escape(guidance.observation)}</p><p>${escape(guidance.strategy)}</p>
        <p>${c === n ? "Open a question below to check the reasoning." : "The first missed question is open below. Compare your answer with the highlighted solution."}</p>
      </section>
      <section class="result-section" aria-labelledby="difficultyTitle"><h2 id="difficultyTitle">Accuracy by difficulty</h2>
      <table class="level-table"><caption>Average level ${summary.meanLevel.toFixed(1)} / 5. These are this app's practice tiers.</caption>
      <thead><tr><th scope="col">Level</th><th scope="col">Correct</th><th scope="col">Accuracy</th><th scope="col">Avg time</th></tr></thead>
      <tbody>${summary.levels.map(r => `<tr><th scope="row">${r.level}</th><td>${r.correct} / ${r.total}</td><td>${r.total ? Math.round(100*r.correct/r.total)+"%" : "—"}</td><td>${r.total ? (r.used/r.total).toFixed(1)+"s" : "—"}</td></tr>`).join("")}</tbody></table>
      <p>${escape(guidance.difficulty)}</p></section>
      <section class="result-section" aria-labelledby="answerTitle"><h2 id="answerTitle">Review your answers</h2>
        <p>Open any question. Switch between your submitted answer and the solution.</p>
        <div id="answerReviews">${MMQReview.list(G.id, results)}</div>
      </section>
      <details class="methodology"><summary>How to read your score</summary>
        <p><b>In this app:</b> each correct answer earns one point. Time is reported separately, with no speed bonus. Practice points add the difficulty level of each correct answer; the maximum is the sum of the levels you received.</p>
        <p>A correct answer raises the next requested level by one; a miss lowers it by one, within levels 1–5. The table records the actual tier of each question. Tiers are authored for practice and have not been statistically calibrated.</p>
        <p><b>Published MindmetriQ methodology:</b> calibrated Rasch scoring considers item difficulty; official percentiles depend on comparison groups. Adaptive selection targets roughly 70% correct. This is a design target, not a pass mark or percentile. Our raw scores and practice points cannot be converted to official results.</p>
        <p>Sources: <a href="https://www.testpartnership.com/fact-sheets/MindmetriQ-Technical-Manual.pdf#page=29" target="_blank" rel="noopener">Technical manual: scoring, adaptive targeting and norms</a> · <a href="https://www.testpartnership.com/gamified-assessment.html" target="_blank" rel="noopener">Published game tasks</a></p>
      </details>
      <div class="modes" style="margin-top:16px"><button class="btn primary" id="again">Play again (${mode.label})</button><button class="btn" id="menu">Back to menu</button></div>
      <div class="hist" id="histEnd"></div><div class="note">Wall-clock time including feedback: ${fmt(wall)}</div>`;
    MMQReview.bind($("#answerReviews"), G.id, results);
    $("#again").onclick = () => start(mode.key);
    $("#menu").onclick = () => { showHist("#histIntro"); show("sIntro"); };
    showHist("#histEnd");
    show("sEnd");
    window.__lastResult = rec;
  }
  return { init, answer, addTime, elapsed, flash, get mode() { return mode; }, get done() { return !accepting(); } };
})();
