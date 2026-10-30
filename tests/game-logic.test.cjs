const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/game-logic');
const verbal = require('../js/verbal-logic');
const data = require('../js/verbal-data');
function seeded(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

for (let level = 1; level <= 5; level++) {
  test(`level ${level}: 1,000 nets have exactly one independently verified maximum`, () => {
    const { net } = create(seeded(100 + level));
    let negatives = 0; const signatures = new Set();
    for (let i = 0; i < 1000; i++) {
      const item = net.newItem(level), { g, sh } = item;
      assert.equal(g.length, 25); assert.equal(new Set(sh.cells.map(String)).size, sh.cells.length);
      const seen = new Set([0]);
      for (let pass = 0; pass < sh.cells.length; pass++) sh.cells.forEach(([x,y], i) => {
        if (sh.cells.some(([a,b], j) => seen.has(j) && Math.max(Math.abs(x-a),Math.abs(y-b)) <= 1)) seen.add(i);
      });
      assert.equal(seen.size, sh.cells.length, 'shape must be connected');
      const sums = [];
      for (let y = 0; y <= 5-sh.h; y++) for (let x = 0; x <= 5-sh.w; x++) {
        const sum = sh.cells.reduce((s,[dx,dy]) => s + g[(y+dy)*5+x+dx], 0);
        sums.push({ sum, x, y });
      }
      const best = Math.max(...sums.map(p => p.sum));
      assert.equal(item.best, best); assert.equal(sums.filter(p => p.sum === best).length, 1);
      assert.deepEqual(item.bp, [sums.find(p => p.sum === best).x, sums.find(p => p.sum === best).y]);
      if (best < 0) negatives++;
      signatures.add(JSON.stringify(item));
    }
    assert(negatives > 0, 'include boards whose best sum is negative');
    assert.equal(signatures.size, 1000, 'new boards rather than repeating rounds');
  });
  test(`level ${level}: 1,000 racers have a nontrivial achievable target`, () => {
    const { racer } = create(seeded(200 + level));
    for (let i = 0; i < 1000; i++) {
      const item = racer.newItem(level, i % 2 ? 1 : .75);
      assert.notEqual(item.target, 0); assert(!item.nums.includes(item.target));
      assert.notEqual(item.nums.reduce((s,n) => s+n,0), item.target);
      const solutions = [];
      for (let mask = 1; mask < (1 << item.nums.length)-1; mask++) {
        let sum=0; const indices=[];
        item.nums.forEach((n,j) => { if (mask & (1 << j)) { sum += n; indices.push(j); } });
        if (sum === item.target) solutions.push(indices);
      }
      assert(solutions.length > 0); assert(solutions.every(s => s.length >= 2));
      assert.equal(item.sol.reduce((s,j) => s+item.nums[j],0), item.target);
      assert(item.xs.every(x => x >= 107 && x <= 343));
      assert.equal(item.nums.length,8);
      assert.equal(item.plan, 5 * (i % 2 ? 1 : .75));
      assert.equal(item.fallT, 1.625 * (i % 2 ? 1 : .75));
      // Even in hard drill there is time to cross the entire track before a catch.
      const g = racer.geometry;
      assert(item.fallT * .85 > (g.right-g.left-g.carWidth)/g.speed);
    }
  });
  test(`level ${level}: 1,000 pipe boards are unsolved and can be solved without moving fixed tiles`, () => {
    const { pipes } = create(seeded(300 + level));
    for (let i = 0; i < 1000; i++) {
      const item = pipes.newItem(level), { cells, path, need, N } = item;
      assert.equal(pipes.connected(cells,item.s,N), false);
      assert(cells.every(c=>['p','e','x'].includes(c.t)), 'no swappable floor squares');
      assert.equal(new Set(path).size,path.length);
      const fixed = cells.map((c,i) => [c,i]).filter(([c]) => c.t === 'e' || c.t === 'x').map(([c,i]) => [i,{...c}]);
      for (const p of path.slice(1,-1)) {
        if(cells[p].t === 'p' && cells[p].m === need[p]) continue;
        const j = cells.findIndex((q,k) => q.t === 'p' && q.m === need[p] && !(path.includes(k) && cells[k].m === need[k]));
        assert(j >= 0, 'needed pipe orientation must exist');
        [cells[p],cells[j]] = [cells[j],cells[p]];
      }
      // Independent walk of the intended solution, including reciprocal openings.
      for (let k=1;k<path.length;k++) {
        const a=path[k-1], b=path[k];
        assert.equal(Math.abs(a%N-b%N)+Math.abs(Math.floor(a/N)-Math.floor(b/N)),1);
        const bit = b === a+N ? 4 : b === a-N ? 1 : b === a+1 ? 2 : 8;
        const opp={1:4,2:8,4:1,8:2};
        assert(cells[a].m & bit); assert(cells[b].m & opp[bit]);
      }
      assert.equal(pipes.connected(cells,item.s,N),true);
      fixed.forEach(([i,c]) => assert.deepEqual(cells[i],c));
    }
  });
  test(`level ${level}: 1,000 spinners have exactly one non-starting XOR solution`, () => {
    const { spinner } = create(seeded(400 + level));
    for (let i = 0; i < 1000; i++) {
      const item = spinner.newItem(level), solutions=[];
      for(let r=0;r<item.n;r++) {
        const good = item.outer.every((outer,j) => {
          const inner = item.inner[(j-r+item.n)%item.n];
          return Number(outer.s === inner.s) + Number(outer.f === inner.f) === 1;
        });
        assert.equal(spinner.valid(item.inner,item.outer,r),good);
        if(good) solutions.push(r);
      }
      assert.deepEqual(solutions,[item.sol]); assert.notEqual(item.sol,0);
    }
  });
  test(`level ${level}: 100 verbal runs balance categories and never repeat pairs or analogies`, () => {
    for(let seed=0;seed<100;seed++) {
      const v=verbal.create(seeded(5000+seed+level*100)), seenPairs=new Set(), seenAnalogies=new Set(), counts={S:0,A:0,N:0};
      for(let i=0;i<15;i++) {
        const pair=v.swipe(level), pairKey=pair.slice(0,2).sort().join('|');
        assert(!seenPairs.has(pairKey)); seenPairs.add(pairKey); counts[pair[2]]++;
        const a=v.analogy(level), key=[a.b.slice(1,3).join('|'),a.b.slice(3,5).join('|')].sort().join(':');
        assert(!seenAnalogies.has(key)); seenAnalogies.add(key);
        assert.equal(a.opts.length,5); assert.equal(new Set(a.opts).size,5);
        assert.equal(a.opts.filter(w=>w===a.b[4]).length,1);
        assert.equal(a.level,level);
        const relation=data.analogies.find(g=>g[1]===a.relation);
        assert(relation[2].some(p=>p[0]===a.b[1] && p[1]===a.b[2]));
        assert(relation[2].some(p=>p[0]===a.b[3] && p[1]===a.b[4]));
      }
      assert.deepEqual(counts,{S:5,A:5,N:5});
      v.reset(); assert(v.swipe(level)); assert(v.analogy(level));
    }
  });
}

test('racer collision, avoidance, alternate solution, and dropped-frame clock', () => {
  const { racer }=create(seeded(42));
  function run(indices) {
    const item={nums:[2,3,-1,6],target:5,xs:[150,300,150,300],plan:.1,fallT:1,t:0,i:-1,got:[],car:225,block:null};
    for(let t=1/120;t<=4.11;t+=1/120) {
      const k=Math.max(0,Math.min(3,Math.floor((t-item.plan)/item.fallT)));
      const want=indices.includes(k) ? item.xs[k] : item.xs[k]<225 ? 340 : 110;
      racer.advance(item,t,{l:Number(item.car>want+2),r:Number(item.car<want-2)});
    }
    assert.deepEqual(item.got,indices);
    return item.got.reduce((s,i)=>s+item.nums[i],0);
  }
  assert.equal(run([0,1]),5); assert.equal(run([2,3]),5); assert.notEqual(run([0]),5);
  const item={...racer.newItem(5,.75),t:0,i:-1,got:[],car:225,block:null};
  const total=item.plan+item.nums.length*item.fallT;
  assert.equal(racer.advance(item,total+60,{l:0,r:0}),true); assert.equal(item.t,total); assert.deepEqual(item.got,[]);
});
test('invalid puzzle levels fail explicitly',()=> {
  const logic=create();
  for(const game of Object.values(logic)) for(const level of [0,6,NaN,1.5]) assert.throws(()=>game.newItem(level),RangeError);
});
test('malformed pipes and cyclic routes cannot crash or be accepted',()=> {
  const { pipes }=create();
  assert.equal(pipes.connected([{t:'e',m:0}],0,1),false);
  assert.equal(pipes.connected([{t:'e',m:2},{t:'p',m:8},{t:'o',m:0},{t:'o',m:0}],0,2),false);
});
test('curated pairs have no conflicting classifications or duplicate entries',()=> {
  const seen=new Map();
  function add(a,b,c) { const key=[a,b].sort().join('|');assert(!seen.has(key),`${key}: ${seen.get(key)} / ${c}`);seen.set(key,c); }
  for(const [,words] of data.synonyms) for(let i=0;i<words.length;i++) for(let j=i+1;j<words.length;j++)add(words[i],words[j],'S');
  for(const [,a,b] of data.opposites)add(a,b,'A');for(const [,a,b] of data.other)add(a,b,'N');
  for(const [,label,pairs] of data.analogies) { assert(new Set(pairs.map(p=>p[0])).size===pairs.length,label);assert(new Set(pairs.map(p=>p[1])).size===pairs.length,label); }
});
