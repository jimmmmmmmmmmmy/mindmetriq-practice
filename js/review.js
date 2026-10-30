// Render saved, immutable answer snapshots. Review never changes live game state.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game-logic.js').create());
  else root.MMQReview = factory(root.MMQLogic);
})(typeof globalThis !== 'undefined' ? globalThis : this, logic => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const equation = values => values.length ? values.map(v => v < 0 ? `(${v})` : v).join(' + ') + ' = ' + values.reduce((a,b) => a+b,0) : 'No numbers = 0';
  const note = (label, text) => `<p class="review-explanation"><b>${escape(label)}</b> ${escape(text)}</p>`;
  function net(s, solution) {
    const pos = solution ? s.bp : s.pos;
    const indices = s.sh.cells.map(([x,y]) => (pos[1]+y)*5+pos[0]+x);
    const values = indices.map(i => s.g[i]);
    return `<div class="review-grid" style="--columns:5" role="img" aria-label="${solution ? 'Best' : 'Submitted'} net placement; sum ${values.reduce((a,b)=>a+b,0)}">` + s.g.map((v,i) =>
      `<div class="review-cell ${indices.includes(i) ? (solution ? 'solution' : 'submitted') : ''}" data-cell="${i}">${v || '·'}</div>`).join('') + '</div>' +
      note(solution ? 'Highest possible sum:' : 'Your sum:', equation(values)) +
      note('Why:', `Only numbers in the highlighted net count. The best total is ${s.best}; negative tiles subtract from the sum.`);
  }
  function racer(s, solution) {
    // A correct alternative subset is shown as correct, even if it differs from
    // the subset originally used to construct the target.
    const userCorrect = s.got.reduce((sum,i) => sum+s.nums[i],0) === s.target;
    const selected = solution ? (userCorrect ? s.got : s.sol) : s.got;
    return note('Target:', s.target) + `<ol class="review-numbers" aria-label="Numbers in falling order">` + s.nums.map((v,i) =>
      `<li class="review-number ${selected.includes(i) ? (solution ? 'solution' : 'submitted') : ''}" data-number="${i}"><small>#${i+1}</small><b>${v}</b><span>${selected.includes(i) ? (solution ? 'Catch' : 'Caught') : (solution ? 'Avoid' : 'Missed')}</span></li>`).join('') + '</ol>' +
      note(solution ? (userCorrect ? 'Your valid solution:' : 'One valid solution:') : 'Your collected sum:', equation(selected.map(i=>s.nums[i]))) +
      note('Why:', 'The collected sum must equal the target exactly. Other subsets can also be correct.');
  }
  const labels = { A: 'Almost opposite', N: 'Other', S: 'Almost the same' };
  function swipe(s, solution) {
    const selected = solution ? s.answer : s.picked;
    const why = s.answer === 'S' ? 'These words have similar meanings.' : s.answer === 'A' ? 'These words have opposite meanings.' : 'These words have another relationship; they are neither synonyms nor antonyms.';
    return `<p class="review-prompt">${escape(s.words[0])} <span>/</span> ${escape(s.words[1])}</p><div class="review-options">` +
      Object.entries(labels).map(([key,text]) => `<div class="review-option ${selected === key ? (solution ? 'solution' : 'submitted') : ''}">${escape(text)}${selected === key ? `<small>${solution ? 'Correct relationship' : 'Your answer'}</small>` : ''}</div>`).join('') + '</div>' +
      (!solution && !s.picked ? note('Your answer:', 'No answer submitted.') : '') + note('Why:', why);
  }
  function word(s, solution) {
    const selected = solution ? s.opts.indexOf(s.b[4]) : s.selected;
    return `<p class="review-prompt">${escape(s.b[1])} → ${escape(s.b[2])}<br>${escape(s.b[3])} → ?</p><div class="review-options">` +
      s.opts.map((word,i) => `<div class="review-option ${i === selected ? (solution ? 'solution' : 'submitted') : ''}">${escape(word)}${i === selected ? `<small>${solution ? 'Correct answer' : 'Your answer'}</small>` : ''}</div>`).join('') + '</div>' +
      (!solution && s.selected < 0 ? note('Your answer:', 'No answer submitted.') : '') +
      note('Relationship:', s.relation) + note('Why:', `${s.b[1]} → ${s.b[2]} and ${s.b[3]} → ${s.b[4]} both follow this relationship in the same direction.`);
  }
  function pipeSolution(s) {
    const cells = s.cells.map(c=>({...c}));
    for (const p of s.path.slice(1,-1)) {
      if (cells[p].t === 'p' && cells[p].m === s.need[p]) continue;
      const j = cells.findIndex((q,k) => q.t === 'p' && q.m === s.need[p] && !(s.path.includes(k) && cells[k].m === s.need[k]));
      if (j < 0) throw new Error('Saved pipe inventory cannot reconstruct the solution');
      [cells[p],cells[j]] = [cells[j],cells[p]];
    }
    return cells;
  }
  function trace(cells, start, N) {
    const path = [start], dirs = { 1:[0,-1,4], 2:[1,0,8], 4:[0,1,1], 8:[-1,0,2] };
    let c = start, out = cells[start].m;
    for (let i=0;i<N*N;i++) {
      const d = dirs[out]; if (!d) break;
      const x=c%N+d[0], y=Math.floor(c/N)+d[1];
      if (x<0 || y<0 || x>=N || y>=N) break;
      const n=y*N+x;
      if (!(cells[n].m & d[2]) || path.includes(n)) break;
      path.push(n);
      if (cells[n].t === 'e') break;
      if (cells[n].t !== 'p') break;
      out=cells[n].m & ~d[2]; c=n;
    }
    return path;
  }
  function pipeTile(c) {
    if(c.t === 'x') return '<span aria-label="Fixed obstacle">■</span>';
    if(c.t === 'o') return '';
    const lines = [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]].filter(d=>c.m & d[2]).map(([x,y])=>`<line x1="50" y1="50" x2="${50+x*50}" y2="${50+y*50}"/>`).join('');
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="22">${lines}</g><circle cx="50" cy="50" r="${c.t === 'e' ? 18 : 11}" fill="currentColor"/></svg>`;
  }
  function pipes(s, solution) {
    const cells = solution ? pipeSolution(s) : s.cells;
    const path = solution ? s.path : trace(cells,s.s,s.N);
    return `<div class="review-grid review-pipes" style="--columns:${s.N}" role="img" aria-label="${solution ? 'One solved route between the fixed ends' : 'Your submitted pipe board'}">` +
      cells.map((c,i)=>`<div class="review-cell review-pipe ${c.t} ${path.includes(i) ? (solution ? 'solution' : 'submitted') : ''}" data-cell="${i}">${pipeTile(c)}${i===s.s || i===s.t ? '<small>End</small>' : ''}</div>`).join('') + '</div>' +
      note(solution ? 'One valid route:' : 'Your connected section:', solution ? 'The highlighted pipes connect the two fixed ends. The board uses the same tiles and fixed obstacles.' : 'The highlighted section is reachable from the starting end.') +
      note('Why:', 'Touching tiles connect only when both openings face each other. Other complete routes also count.');
  }
  const fills = {d:'#2f3437',w:'#fff',g:'#9aa3ab'}, shapes = {c:'circle',s:'square',t:'triangle',r:'diamond'}, shading = {d:'dark',w:'white',g:'grey'};
  function symbol(o,x,y,angle,size) {
    const st=`fill="${fills[o.f]}" stroke="#4e5963" stroke-width="1.5"`;
    let path;
    if(o.s==='c') path=`<circle r="${size*.8}" ${st}/>`;
    else if(o.s==='s' || o.s==='r') path=`<rect x="${-size*.7}" y="${-size*.7}" width="${size*1.4}" height="${size*1.4}" ${o.s==='r' ? 'transform="rotate(45)"' : ''} ${st}/>`;
    else path=`<polygon points="0,${size} ${-size*.9},${-size*.7} ${size*.9},${-size*.7}" ${st}/>`;
    return `<g transform="translate(${x},${y}) rotate(${angle})">${path}</g>`;
  }
  const polar = (deg,r) => [r*Math.sin(deg*Math.PI/180), -r*Math.cos(deg*Math.PI/180)];
  function spinner(s, solution) {
    const rotation = solution ? s.sol : s.rot, step=360/s.n;
    const pairs=s.outer.map((outer,i)=>({outer,inner:s.inner[(i-rotation+s.n)%s.n]}));
    let drawing=`<circle r="119" fill="${solution?'#dff1e5':'#fff0d2'}" stroke="${solution?'#247143':'#94600b'}" stroke-width="2"/>`;
    pairs.forEach(({outer,inner},i)=>{
      const a=i*step, [ox,oy]=polar(a,154), [ix,iy]=polar(a,81);
      const good=logic.spinner.ok(outer,inner);
      drawing+=`<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${good?'#247143':'#ac3c32'}" stroke-width="5" stroke-dasharray="${good?'0':'5 4'}"/>`;
      drawing+=symbol(outer,ox,oy,a,17)+symbol(inner,ix,iy,a+180,17);
      const [lx,ly]=polar(a,180);
      drawing+=`<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#46515a">${i+1}</text>`;
    });
    const checks=pairs.map(({outer,inner},i)=>{
      const sameShape=outer.s===inner.s, sameFill=outer.f===inner.f, good=sameShape!==sameFill;
      const why=good ? (sameShape?'Same shape only':'Same shading only') : sameShape?'Both shape and shading match':'Neither shape nor shading matches';
      return `<li class="${good?'pair-pass':'pair-fail'}">${good?'✓':'×'} Pair ${i+1}: ${why}<span class="review-sr">; outer ${shading[outer.f]} ${shapes[outer.s]}, inner ${shading[inner.f]} ${shapes[inner.s]}</span></li>`;
    }).join('');
    return `<svg class="review-wheel" viewBox="-185 -185 370 370" role="img" aria-label="${solution ? 'Correct' : 'Submitted'} wheel position, ${rotation} steps clockwise">${drawing}</svg>` +
      note('Position:', `${rotation} step${rotation===1?'':'s'} clockwise from the start.`) + `<ul class="review-pairs">${checks}</ul>`;
  }
  const renderers={ net, racer, swipe, wordlogic:word, pipes, spinner };
  function render(id,snapshot,view='solution') { return renderers[id](snapshot,view==='solution'); }
  function status(id,r) {
    if(r.correct) return r.info.timedOut && id!=='racer' ? 'Correct · submitted at the time limit' : 'Correct';
    return id==='racer' ? 'Target not reached' : r.info.timedOut ? 'Time limit reached' : 'Incorrect';
  }
  function list(id,results) {
    const firstMiss=results.findIndex(r=>!r.correct);
    return results.map((r,i)=>`<details class="answer-review" id="review-${i}" ${(i === (firstMiss<0?0:firstMiss))?'open':''}>
      <summary><span class="review-summary-title">Question ${i+1} <span class="${r.correct?'ok':'bad'}">${escape(status(id,r))}</span></span><span class="review-meta">Level ${r.level} · ${r.used.toFixed(1)}s${r.info.retryCount ? ` · ${r.info.retryCount} retr${r.info.retryCount===1?"y":"ies"}` : ""}</span></summary>
      <div class="review-content"><div class="review-toggle" role="group" aria-label="Question ${i+1} answer view">
      <button type="button" data-review="${i}" data-view="submitted" aria-pressed="false">Your answer</button><button type="button" data-review="${i}" data-view="solution" aria-pressed="true">${id==='pipes' || id==='racer' ? 'One valid solution' : 'Correct answer'}</button></div>
      <p class="review-view-label">${id==='pipes' || id==='racer' ? 'One valid solution' : 'Correct answer'} · highlighted in green</p>
      <div class="review-diagram" aria-live="polite">${render(id,r.snapshot)}</div></div></details>`).join('');
  }
  function bind(container,id,results) {
    container.onclick = event => {
      const button=event.target.closest('button[data-review]'); if(!button || !container.contains(button)) return;
      const r=results[Number(button.dataset.review)], panel=button.closest('.answer-review');
      const solution=button.dataset.view==='solution';
      panel.querySelector('.review-diagram').innerHTML=render(id,r.snapshot,button.dataset.view);
      panel.querySelectorAll('.review-toggle button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      panel.querySelector('.review-view-label').textContent=solution ? `${id==='pipes' || id==='racer' ? 'One valid solution' : 'Correct answer'} · highlighted in green` : 'Your answer · highlighted in amber';
    };
  }
  return { render, list, bind, escape, pipeSolution, trace };
});
