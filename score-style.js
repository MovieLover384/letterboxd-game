// Puts the Score and High score pills side by side, in the same style on every game.
// The games keep writing "Score: 3" into #score and #highscore; this reshapes that text.
document.addEventListener('DOMContentLoaded', () => {
  const score = document.getElementById('score');
  if (!score) return;
  const bar = document.createElement('div');
  bar.className = 'arcade-stats';
  score.before(bar);

  const pattern = /^\s*(High Score|Score):\s*(\d+)\s*$/i;
  function reshape(element) {
    const match = pattern.exec(element.textContent);
    if (!match) return;
    const label = match[1].toLowerCase() === 'score' ? 'Score' : 'High score';
    element.replaceChildren(`${label} `,Object.assign(document.createElement('strong'),{ textContent:match[2] }));
  }

  function adopt() {
    for (const id of ['score','highscore']) {
      const element = document.getElementById(id);
      if (!element) continue;
      element.className = '';
      if (element.parentElement !== bar) bar.append(element);
      reshape(element);
      new MutationObserver(() => reshape(element)).observe(element,{ childList:true,characterData:true,subtree:true });
    }
    bar.append(...['score','highscore'].map((id) => document.getElementById(id)).filter(Boolean));
  }
  adopt();
});
