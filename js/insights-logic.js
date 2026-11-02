// Original numerical-insights items. Figures are generated; nothing is copied from a publisher bank.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMQInsights = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TOPICS = [
    { place: "Northwharf depot", unit: "crates", series: ["Road", "Rail", "Barge"], periods: ["Week 1", "Week 2", "Week 3", "Week 4"] },
    { place: "Keel market", unit: "bookings", series: ["Food", "Craft", "Plants"], periods: ["Fri", "Sat", "Sun", "Mon"] },
    { place: "Lumen clinic", unit: "visits", series: ["Nurse", "Doctor", "Lab"], periods: ["Mon", "Tue", "Wed", "Thu"] },
    { place: "Birch library", unit: "loans", series: ["Adult", "Child", "Audio"], periods: ["Jan", "Feb", "Mar", "Apr"] },
    { place: "Harbour ferry", unit: "passengers", series: ["East", "West", "Night"], periods: ["06:00", "09:00", "12:00", "15:00"] },
    { place: "Orchard press", unit: "copies", series: ["Daily", "Weekly", "Special"], periods: ["Q1", "Q2", "Q3", "Q4"] },
    { place: "Red kiln", unit: "tiles", series: ["Glazed", "Plain", "Mosaic"], periods: ["Shift A", "Shift B", "Shift C", "Shift D"] },
    { place: "Moor arrays", unit: "MWh", series: ["North", "South", "Spare"], periods: ["Jan", "Feb", "Mar", "Apr"] }
  ];

  function evaluate(check) {
    if (!check || typeof check.op !== "string") throw new TypeError("Missing check");
    let value;
    switch (check.op) {
      case "read": value = check.values[check.index]; break;
      case "diff": value = check.a - check.b; break;
      case "sum": value = check.values.reduce((sum, n) => sum + n, 0); break;
      case "avg": {
        const total = check.values.reduce((sum, n) => sum + n, 0);
        if (total % check.values.length) throw new Error("Average is not an integer");
        value = total / check.values.length;
        break;
      }
      case "share":
        if (!check.total || (check.part * 100) % check.total) throw new Error("Share is not an integer percent");
        value = check.part * 100 / check.total;
        break;
      case "change":
        if (!check.from || ((check.to - check.from) * 100) % check.from) throw new Error("Change is not an integer percent");
        value = (check.to - check.from) * 100 / check.from;
        break;
      case "increaseAdd":
        if ((check.base * (100 + check.pct)) % 100) throw new Error("Increased base is not an integer");
        value = check.base * (100 + check.pct) / 100 + check.extra;
        break;
      case "shareDiff":
        if (!check.total || ((check.a - check.b) * 100) % check.total) throw new Error("Share gap is not an integer");
        value = (check.a - check.b) * 100 / check.total;
        break;
      case "output":
        if ((check.rate * check.hours * check.keep) % 100) throw new Error("Output is not an integer");
        value = check.rate * check.hours * check.keep / 100;
        break;
      default: throw new Error("Unknown check");
    }
    if (!Number.isInteger(value)) throw new Error("Answer is not an integer");
    return value;
  }

  function create(random = Math.random) {
    const rnd = (a, b) => a + Math.floor(random() * (b - a + 1));
    const pick = list => list[Math.floor(random() * list.length)];
    const shuffle = list => {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    let used = new Set();
    function reset() { used = new Set(); }
    function checkLevel(level) {
      if (!Number.isInteger(level) || level < 1 || level > 5) throw new RangeError("Level must be 1–5");
    }
    function twoDifferent(n) {
      const a = rnd(0, n - 1);
      let b = rnd(0, n - 2);
      if (b >= a) b += 1;
      return [a, b];
    }
    function split(total, n) {
      if (!Number.isInteger(total) || n < 1 || total < n) return null;
      const parts = [];
      let left = total;
      for (let i = 0; i < n - 1; i++) {
        const max = left - (n - 1 - i);
        const value = rnd(1, max);
        parts.push(value);
        left -= value;
      }
      parts.push(left);
      return parts;
    }
    function choices(answer, wrongs) {
      const options = [];
      const add = value => {
        if (!Number.isInteger(value) || options.includes(value)) return;
        options.push(value);
      };
      add(answer);
      wrongs.forEach(add);
      let step = 1;
      while (options.length < 5 && step < 40) {
        add(answer + step);
        if (options.length < 5) add(answer - step);
        step += 1;
      }
      return options.length === 5 ? shuffle(options) : null;
    }
    function exhibit(topic, headers, rows, kind) {
      return {
        kind,
        title: `${topic.place}: ${topic.unit}`,
        unit: topic.unit,
        headers,
        rows
      };
    }
    function finish(built) {
      let answer;
      try { answer = evaluate(built.check); } catch { return null; }
      if (answer !== built.answer) return null;
      const options = choices(answer, built.wrongs || []);
      if (!options) return null;
      const signature = `${built.prompt}|${answer}|${built.kind}|${JSON.stringify(built.rows || built.passage)}`;
      if (used.has(signature)) return null;
      used.add(signature);
      return {
        level: built.level,
        kind: built.kind,
        title: built.title,
        unit: built.unit,
        headers: built.headers || null,
        rows: built.rows || null,
        passage: built.passage || null,
        prompt: built.prompt,
        options,
        answer: options.indexOf(answer),
        explain: built.explain,
        check: built.check,
        selected: -1
      };
    }
    function level1() {
      const topic = pick(TOPICS);
      const headers = topic.periods.slice(0, 4);
      const values = headers.map(() => rnd(18, 86));
      const row = [{ name: topic.series[0], values }];
      const base = exhibit(topic, headers, row, pick(["table", "bar"]));
      if (random() < 0.5) {
        const index = rnd(0, 3);
        return finish({
          ...base, level: 1,
          prompt: `How many ${topic.unit} did ${topic.series[0]} record in ${headers[index]}?`,
          answer: values[index],
          wrongs: values.filter((_, i) => i !== index).concat([values.reduce((sum, n) => sum + n, 0)]),
          explain: `Read the ${headers[index]} column for ${topic.series[0]}: ${values[index]}.`,
          check: { op: "read", values, index }
        });
      }
      const [a, b] = twoDifferent(4);
      if (values[a] <= values[b]) values[a] = values[b] + rnd(3, 12);
      const answer = values[a] - values[b];
      return finish({
        ...base, level: 1,
        prompt: `How many more ${topic.unit} did ${topic.series[0]} record in ${headers[a]} than in ${headers[b]}?`,
        answer,
        wrongs: [values[a], values[b], values[a] + values[b], values[b] - values[a]],
        explain: `${values[a]} − ${values[b]} = ${answer}.`,
        check: { op: "diff", a: values[a], b: values[b] }
      });
    }
    function level2() {
      const topic = pick(TOPICS);
      const headers = topic.periods.slice(0, 4);
      if (random() < 0.5) {
        const avg = rnd(16, 45);
        const values = Array(4).fill(avg);
        const delta = rnd(2, 8);
        values[0] += delta;
        values[1] -= delta;
        const extra = rnd(1, 5);
        values[2] += extra;
        values[3] -= extra;
        return finish({
          ...exhibit(topic, headers, [{ name: topic.series[0], values }], pick(["table", "bar"])),
          level: 2,
          prompt: `What was the average number of ${topic.unit} per period for ${topic.series[0]}?`,
          answer: avg,
          wrongs: [values[0], values[2], avg + delta, values.reduce((sum, n) => sum + n, 0)],
          explain: `${values.join(" + ")} = ${avg * 4}. ${avg * 4} ÷ 4 = ${avg}.`,
          check: { op: "avg", values }
        });
      }
      const percent = pick([10, 20, 25, 40, 50]);
      const total = pick([100, 120, 160, 200, 240]);
      const part = total * percent / 100;
      const rest = split(total - part, 3);
      if (!rest) return null;
      const index = rnd(0, 3);
      const values = rest.slice();
      values.splice(index, 0, part);
      return finish({
        ...exhibit(topic, headers, [{ name: topic.series[0], values }], pick(["table", "bar"])),
        level: 2,
        prompt: `What percent of ${topic.series[0]}'s ${topic.unit} fell in ${headers[index]}?`,
        answer: percent,
        wrongs: [part, total, 100 - percent, values[(index + 1) % 4]],
        explain: `${headers[index]} is ${part}. The row total is ${total}. ${part} ÷ ${total} × 100 = ${percent}.`,
        check: { op: "share", part, total }
      });
    }
    function level3() {
      const topic = pick(TOPICS);
      const headers = topic.periods.slice(0, 4);
      const percent = pick([-25, -20, -10, 10, 20, 25, 50]);
      const step = Math.abs(percent) === 25 || Math.abs(percent) === 50 ? 4 : Math.abs(percent) === 20 ? 5 : 10;
      const from = rnd(4, 12) * step;
      const to = from + from * percent / 100;
      const [a, b] = twoDifferent(4);
      const values = Array.from({ length: 4 }, () => rnd(20, 70));
      values[a] = from;
      values[b] = to;
      const direction = percent < 0 ? " Use a negative number for a fall." : "";
      return finish({
        ...exhibit(topic, headers, [{ name: topic.series[0], values }], pick(["line", "table"])),
        level: 3,
        prompt: `By what percent did ${topic.series[0]} change from ${headers[a]} to ${headers[b]}?${direction}`,
        answer: percent,
        wrongs: [to - from, from, to, -percent, percent + (percent > 0 ? 10 : -10)],
        explain: `(${to} − ${from}) ÷ ${from} × 100 = ${percent}.`,
        check: { op: "change", from, to }
      });
    }
    function level4() {
      const topic = pick(TOPICS);
      const headers = topic.periods.slice(0, 3);
      if (random() < 0.5) {
        const percent = pick([10, 20, 25]);
        const step = percent === 25 ? 4 : percent === 20 ? 5 : 10;
        const base = rnd(6, 16) * step;
        const extra = rnd(2, 8) * 5;
        const index = rnd(0, 2);
        const values = [rnd(20, 60), rnd(20, 60), rnd(20, 60)];
        values[index] = base;
        const increased = base * (100 + percent) / 100;
        return finish({
          ...exhibit(topic, headers, [{ name: topic.series[0], values }], pick(["table", "bar"])),
          level: 4,
          prompt: `${headers[index]} then rises by ${percent}%, and ${extra} further ${topic.unit} are added. What is the new ${headers[index]} figure?`,
          answer: increased + extra,
          wrongs: [base, increased, base + extra, increased - extra, base * percent / 100],
          explain: `${base} × ${(100 + percent) / 100} = ${increased}. ${increased} + ${extra} = ${increased + extra}.`,
          check: { op: "increaseAdd", base, pct: percent, extra }
        });
      }
      const total = pick([100, 200, 240]);
      const gap = pick([10, 20, 25]);
      const lowShare = pick([20, 25, 30]);
      const highShare = lowShare + gap;
      if (highShare >= 80) return null;
      const high = total * highShare / 100;
      const low = total * lowShare / 100;
      const rest = total - high - low;
      if (rest <= 0) return null;
      const names = topic.series.slice(0, 3);
      const column = [high, low, rest];
      const rows = names.map((name, i) => ({ name, values: [column[i], rnd(10, 40), rnd(10, 40)] }));
      return finish({
        ...exhibit(topic, headers, rows, "table"),
        level: 4,
        prompt: `In ${headers[0]}, how many percentage points higher is ${names[0]}'s share of that column than ${names[1]}'s share?`,
        answer: gap,
        wrongs: [high, low, high - low, highShare, lowShare],
        explain: `${names[0]} is ${high} of ${total} (${highShare}%). ${names[1]} is ${low} of ${total} (${lowShare}%). ${highShare} − ${lowShare} = ${gap} percentage points.`,
        check: { op: "shareDiff", a: high, b: low, total }
      });
    }
    function level5() {
      const topic = pick(TOPICS);
      if (random() < 0.55) {
        const loss = pick([10, 20, 25]);
        const keep = 100 - loss;
        const step = keep === 75 ? 4 : keep === 80 ? 5 : 10;
        const rate = rnd(4, 12) * step;
        const hours = rnd(4, 9);
        const answer = rate * hours * keep / 100;
        const passage = `${topic.place} handles ${rate} ${topic.unit} an hour. One shift lasts ${hours} hours, and ${loss}% of the shift is spent on checks rather than handling.`;
        return finish({
          level: 5, kind: "passage", title: topic.place, unit: topic.unit, passage,
          prompt: `How many ${topic.unit} are handled in one shift?`,
          answer,
          wrongs: [rate * hours, rate * hours * loss / 100, rate * keep / 100, answer + rate, rate * hours * (100 + loss) / 100],
          explain: `Handling time is ${hours} × ${keep}% = ${hours * keep / 100} hours. ${hours * keep / 100} × ${rate} = ${answer}.`,
          check: { op: "output", rate, hours, keep }
        });
      }
      const headers = topic.periods.slice(0, 3);
      const percent = pick([25, 40, 50]);
      const grand = 200;
      const part = grand * percent / 100;
      const column = rnd(0, 2);
      const first = rnd(Math.max(1, part - 90), part - 1);
      const second = part - first;
      const rest = split(grand - part, 4);
      if (!rest) return null;
      const grid = [[0, 0, 0], [0, 0, 0]];
      grid[0][column] = first;
      grid[1][column] = second;
      let cursor = 0;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          if (col !== column) grid[row][col] = rest[cursor++];
        }
      }
      const names = topic.series.slice(0, 2);
      return finish({
        ...exhibit(topic, headers, names.map((name, i) => ({ name, values: grid[i] })), "bar"),
        level: 5,
        prompt: `In ${headers[column]}, what percent of all ${topic.unit} in the table came from ${names[0]} and ${names[1]} combined?`,
        answer: percent,
        wrongs: [part, first, second, 100 - percent, first * 100 / grand].filter(Number.isInteger),
        explain: `${headers[column]} is ${first} + ${second} = ${part}. The table total is ${grand}. ${part} ÷ ${grand} × 100 = ${percent}.`,
        check: { op: "share", part, total: grand }
      });
    }
    const builders = [level1, level2, level3, level4, level5];
    function newItem(level) {
      checkLevel(level);
      for (let attempt = 0; attempt < 80; attempt++) {
        const item = builders[level - 1]();
        if (item) return item;
      }
      throw new Error("Could not generate an insights item");
    }
    return { newItem, reset };
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function tableHtml(item) {
    const head = `<tr><th scope="col">${escape(item.unit)}</th>${item.headers.map(header => `<th scope="col">${escape(header)}</th>`).join("")}</tr>`;
    const body = item.rows.map(row => `<tr><th scope="row">${escape(row.name)}</th>${row.values.map(value => `<td>${value}</td>`).join("")}</tr>`).join("");
    return `<table class="insight-table"><caption>${escape(item.title)}</caption><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  function chartSvg(item) {
    const flat = item.rows.flatMap(row => row.values);
    const max = Math.max(...flat, 1);
    const nice = Math.max(10, Math.ceil(max / 10) * 10);
    const width = 320, height = 168, left = 36, right = 8, top = 18, bottom = 32;
    const plotW = width - left - right, plotH = height - top - bottom;
    const groupW = plotW / item.headers.length;
    const y = value => top + plotH - (value / nice) * plotH;
    let marks = "";
    for (let step = 0; step <= 4; step++) {
      const value = nice * step / 4;
      const yy = y(value);
      marks += `<line x1="${left}" y1="${yy}" x2="${width - right}" y2="${yy}" stroke="#e4ddd8"/>`;
      marks += `<text x="${left - 4}" y="${yy + 3}" text-anchor="end" font-size="9" fill="#6d675f">${value}</text>`;
    }
    item.headers.forEach((header, index) => {
      const x = left + groupW * index + groupW / 2;
      marks += `<text x="${x}" y="${height - 12}" text-anchor="middle" font-size="9" fill="#3c3834">${escape(header)}</text>`;
    });
    item.rows.forEach((row, series) => {
      const color = series === 0 ? "#8f4b4b" : series === 1 ? "#4e7590" : "#8c7a3c";
      if (item.kind === "line") {
        const points = row.values.map((value, index) => [left + groupW * index + groupW / 2, y(value), value]);
        marks += `<polyline fill="none" stroke="${color}" stroke-width="2" points="${points.map(point => point.slice(0, 2).join(",")).join(" ")}"/>`;
        points.forEach(([x, yy, value]) => {
          marks += `<circle cx="${x}" cy="${yy}" r="3" fill="${color}"/><text x="${x}" y="${yy - 6}" text-anchor="middle" font-size="8" fill="#3c3834">${value}</text>`;
        });
      } else {
        const barW = Math.min(16, (groupW - 10) / item.rows.length);
        row.values.forEach((value, index) => {
          const x = left + groupW * index + (groupW - item.rows.length * barW) / 2 + series * barW;
          const yy = y(value);
          marks += `<rect x="${x.toFixed(2)}" y="${yy.toFixed(2)}" width="${Math.max(1, barW - 2)}" height="${Math.max(0, top + plotH - yy).toFixed(2)}" fill="${color}"/>`;
          marks += `<text x="${(x + (barW - 2) / 2).toFixed(2)}" y="${(yy - 3).toFixed(2)}" text-anchor="middle" font-size="8" fill="#3c3834">${value}</text>`;
        });
      }
    });
    const legend = item.rows.map((row, series) => {
      const color = series === 0 ? "#8f4b4b" : series === 1 ? "#4e7590" : "#8c7a3c";
      return `<span class="legend"><i style="background:${color}"></i>${escape(row.name)}</span>`;
    }).join("");
    return `<svg class="insight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(item.title)}">${marks}</svg><div class="legend-row">${legend}</div><div class="sr-only">${tableHtml(item)}</div>`;
  }
  function diagram(item) {
    if (!item || item.unanswered) return "<p class=\"review-explanation\">This question was not reached.</p>";
    if (item.kind === "passage") {
      return `<div class="exhibit"><p class="exhibit-title">${escape(item.title)}</p><p class="insight-passage">${escape(item.passage)}</p></div>`;
    }
    const visual = item.kind === "table" ? tableHtml(item) : `${chartSvg(item)}`;
    return `<div class="exhibit"><p class="exhibit-title">${escape(item.title)}</p>${visual}</div>`;
  }

  function calculator() {
    let acc = null, op = null, entry = "0", fresh = false;
    function format(value) {
      if (!Number.isFinite(value)) return "Error";
      return String(Math.round(value * 1e6) / 1e6);
    }
    function apply(left, operator, right) {
      if (operator === "+") return left + right;
      if (operator === "-") return left - right;
      if (operator === "*") return left * right;
      if (operator === "/") return right === 0 ? NaN : left / right;
      return right;
    }
    function commit() {
      const value = Number(entry);
      if (acc == null || op == null || !Number.isFinite(value)) acc = value;
      else acc = apply(acc, op, value);
      entry = format(acc);
    }
    function press(key) {
      if (key === "C") { acc = null; op = null; entry = "0"; fresh = false; return entry; }
      if (entry === "Error" && key !== "C") { press("C"); if (key === "C") return entry; }
      if (/^[0-9]$/.test(key)) {
        entry = fresh || entry === "0" || entry === "Error" ? key : entry + key;
        fresh = false;
        return entry;
      }
      if (key === ".") {
        if (fresh || entry === "Error") entry = "0.";
        else if (!entry.includes(".")) entry += ".";
        fresh = false;
        return entry;
      }
      if (key === "%") {
        const value = Number(entry);
        entry = format(op === "+" || op === "-" ? acc * value / 100 : value / 100);
        fresh = true;
        return entry;
      }
      if ("+-*/".includes(key)) {
        if (!fresh) commit();
        op = key;
        fresh = true;
        return format(acc);
      }
      if (key === "=") {
        commit();
        op = null;
        fresh = true;
        return entry;
      }
      return entry;
    }
    return { press, get display() { return entry; } };
  }

  return { create, evaluate, diagram, calculator };
});
