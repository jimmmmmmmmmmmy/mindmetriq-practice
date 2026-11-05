document.querySelectorAll('a.g').forEach(link => {
  const aptitude = link.dataset.id === 'ccat';
  const rows = aptitude ? CCATHistory.read() : MMQHistory.read(link.dataset.id);
  const best = aptitude ? CCATHistory.best(rows) : MMQHistory.best(rows);
  if (!best) return;

  const score = link.querySelector('.best');
  const label = aptitude ? 'Best full mock' : 'Best timed test';
  score.textContent = `${best.score}/${best.total}`;
  score.setAttribute('aria-label', `${label}: ${best.score} out of ${best.total}`);
  score.title = label;
});
