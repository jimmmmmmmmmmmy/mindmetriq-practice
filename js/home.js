document.querySelectorAll('a.g').forEach(link => {
  const best = MMQHistory.best(MMQHistory.read(link.dataset.id));
  if (!best) return;

  const score = link.querySelector('.best');
  score.textContent = `${best.score}/${best.total}`;
  score.setAttribute('aria-label', `Best timed test: ${best.score} out of ${best.total}`);
  score.title = 'Best timed test';
});
