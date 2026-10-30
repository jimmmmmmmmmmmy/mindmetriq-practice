const { test } = require('node:test');
const assert = require('node:assert/strict');
const results = require('../js/results');
const review = require('../js/review');
const { create } = require('../js/game-logic');
let seed = 42;
const logic = create(() => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; });

test('practice summary separates accuracy, time, tier points and deadline outcomes', () => {
  const r = [
    {correct:true,used:4,level:2,info:{}},
    {correct:false,used:12,level:3,info:{timedOut:true}},
    {correct:true,used:20,level:2,info:{timedOut:true}},
    {correct:false,used:3,level:1,info:{}}
  ];
  const s = results.summarize(r);
  assert.equal(s.correct,2); assert.equal(s.total,4); assert.equal(s.time,39);
  assert.equal(s.points,4); assert.equal(s.possible,8);
  assert.equal(s.meanLevel,2); assert.equal(s.maxLevel,3);
  assert.equal(s.deadlines,2); assert.equal(s.missedAtDeadline,1);
  assert.deepEqual(s.levels[1],{level:2,total:2,correct:2,used:24});
  assert.equal(s.levels[4].total,0);
  const feedback=results.feedback(s,'net');
  assert.match(feedback.observation,/2 of 4 answers were missed/);
  assert.match(feedback.observation,/1 of those reached the time limit/);
  assert(!Object.keys(s).some(key=>/expected|percentile|ability/i.test(key)));
});
test('no-answer summary has no NaN or fabricated ability estimate',()=> {
  const s=results.summarize([]);
  assert.equal(s.meanLevel,0);assert.equal(s.maxLevel,0);assert.equal(s.points,0);
});
test('net review highlights the independently correct placement on the original grid',()=> {
  const s={g:[-4,0,2,0,0,0,5,0,0,0,...Array(15).fill(0)],sh:{cells:[[0,0],[1,0]],w:2,h:1},pos:[0,0],bp:[1,1],best:5};
  const html=review.render('net',s);
  assert.match(html,/solution" data-cell="6"/);assert.match(html,/solution" data-cell="7"/);
  assert.match(html,/5 \+ 0 = 5/);
  assert.match(review.render('net',s,'submitted'),/\(-4\) \+ 0 = -4/);
});
test('racer review respects duplicate positions and accepts a correct alternative subset',()=> {
  const s={nums:[2,3,-1,6,2],got:[2,3],sol:[0,1],target:5};
  const correct=review.render('racer',s);
  assert.match(correct,/Your valid solution/);
  assert.match(correct,/solution" data-number="2"/); assert.match(correct,/solution" data-number="3"/);
  assert.doesNotMatch(correct,/solution" data-number="0"/);
  assert.match(correct,/\(-1\) \+ 6 = 5/);
});
test('1,000 pipe reviews reconstruct a valid route without changing fixed tiles or inventory',()=> {
  for(let i=0;i<1000;i++) {
    const s=logic.pipes.newItem(i%5+1), original=structuredClone(s);
    const solved=review.pipeSolution(s);
    assert(logic.pipes.connected(solved,s.s,s.N));
    assert.deepEqual(s,original,'review must not modify the saved submission');
    assert.deepEqual(solved.map(c=>c.t+':'+c.m).sort(),s.cells.map(c=>c.t+':'+c.m).sort());
    s.cells.forEach((c,i)=> { if(c.t==='e' || c.t==='x') assert.deepEqual(solved[i],c); });
    assert.deepEqual(review.trace(solved,s.s,s.N),s.path);
  }
});
test('spinner review checks every pair at the visible submitted and correct rotations',()=> {
  for(let level=1;level<=5;level++) {
    const item=logic.spinner.newItem(level), s={...item,rot:0};
    const solved=review.render('spinner',s), submitted=review.render('spinner',s,'submitted');
    assert.equal((solved.match(/class="pair-pass"/g)||[]).length,item.n);
    assert.match(submitted,/class="pair-fail"/);
    assert.match(submitted,/Position:<\/b> 0 steps clockwise/);
    assert.equal(s.rot,0);
  }
});
test('verbal review explains the relationship and distinguishes an unanswered item',()=> {
  const word={b:[1,'puppy','dog','kitten','cat'],opts:['horse','cat','sheep','pig','duck'],selected:-1,relation:'young animal → adult'};
  assert.match(review.render('wordlogic',word),/cat<small>Correct answer/);
  assert.match(review.render('wordlogic',word,'submitted'),/No answer submitted/);
  const swipe={words:['lock','key'],answer:'N',picked:'S'};
  assert.match(review.render('swipe',swipe),/Other<small>Correct relationship/);
  assert.match(review.render('swipe',swipe,'submitted'),/Almost the same<small>Your answer/);
});
test('all word content is escaped before review HTML is generated',()=> {
  const s={words:['<img src=x onerror=alert(1)>','"other"'],answer:'N',picked:null};
  const html=review.render('swipe',s);
  assert(!html.includes('<img')); assert(html.includes('&lt;img'));
});
test('first missed item is expanded, all correct items remain reviewable',()=> {
  const snapshot={words:['up','down'],answer:'A',picked:'A'};
  const r=Array.from({length:3},(_,i)=>({correct:i!==1,used:1,level:2,info:{},snapshot}));
  const html=review.list('swipe',r);
  assert.match(html,/id="review-1" open/);
  assert.doesNotMatch(html,/id="review-0" open/);
  assert.equal((html.match(/class="answer-review"/g)||[]).length,3);
});
