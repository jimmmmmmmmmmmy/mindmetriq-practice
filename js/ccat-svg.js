// Inline figures for spatial items. Shape fields are an enum, not free text.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CCATSvg = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const NS = "http://www.w3.org/2000/svg";
  const KINDS = new Set(["circle", "square", "triangle", "diamond", "hex", "arrow"]);
  let sequence = 0;

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  function points(pairs) {
    return pairs.map(pair => pair[0].toFixed(1) + "," + pair[1].toFixed(1)).join(" ");
  }

  function regular(cx, cy, radius, sides, rotDeg) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const angle = (rotDeg - 90 + i * 360 / sides) * Math.PI / 180;
      pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
    return pts;
  }

  function arrow(cx, cy, radius) {
    return [
      [cx, cy - radius],
      [cx + radius * 0.58, cy - radius * 0.02],
      [cx + radius * 0.22, cy - radius * 0.02],
      [cx + radius * 0.22, cy + radius * 0.95],
      [cx - radius * 0.22, cy + radius * 0.95],
      [cx - radius * 0.22, cy - radius * 0.02],
      [cx - radius * 0.58, cy - radius * 0.02],
    ];
  }

  function slots(count, cx, cy, spread) {
    if (count <= 1) return [[cx, cy]];
    if (count === 2) return [[cx - spread, cy], [cx + spread, cy]];
    if (count === 3) return [[cx, cy - spread], [cx - spread, cy + spread * 0.86], [cx + spread, cy + spread * 0.86]];
    if (count === 4) return [[cx - spread, cy - spread], [cx + spread, cy - spread], [cx - spread, cy + spread], [cx + spread, cy + spread]];
    return [[cx - spread, cy - spread], [cx + spread, cy - spread], [cx - spread, cy + spread], [cx + spread, cy + spread], [cx, cy]];
  }

  function renderFigure(figure, size) {
    const box = size || 72;
    const svg = el("svg", { viewBox: `0 0 ${box} ${box}`, width: box, height: box, class: "fig", role: "img", "aria-hidden": "true" });
    const kind = figure && KINDS.has(figure.kind) ? figure.kind : "square";
    const count = Math.max(1, Math.min(5, figure && figure.count | 0));
    const rot = figure && [0, 90, 180, 270].includes(figure.rot) ? figure.rot : 0;
    const fill = figure && (figure.fill === "none" || figure.fill === "stripe") ? figure.fill : "solid";
    const spread = box * 0.22;
    const radius = count === 1 ? box * 0.28 : box * 0.12;
    if (fill === "stripe") {
      const id = "ccatStripe" + (++sequence);
      const defs = el("defs", {});
      const pattern = el("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(40)" });
      pattern.append(el("rect", { width: 6, height: 6, fill: "#e7f0ec" }));
      pattern.append(el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#2f6f5e", "stroke-width": 3 }));
      defs.append(pattern);
      svg.append(defs);
      svg.dataset.pattern = id;
    }
    const paint = fill === "solid" ? "#2f6f5e" : fill === "stripe" ? `url(#${svg.dataset.pattern})` : "none";
    for (const [cx, cy] of slots(count, box / 2, box / 2, spread)) {
      let shape;
      const attrs = { fill: paint, stroke: "#24302c", "stroke-width": 2, "stroke-linejoin": "round" };
      if (kind === "circle") shape = el("circle", Object.assign({ cx, cy, r: radius }, attrs));
      else if (kind === "square") shape = el("rect", Object.assign({ x: cx - radius, y: cy - radius, width: radius * 2, height: radius * 2 }, attrs));
      else if (kind === "diamond") shape = el("polygon", Object.assign({ points: points(regular(cx, cy, radius * 1.2, 4, 0)) }, attrs));
      else if (kind === "hex") shape = el("polygon", Object.assign({ points: points(regular(cx, cy, radius, 6, 0)) }, attrs));
      else if (kind === "triangle") {
        shape = el("g", { transform: `rotate(${rot} ${cx} ${cy})` });
        shape.append(el("polygon", Object.assign({ points: points(regular(cx, cy, radius * 1.15, 3, 0)) }, attrs)));
      } else {
        shape = el("g", { transform: `rotate(${rot} ${cx} ${cy})` });
        shape.append(el("polygon", Object.assign({ points: points(arrow(cx, cy, radius * 1.05)) }, attrs)));
      }
      svg.append(shape);
    }
    return svg;
  }

  function mark() {
    const span = document.createElement("span");
    span.className = "mystery-mark";
    span.textContent = "?";
    return span;
  }

  function cell(figure, size) {
    const box = document.createElement("div");
    box.className = "fig-cell";
    box.append(figure ? renderFigure(figure, size || 64) : mark());
    return box;
  }

  function renderFrames(container, frames, withBlank) {
    container.replaceChildren();
    const row = document.createElement("div");
    row.className = "frames";
    frames.forEach((frame, index) => {
      if (index) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "→";
        row.append(sep);
      }
      row.append(cell(frame, 58));
    });
    if (withBlank !== false) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "→";
      const mystery = cell(null, 58);
      mystery.classList.add("mystery");
      row.append(sep, mystery);
    }
    container.append(row);
  }

  function renderMatrix(container, cells) {
    container.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "matrix";
    for (let i = 0; i < 9; i++) grid.append(cell(cells[i], 44));
    container.append(grid);
  }

  return { renderFigure, renderFrames, renderMatrix };
});
