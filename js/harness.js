// Shared run lifecycle, deadlines, adaptive difficulty and scoring.
const H = (() => {
  const $ = s => document.querySelector(s);
  let G, mode, idx, level, results, tItemStart, limit = 0, raf, itemDone = true, nextTimer, runStart, itemLevel, helpPage = 0, currentItem, retrying = false, expiring = false;
  const fmt = s => { s = Math.round(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const MODES = g => ({
    test: { label: "Timed test", n: g.items, timer: 1, start: 2, feedback: false, desc: `${g.items} questions · ${g.timerText} · adaptive difficulty` },
    practice: { label: "Practice round", n: g.practiceItems || 3, timer: 1, start: 1, feedback: true, desc: `${g.practiceItems || 3} questions with feedback after each answer` },
    hard: { label: "Hard drill", n: g.items, timer: 0.75, start: 4, feedback: false, desc: `${g.items} questions · 25% less time · starts at the hardest levels` },
  });
  function init(game) {
    G = game;
    document.body.className = "game-" + G.id;
    document.title = G.title + " practice";
    document.documentElement.style.setProperty("--accent", G.accent);
    document.documentElement.style.setProperty("--bg", {net:"#f9f5f5",racer:"#f9f5f5",swipe:"#f5f7f3",wordlogic:"#f5f7f3",pipes:"#eaf0f3",spinner:"#eaf0f3"}[G.id]);
    const ms = MODES(G);
    $("#app").innerHTML = `
    <section class="screen on" id="sIntro"><div class="pad">
      <a class="back" href="index.html">&larr; All games</a>
      <div class="intro-hero">${MMQDemo.art(G.id)}<div class="cat"><i></i>${G.cat}</div><h1>${G.title}</h1><p class="language-note">English practice</p></div>
      <button class="btn intro-instructions" id="instructions">Instructions <span aria-hidden="true">→</span></button>
      <div class="modes">${Object.entries(ms).map(([k, m]) => `<button class="btn ${k === "practice" ? "primary" : ""}" data-mode="${k}">${m.label}<small>${m.desc}</small></button>`).join("")}</div>
      <details class="rules intro-rules"><summary>Quick rules</summary>${G.rules}</details>
      <div class="hist" id="histIntro"></div>
      <div class="note">Unofficial practice mock. Fresh puzzles and curated word relationships. Timings and scores are for this practice app.</div>
    </div></section>
    <section class="screen" id="sHelp" aria-label="Game instructions"></section>
    <section class="screen" id="sGame">
      <div class="game-header"><div class="tbar"><div id="hBar"></div></div><div class="hud"><span><b id="hNum">1</b> <span style="opacity:.6">of <span id="hTot">12</span></span></span><span class="ttl" id="hMode"></span><span id="hTime"></span></div>
      </div><div id="gameAnnouncements" class="sr-only" role="status" aria-live="polite"></div>
      <div id="stage"></div>
      <div class="flash" id="flash"><span></span></div>
      <div class="foot" id="foot"></div><div class="foot practice-actions" id="practiceActions" hidden></div>
    </section>
    <section class="screen" id="sEnd"><div class="pad" id="endBody"></div></section>`;
    document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => start(b.dataset.mode));
    $("#instructions").onclick = () => { helpPage = 0; help(); };
    showHist("#histIntro");
    G.setup($("#stage"), $("#foot"));
    window.addEventListener("keydown", e => { if ($("#sGame").classList.contains("on") && accepting() && G.key) { if (G.key(e) !== false && ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault(); } });
  }
  function show(id) { document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id)); }
  function help() {
    const pages = MMQDemo.pages[G.id], [title,text,kind] = pages[helpPage];
    const duration = G.id === "racer" ? "5s + falling" : G.perItem + " seconds";
    const illustration = kind === "keys" ? `<div class="tutorial-keys">${(G.id === "wordlogic" ? ["↑","↓","Enter","Space"] : G.id === "racer" || G.id === "spinner" ? ["←","→","Enter"] : ["←","↑","↓","→","Enter"]).map(k=>`<kbd>${k}</kbd>`).join("")}</div>` : kind === "duration" ? `<div class="tutorial-duration"><div><b>${G.practiceItems || 3}</b><small>Practice questions</small></div><div><b>${duration}</b><small>Per question</small></div></div>` : `<div class="tutorial-illustration">${MMQDemo.example(G.id,helpPage)}</div>`;
    $("#sHelp").innerHTML = `<div class="tutorial-head"><button class="btn" id="closeHelp">← Menu</button><span>${helpPage+1} of ${pages.length}</span></div><div class="tutorial-body"><h1 tabindex="-1" id="helpTitle">${title}</h1><p>${text}</p>${illustration}</div><div class="tutorial-nav"><button class="btn" id="helpBack" ${helpPage ? "" : "disabled"}>← Back</button><button class="btn primary" id="helpNext">${helpPage===pages.length-1 ? "Start practice →" : "Next →"}</button></div>`;
    $("#closeHelp").onclick = () => show("sIntro");
    $("#helpBack").onclick = () => { if(helpPage) { helpPage--; help(); } };
    $("#helpNext").onclick = () => { if(helpPage===pages.length-1) start("practice"); else { helpPage++; help(); } };
    show("sHelp"); $("#helpTitle").focus({preventScroll:true});
  }
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
    currentItem = structuredClone(item); retrying = false;
    itemLevel = item.level || level;
    limit = G.itemLimit ? G.itemLimit(item) : G.perItem * mode.timer;
    tItemStart = performance.now(); itemDone = false;
    $("#practiceActions").hidden = true; $("#foot").hidden = false; clearTimeout($("#flash")._t); $("#flash").className = "flash";
    G.render(item);
    $("#gameAnnouncements").textContent = `Question ${idx+1} of ${mode.n}. Level ${itemLevel}. ${G.id === "racer" ? "Five seconds to plan the target sum." : Math.round(limit)+" seconds."}`;
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
      $("#hBar").style.width = (100 * Math.min(1,e / limit)) + "%";
      if (left <= 0) { expire(); return; }
    }
    if (G.submitDelay) $("#submit").disabled = e < G.submitDelay * mode.timer;
    if (G.onTick) G.onTick();
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
    if (!retrying) results.push({ correct: !!correct, used, level: itemLevel, info: { ...info }, snapshot });
    else results.at(-1).info.retryCount = (results.at(-1).info.retryCount || 0) + 1;
    const fb = mode.feedback;
    flash(correct ? (fb ? "Correct" : "") : (info.timedOut ? "Time's up" : "Incorrect") + (fb && info.note ? " — " + info.note : ""), correct ? "ok" : "bad", fb ? 0 : 450);
    if (!retrying) { level = Math.max(1, Math.min(5, level + (correct ? 1 : -1))); idx++; }
    if (fb) {
      $("#foot").hidden = true; $("#practiceActions").hidden = false;
      $("#practiceActions").innerHTML = '<button class="btn" id="retryQuestion">Retry</button><button class="btn primary" id="nextQuestion">Continue →</button><small>Practice score uses first attempts. Retries are for learning.</small>';
      $("#nextQuestion").onclick = next;
      $("#retryQuestion").onclick = replay;
      $("#gameAnnouncements").textContent = `${correct ? "Correct" : "Incorrect"}. Practice feedback. Retry this puzzle or continue.`;
    } else nextTimer = setTimeout(next, 500 + (info.delay || 0));
  }
  function replay() {
    retrying = true; itemDone = false;
    const item = structuredClone(currentItem);
    limit = G.itemLimit ? G.itemLimit(item) : G.perItem * mode.timer;
    tItemStart = performance.now();
    $("#practiceActions").hidden = true; $("#foot").hidden = false;
    clearTimeout($("#flash")._t); $("#flash").className = "flash";
    G.render(item); cancelAnimationFrame(raf); tick();
  }
  function flash(t, cls, ms) {
    const f = $("#flash"); if (!t) return; f.className = "flash on " + cls; f.firstChild.textContent = t;
    clearTimeout(f._t); if(ms > 0) f._t = setTimeout(() => f.className = "flash", ms);
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
      ${mode.feedback ? '<p class="note">Practice scores and answer reviews record your first attempt on each puzzle. Retries do not add points.</p>' : ""}
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
  return { init, answer, addTime, elapsed, flash, get mode() { return mode; }, get done() { return !accepting(); }, get canSubmit() { return accepting() && elapsed() >= (G.submitDelay || 0) * mode.timer; }, get remaining() { return Math.max(0,limit-elapsed()); } };
})();
