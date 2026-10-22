function createGameScoreboard(game) {
  const panel = document.querySelector('body.game-page > section.container.flex-1');
  if (!panel) return { record() {} };
  const key = `movieknowledge-score-${game}`;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch { /* Private browsing. */ }
  let score = 0;
  const bar = document.createElement('div');
  bar.className = 'arcade-stats';
  bar.innerHTML = '<span>Score <strong data-stat="score">0</strong></span><span>High score <strong data-stat="best">0</strong></span>';
  panel.prepend(bar);
  const render = () => {
    bar.querySelector('[data-stat="score"]').textContent = score;
    bar.querySelector('[data-stat="best"]').textContent = best;
  };
  render();
  return { record(correct) {
    if (correct) score += 1;
    if (score > best) {
      best = score;
      try { localStorage.setItem(key,String(best)); } catch { /* Keep playing. */ }
    }
    render();
  } };
}
