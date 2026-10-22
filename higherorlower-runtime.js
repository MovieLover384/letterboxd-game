(() => {
  const $ = (id) => document.getElementById(id);
  const highScoreKey = 'runtimeGameHighScore';
  let movies = [];
  let remaining = [];
  let left = null;
  let right = null;
  let score = 0;
  let highScore = 0;
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }

  const minutes = (text) => {
    const match = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(text || '');
    return (Number(match[1]) || 0) * 60 + (Number(match[2]) || 0);
  };
  const label = (total) => (total >= 60 ? `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m` : `${total}m`);

  function pick() {
    if (!remaining.length) remaining = [...movies];
    return remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
  }

  function setButtons(disabled) {
    $('higherBtn').disabled = disabled;
    $('lowerBtn').disabled = disabled;
  }

  function card(movie, hidden) {
    const wrapper = document.createDocumentFragment();
    const image = Object.assign(new Image(), { src: movie.poster, alt: `Poster for ${movie.title}`, className: 'shadow-xl' });
    const title = Object.assign(document.createElement('h3'), { className: 'text-xl font-bold mt-2', textContent: movie.title });
    const time = Object.assign(document.createElement('p'), { className: 'text-orange-500 text-lg font-semibold mt-1', textContent: hidden ? '????' : label(movie.runtime) });
    wrapper.append(image, title, time);
    return wrapper;
  }

  function display() {
    $('leftFilm').replaceChildren(card(left, false));
    $('rightFilm').replaceChildren(card(right, true));
  }

  function startRound() {
    $('result').innerText = '';
    $('nextBtnContainer').classList.add('hidden');
    setButtons(false);
    if (!left) left = pick();
    do { right = pick(); } while (right === left);
    display();
  }

  function slide() {
    const leftDiv = $('leftFilm');
    const rightDiv = $('rightFilm');
    leftDiv.style.transition = 'transform 0.7s ease, opacity 0.7s ease';
    leftDiv.style.transform = 'translateX(-120%)';
    leftDiv.style.opacity = '0';
    rightDiv.style.transition = 'transform 0.7s ease';
    rightDiv.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      left = right;
      for (const div of [leftDiv, rightDiv]) { div.style.transition = ''; div.style.transform = ''; div.style.opacity = ''; }
      do { right = pick(); } while (right === left);
      display();
      setButtons(false);
    }, 700);
  }

  function guess(longer) {
    setButtons(true);
    $('rightFilm').querySelector('p').innerText = label(right.runtime);
    const correct = right.runtime === left.runtime || (longer ? right.runtime > left.runtime : right.runtime < left.runtime);
    if (correct) {
      score += 1;
      $('score').innerText = `Score: ${score}`;
      $('result').innerText = right.runtime === left.runtime ? 'Exactly the same length. Correct!' : 'Correct!';
      if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      setTimeout(slide, 900);
      return;
    }
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem(highScoreKey, String(highScore)); } catch { /* Keep playing. */ }
      $('highscore').innerText = `High Score: ${highScore}`;
    }
    $('result').innerText = `Wrong! ${right.title} runs ${label(right.runtime)}.\nFinal Score: ${score}`;
    $('nextBtnContainer').classList.remove('hidden');
    score = 0;
    $('score').innerText = 'Score: 0';
    left = null;
    remaining = [...movies];
  }

  $('higherBtn').addEventListener('click', () => guess(true));
  $('lowerBtn').addEventListener('click', () => guess(false));
  $('nextBtn').addEventListener('click', startRound);

  async function load() {
    try {
      const response = await fetch('guessmovie.json?v=1');
      if (!response.ok) throw new Error(`Film list returned ${response.status}`);
      movies = (await response.json()).map((item) => ({
        title: item.title,
        runtime: minutes(item.runtime),
        poster: String(item.poster_url || '').replace('/original/', '/w342/'),
      })).filter((movie) => movie.title && movie.runtime && movie.poster);
      remaining = [...movies];
      $('highscore').innerText = `High Score: ${highScore}`;
      startRound();
    } catch (error) {
      console.warn('Could not load Longer or Shorter:', error);
      $('result').innerText = 'Could not load the films. Refresh to try again.';
    }
  }
  load();
})();
