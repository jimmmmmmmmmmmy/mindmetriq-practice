(function () {
  const AREA_LABEL = { math: "Math & logic", spatial: "Spatial", verbal: "Verbal" };
  const TYPE_LABEL = {
    word: "Arithmetic",
    ratio: "Ratio",
    percent: "Percent",
    syllogism: "Deductive logic",
    matrix: "Matrix",
    odd: "Odd one out",
    analogy: "Analogy",
    lexical: "Vocabulary",
    cloze: "Sentence completion",
    detail: "Attention to detail",
  };
  const $ = id => document.getElementById(id);
  let session = null;
  let test = null;
  let timer = 0;
  let saved = false;

  function typeLabel(item) {
    if (item.area === "spatial" && item.type === "series") return "Shape series";
    if (item.type === "series") return "Number series";
    return TYPE_LABEL[item.type] || item.type;
  }

  function show(id) {
    document.querySelectorAll(".screen").forEach(screen => screen.classList.toggle("on", screen.id === id));
  }

  function pace() {
    const value = Math.round(Number($("pace").value));
    return Number.isInteger(value) && value >= 8 && value <= 90 ? value : 18;
  }

  function freshSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function historyHtml(rows) {
    if (!rows.length) return "";
    const body = rows.slice(-8).reverse().map(row => {
      const label = row.mode === "mock" ? "Full mock" : AREA_LABEL[row.area] + " drill";
      const when = new Date(row.date).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      const avg = row.avgSeconds == null ? "—" : row.avgSeconds.toFixed(1) + "s";
      return `<tr><td>${esc(when)}</td><td>${esc(label)}</td><td>${row.score}/${row.total}</td><td>${row.attempted} answered</td><td>${avg}</td></tr>`;
    }).join("");
    return `<h2>Your runs</h2><p class="note">The line is percent correct. Mocks are out of 50 and drills are out of 10.</p>${spark(rows)}<table class="rev"><tbody>${body}</tbody></table>`;
  }

  function spark(rows) {
    if (rows.length < 2) return "";
    const width = 280;
    const height = 56;
    const pad = 6;
    const points = rows.map((row, index) => {
      const x = pad + index * (width - pad * 2) / (rows.length - 1);
      const y = height - pad - (row.score / row.total) * (height - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return `<svg class="trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Percent correct across saved runs"><polyline points="${points}" /></svg>`;
  }

  function renderIntro() {
    $("histIntro").innerHTML = historyHtml(CCATHistory.read());
  }

  function start(kind, area, seed) {
    clearInterval(timer);
    saved = false;
    const options = { kind, seed: seed == null ? freshSeed() : seed };
    if (kind === "drill") {
      options.area = area;
      options.secondsPerQuestion = pace();
    }
    try {
      test = CCATItems.buildTest(options);
    } catch (error) {
      console.error(error);
      $("histIntro").insertAdjacentHTML("afterbegin", "<p class=\"note\">Could not build that set. Try again.</p>");
      return;
    }
    session = CCATSession.createSession(test, { now: () => performance.now() });
    $("hTot").textContent = String(test.items.length);
    $("hMode").textContent = kind === "drill" ? AREA_LABEL[area] : "Full mock";
    show("sRun");
    renderQuestion();
    timer = setInterval(tick, 200);
    tick();
  }

  function tick() {
    if (!session) return;
    const view = session.tick(performance.now());
    $("hTime").textContent = CCATSession.formatRemaining(view.timeLeftMs);
    const used = test.durationMs ? 1 - view.timeLeftMs / test.durationMs : 0;
    $("hBar").style.width = Math.max(0, Math.min(100, used * 100)) + "%";
    if (view.status === "complete") finish();
  }

  function mountStimulus(container, stimulus, withBlank) {
    container.replaceChildren();
    if (!stimulus) return;
    if (stimulus.kind === "series") CCATSvg.renderFrames(container, stimulus.frames, withBlank);
    else if (stimulus.kind === "matrix") CCATSvg.renderMatrix(container, stimulus.cells);
    else if (stimulus.kind === "code") {
      const code = document.createElement("p");
      code.className = "code";
      code.textContent = stimulus.text;
      container.append(code);
    } else if (stimulus.kind === "pair") {
      const pair = document.createElement("div");
      pair.className = "pair";
      for (const text of [stimulus.left, stimulus.right]) {
        const code = document.createElement("p");
        code.className = "code";
        code.textContent = text;
        pair.append(code);
      }
      container.append(pair);
    }
  }

  function renderQuestion() {
    const view = session.view(performance.now());
    if (view.status !== "active") return finish();
    $("hNum").textContent = String(view.number);
    $("qArea").textContent = AREA_LABEL[view.item.area] + " · " + typeLabel(view.item);
    $("qPrompt").textContent = view.item.prompt;
    mountStimulus($("qStim"), view.item.stimulus, true);
    const group = $("qChoices");
    group.classList.toggle("figures", view.item.choices.some(choice => choice.figure));
    group.replaceChildren();
    view.item.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = "ABCDE"[index];
      button.append(letter);
      if (choice.figure) {
        button.append(CCATSvg.renderFigure(choice.figure, 48));
        button.setAttribute("aria-label", "Choice " + "ABCDE"[index]);
      } else {
        const text = document.createElement("span");
        text.className = "choice-text";
        text.textContent = choice.text;
        button.append(text);
      }
      button.addEventListener("click", () => choose(index));
      group.append(button);
    });
    $("next").disabled = true;
    $("live").textContent = `Question ${view.number} of ${view.total}. ${AREA_LABEL[view.item.area]}.`;
    $("qPrompt").focus({ preventScroll: true });
  }

  function choose(index) {
    if (!session) return;
    const response = session.select(index, performance.now());
    if (!response.ok) {
      if (session.view(performance.now()).status === "complete") finish();
      return;
    }
    document.querySelectorAll("#qChoices .choice").forEach((button, buttonIndex) => {
      const on = buttonIndex === index;
      button.classList.toggle("sel", on);
      button.setAttribute("aria-checked", String(on));
    });
    $("next").disabled = false;
  }

  function nextQuestion() {
    if (!session) return;
    $("next").disabled = true;
    const response = session.advance(performance.now());
    if (!response.ok) {
      $("next").disabled = session.view(performance.now()).selected == null;
      return;
    }
    if (session.view(performance.now()).status === "complete") finish();
    else renderQuestion();
  }

  function finish() {
    if (saved || !session) return;
    const view = session.tick(performance.now());
    if (view.status !== "complete") return;
    saved = true;
    clearInterval(timer);
    const outcome = session.result();
    CCATHistory.save(CCATHistory.toRecord(outcome));
    renderEnd(outcome);
    show("sEnd");
  }

  function reviewBlock(miss, index) {
    const yours = miss.yourChoice == null ? "No answer submitted" : "Your answer: " + "ABCDE"[miss.yourChoice];
    const state = miss.reason === "unanswered" ? "Not answered" : "Incorrect";
    return `<details class="miss" id="miss-${index}"${index === 0 ? " open" : ""}><summary>Question ${miss.number} · ${esc(AREA_LABEL[miss.item.area])} · ${esc(typeLabel(miss.item))} · ${state}</summary><p class="prompt">${esc(miss.item.prompt)}</p><div class="stim" id="miss-stim-${index}"></div><div class="review-choices" id="miss-choices-${index}"></div><p class="because">${esc(miss.item.explanation)}</p><p class="meta">${esc(yours)}</p></details>`;
  }

  function mountReview(miss, index) {
    mountStimulus($("miss-stim-" + index), miss.item.stimulus, false);
    const box = $("miss-choices-" + index);
    miss.item.choices.forEach((choice, choiceIndex) => {
      const row = document.createElement("div");
      row.className = "review-choice";
      if (choiceIndex === miss.item.answer) row.classList.add("correct");
      if (choiceIndex === miss.yourChoice) row.classList.add("yours");
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = "ABCDE"[choiceIndex];
      row.append(letter);
      if (choice.figure) row.append(CCATSvg.renderFigure(choice.figure, 44));
      else {
        const text = document.createElement("span");
        text.className = "choice-text";
        text.textContent = choice.text;
        row.append(text);
      }
      const tags = [];
      if (choiceIndex === miss.item.answer) tags.push("Correct");
      if (choiceIndex === miss.yourChoice) tags.push("Yours");
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = tags.join(" · ");
      row.append(tag);
      box.append(row);
    });
  }

  function renderEnd(outcome) {
    const areaRows = ["math", "spatial", "verbal"].filter(name => outcome.areas[name].total).map(name => {
      const area = outcome.areas[name];
      const accuracy = area.attempted ? Math.round(100 * area.correct / area.attempted) + "% of answered" : "—";
      const avg = area.avgMs == null ? "—" : (area.avgMs / 1000).toFixed(1) + "s";
      return `<tr><th scope="row">${esc(AREA_LABEL[name])}</th><td>${area.correct} / ${area.total}</td><td>${area.attempted}</td><td>${accuracy}</td><td>${avg}</td></tr>`;
    }).join("");
    const review = outcome.missed.length
      ? outcome.missed.map(reviewBlock).join("")
      : "<p>Every question was answered correctly.</p>";
    const avg = outcome.avgMs == null ? "—" : (outcome.avgMs / 1000).toFixed(1) + "s";
    $("endBody").innerHTML = `<a class="back" href="index.html">← All games</a>
      <div class="cat"><i></i>Cognitive</div><h1>Aptitude Mock</h1>
      <h2>${outcome.expired ? "Time is up" : "Finished"}</h2>
      <div class="stat">
        <div><b id="endScore">${outcome.correct} / ${outcome.total}</b><span>Score</span></div>
        <div><b id="endAttempted">${outcome.attempted}</b><span>Answered</span></div>
        <div><b>${esc(CCATSession.formatRemaining(outcome.wallMs))}</b><span>Time used</span></div>
        <div><b id="endAvg">${avg}</b><span>Average per answered question</span></div>
      </div>
      <p class="note">Score counts correct answers out of every question on the run. Unanswered questions are misses. Accuracy in the table is correct divided by the questions you answered in that area.</p>
      <table class="level"><caption>By area</caption><thead><tr><th scope="col">Area</th><th scope="col">Correct</th><th scope="col">Answered</th><th scope="col">Accuracy</th><th scope="col">Avg time</th></tr></thead><tbody>${areaRows}</tbody></table>
      <h2>Missed questions</h2>
      <div id="review">${review}</div>
      <div class="modes end-actions"><button class="btn primary" id="again" type="button">New set</button><button class="btn" id="same" type="button">Same questions</button><button class="btn" id="menu" type="button">Back to menu</button></div>
      <div id="histEnd"></div>
      <p class="note">Unofficial practice set ${outcome.seed}. Generated in this browser. Not a Criteria or CCAT item.</p>`;
    outcome.missed.forEach(mountReview);
    $("histEnd").innerHTML = historyHtml(CCATHistory.read());
    $("again").onclick = () => start(outcome.kind, outcome.area, null);
    $("same").onclick = () => start(outcome.kind, outcome.area, outcome.seed);
    $("menu").onclick = () => { renderIntro(); show("sIntro"); };
  }

  $("startMock").addEventListener("click", () => start("mock"));
  document.querySelectorAll("[data-area]").forEach(button => {
    button.addEventListener("click", () => start("drill", button.dataset.area));
  });
  $("next").addEventListener("click", nextQuestion);
  document.addEventListener("keydown", event => {
    if (!$("sRun").classList.contains("on") || !session) return;
    if (event.key >= "1" && event.key <= "5") {
      choose(Number(event.key) - 1);
      event.preventDefault();
    } else if (event.key === "Enter" && !$("next").disabled) {
      nextQuestion();
      event.preventDefault();
    }
  });
  document.addEventListener("visibilitychange", () => { if (session && !saved) tick(); });
  renderIntro();
  if (new URLSearchParams(location.search).has("debug")) {
    window.__ccat = {
      get session() { return session; },
      get test() { return test; },
    };
  }
})();
