// Pure puzzle generation and validation, shared by the browser and Node tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MMQLogic = factory().create();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
function create(random = Math.random) {
  const H = {
    rnd: (a, b) => a + Math.floor(random() * (b - a + 1)),
    pick: a => a[Math.floor(random() * a.length)],
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  };
  function checkLevel(level) { if (!Number.isInteger(level) || level < 1 || level > 5) throw new RangeError("Level must be 1–5"); }
  const net = (() => {
const N = 5;
// Net shapes are connected polyominoes; from level 3 they may include diagonal (corner-touching) steps, as in the official practice item.
function makeShape(level) {
  const size = H.rnd(3, Math.min(6, 3 + Math.ceil(level / 1.5)));
  const diag = level >= 3 && random() < 0.55;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]].concat(diag ? [[1,1],[1,-1],[-1,1],[-1,-1]] : []);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const s = [[0,0]];
    for (let growth = 0; s.length < size && growth < 200; growth++) { const b = H.pick(s), d = H.pick(dirs), c = [b[0]+d[0], b[1]+d[1]]; if (!s.some(q => q[0]===c[0] && q[1]===c[1])) s.push(c); }
    if (s.length < size) continue;
    const mx = Math.min(...s.map(q=>q[0])), my = Math.min(...s.map(q=>q[1]));
    const sh = s.map(q => [q[0]-mx, q[1]-my]);
    const w = Math.max(...sh.map(q=>q[0]))+1, h = Math.max(...sh.map(q=>q[1]))+1;
    if (w <= 4 && h <= 4 && w*h > size - 0 && !(w===1&&h===size) ) return { cells: sh, w, h };
  }
  throw new Error("Could not generate a puzzle within the attempt budget");
}
function sumAt(g, sh, x, y) { return sh.cells.reduce((s, [dx, dy]) => s + g[(y+dy)*N + x+dx], 0); }
function placements(sh) { const r = []; for (let y = 0; y + sh.h <= N; y++) for (let x = 0; x + sh.w <= N; x++) r.push([x, y]); return r; }
function newItem(level) {
  checkLevel(level);
  for (let tries = 0; tries < 1000; tries++) {
    const sh = makeShape(level);
    const dens = 0.32 + 0.05 * level, negP = 0.12 + 0.08 * level, mag = 4 + level;
    const allNegative = random() < .12;
    const g = Array.from({ length: N*N }, () => allNegative ? -H.rnd(1, mag) : random() < dens ? (random() < negP ? -H.rnd(1, mag) : H.rnd(1, mag)) : 0);
    const ps = placements(sh), sums = ps.map(([x,y]) => sumAt(g, sh, x, y));
    const best = Math.max(...sums), nb = sums.filter(s => s === best).length;
    const second = Math.max(...sums.filter(s => s !== best));
    // Unique optimum; harder levels need a close runner-up and an optimum that includes a negative tile.
    if (nb !== 1) continue;
    if (level >= 3 && best - second > 2 && tries < 300) continue;
    const bp = ps[sums.indexOf(best)];
    const hasNeg = sh.cells.some(([dx,dy]) => g[(bp[1]+dy)*N + bp[0]+dx] < 0);
    if (level >= 4 && !hasNeg && tries < 300) continue;
    return { g, sh, best, bp };
  }
  throw new Error("Could not generate a puzzle within the attempt budget");
}
return { newItem, sumAt, placements };
  })();
  const racer = (() => {
function newItem(level, timer = 1) {
  checkLevel(level);
  if (!Number.isFinite(timer) || timer <= 0) throw new RangeError("Timer multiplier must be positive");
  const n = [5, 6, 6, 7, 8][level - 1], neg = level >= 2, mag = [6, 7, 9, 9, 12][level - 1];
  for (let attempt = 0; attempt < 1000; attempt++) {
    const nums = Array.from({ length: n }, () => { let v = H.rnd(1, mag); if (neg && random() < .18 + .06 * level) v = -v; return v; });
    const k = H.rnd(2, Math.min(n - 2, 2 + Math.floor(level / 2)));
    const idx = H.shuffle([...nums.keys()]).slice(0, k);
    const target = idx.reduce((s, i) => s + nums[i], 0);
    if (target === 0 || nums.includes(target) || Math.abs(target) > 25) continue;
    if (nums.reduce((s, v) => s + v, 0) === target) continue; // catching everything must not be a solution
    return { nums, target, sol: idx.sort((a, b) => a - b), xs: nums.map(() => H.rnd(73, 287)), fallT: (2.0 - .15 * level) * timer, plan: 5 * timer };
  }
  throw new Error("Could not generate a puzzle within the attempt budget");
}
// Update with elapsed seconds, so dropped frames never extend a round.
function advance(item, elapsed, keys) {
  const total = item.plan + item.nums.length * item.fallT;
  const end = Math.min(total, Math.max(item.t, elapsed));
  let remaining = end - item.t;
  // Do not award collisions for a long interval the player never saw.
  if (remaining > .25) {
    item.t = end; remaining = 0;
    const k = Math.floor((end - item.plan) / item.fallT);
    item.i = Math.min(item.nums.length - 1, Math.max(-1, k));
    item.block = k < 0 || k >= item.nums.length ? null : {
      v: item.nums[k], x: item.xs[k], hit: item.got.includes(k),
      y: -34 + ((end - item.plan) / item.fallT - k) * 544
    };
  }
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt; item.t += dt;
    item.car = Math.max(74, Math.min(286, item.car + (keys.r - keys.l) * 330 * dt));
    const k = Math.floor((item.t - item.plan) / item.fallT);
    if (k < 0 || k >= item.nums.length) continue;
    if (k !== item.i) { item.i = k; item.block = { v: item.nums[k], x: item.xs[k], hit: item.got.includes(k) }; }
    const block = item.block;
    block.y = -34 + ((item.t - item.plan) / item.fallT - k) * 544;
    if (!block.hit && block.y + 17 >= 488 && block.y - 17 <= 520 && Math.abs(block.x - item.car) < 33) {
      block.hit = true; item.got.push(k);
    }
  }
  item.t = end;
  return end >= total;
}
return { newItem, advance };
  })();
  const pipes = (() => {
const D = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]];
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
function genPath(N, s, t, minLen) {
  for (let a = 0; a < 400; a++) {
    const path = [s], seen = new Set([s]);
    let budget = 3000;
    const ok = (function dfs(c) {
      if (--budget <= 0) return false;
      if (c === t) return path.length >= minLen;
      if (path.length > minLen + 2) return false;
      const x = c % N, y = (c / N) | 0;
      for (const [dx, dy] of H.shuffle(D)) { const nx = x + dx, ny = y + dy, n = ny * N + nx; if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen.has(n)) continue;
        if (n !== t && path.length + 1 < minLen && random() < .1) continue;
        seen.add(n); path.push(n); if (dfs(n)) return true; path.pop(); seen.delete(n); }
      return false;
    })(s);
    if (ok) return path;
  }
  return null;
}
const bitTo = (a, b, N) => { const dx = b % N - a % N, dy = ((b / N) | 0) - ((a / N) | 0); return D.find(d => d[0] === dx && d[1] === dy)[2]; };
function connected(cells, s, N) {
  let c = s, out = cells[s].m, steps = 0;
  while (steps++ < N * N + 2) {
    const d = D.find(q => q[2] === out);
    if (!d) return false;
    const x = c % N + d[0], y = ((c / N) | 0) + d[1];
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    const n = y * N + x, cell = cells[n];
    if (!(cell.m & OPP[out])) return false;
    if (cell.t === "e") return n !== s;
    if (cell.t !== "p") return false;
    out = cell.m & ~OPP[out]; c = n;
  }
  return false;
}
function newItem(level) {
  checkLevel(level);
  const N = level >= 5 ? 6 : 5;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const border = []; for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0; if (x === 0 || y === 0 || x === N - 1 || y === N - 1) border.push(i); }
    const s = H.pick(border), t = H.pick(border);
    const dist = Math.abs(s % N - t % N) + Math.abs(((s / N) | 0) - ((t / N) | 0));
    if (dist < 3) continue;
    const path = genPath(N, s, t, Math.min(dist + 1 + 2 * (level - 1), N * N - 6)); if (!path) continue;
    const cells = Array.from({ length: N * N }, () => ({ t: "o", m: 0 }));
    path.forEach((c, k) => { let m = 0; if (k > 0) m |= bitTo(c, path[k - 1], N); if (k < path.length - 1) m |= bitTo(c, path[k + 1], N); cells[c] = { t: k === 0 || k === path.length - 1 ? "e" : "p", m }; });
    const need = {}; path.forEach(c => need[c] = cells[c].m);
    const free = H.shuffle([...cells.keys()].filter(i => cells[i].t === "o"));
    const nObs = H.rnd(1, 2 + level), nExtra = H.rnd(0, Math.max(0, level - 2));
    free.slice(0, nObs).forEach(i => cells[i] = { t: "x", m: 0 });
    const PIPES = [5, 10, 3, 6, 12, 9];
    free.slice(nObs, nObs + nExtra).forEach(i => cells[i] = { t: "p", m: H.pick(PIPES) });
    // Scramble with random swaps among movable cells (each swap moves at least one pipe).
    const mov = [...cells.keys()].filter(i => cells[i].t === "p" || cells[i].t === "o");
    const pipes = () => mov.filter(i => cells[i].t === "p");
    const nSwaps = [2, 3, 4, 6, 8][level - 1];
    for (let k = 0; k < nSwaps; k++) { const a = H.pick(pipes()), b = H.pick(mov.filter(i => i !== a && !(cells[i].t === "p" && cells[i].m === cells[a].m))); if (b === undefined) continue; [cells[a], cells[b]] = [cells[b], cells[a]]; }
    if (connected(cells, s, N)) continue;
    return { N, cells, s, t, path, need };
  }
  throw new Error("Could not generate a pipe puzzle within the attempt budget");
}
return { newItem, connected };
  })();
  const spinner = (() => {
function shapesFor(level) { return level >= 4 ? ["c", "s", "t", "r"] : ["c", "s", "t"]; }
function fillsFor(level) { return level >= 5 ? ["d", "w", "g"] : ["d", "w"]; }
const ok = (a, b) => (a.s === b.s) !== (a.f === b.f); // same shape XOR same shading
function valid(inner, outer, r) { const n = inner.length; for (let i = 0; i < n; i++) if (!ok(outer[i], inner[((i - r) % n + n) % n])) return false; return true; }
function newItem(level) {
  checkLevel(level);
  const n = [3, 4, 5, 6, H.rnd(7, 8)][level - 1], S = shapesFor(level), F = fillsFor(level);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const inner = Array.from({ length: n }, () => ({ s: H.pick(S), f: H.pick(F) }));
    const sol = H.rnd(1, n - 1);
    const outer = Array.from({ length: n }, (_, i) => { const m = inner[((i - sol) % n + n) % n]; const c = []; S.forEach(s => F.forEach(f => { const o = { s, f }; if (ok(o, m)) c.push(o); })); return H.pick(c); });
    let cnt = 0; for (let r = 0; r < n; r++) if (valid(inner, outer, r)) cnt++;
    if (cnt === 1) return { n, inner, outer, sol };
  }
  throw new Error("Could not generate a puzzle within the attempt budget");
}
return { newItem, valid, ok };
  })();
  return { net, racer, pipes, spinner };
}
return { create };
});
