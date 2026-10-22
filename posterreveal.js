(() => {
  const $ = (id) => document.getElementById(id);
  const posterBase = 'https://image.tmdb.org/t/p/w500';
  const highScoreKey = 'movieknowledge-posterreveal-highscore';
  const recentKey = 'movieknowledge-posterreveal-recent-v1';
  // Blur in pixels for each clue. The last clue shows the poster sharp.
  const blurs = [30, 19, 11, 6, 2.5, 0];
  const clueCount = blurs.length;
  // The pool is sorted most well-known first, so the top films are the ones most people can name.
  const answerCount = 700;
  const spacing = 150;
  let answers = [];
  let film = null;
  let clue = 1;
  let over = false;
  let score = 0;
  let highScore = 0;
  let search;
  let recent = [];
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }
  try { recent = JSON.parse(localStorage.getItem(recentKey)) || []; } catch { /* Private browsing. */ }

  function nextFilm() {
    const blocked = new Set(recent.slice(-Math.min(spacing, Math.floor(answers.length / 2))));
    const options = answers.filter((item) => !blocked.has(item.id));
    const next = options[Math.floor(Math.random() * options.length)];
    recent = [...recent.filter((id) => id !== next.id), next.id].slice(-spacing * 2);
    try { localStorage.setItem(recentKey, JSON.stringify(recent)); } catch { /* Keep playing. */ }
    return next;
  }

  function renderScores() {
    $('score').innerText = `Score: ${score}`;
    $('highscore').innerText = `High Score: ${highScore}`;
  }

  function showResult(message, good) {
    const box = $('result');
    box.textContent = message;
    box.dataset.tone = good ? 'good' : 'bad';
  }

  function render() {
    const image = $('poster-image');
    const sharp = over || blurs[clue - 1] === 0;
    image.style.filter = sharp ? 'none' : `blur(${blurs[clue - 1]}px)`;
    image.classList.toggle('is-clear', sharp);
    const points = clueCount + 1 - clue;
    $('reveal-count').textContent = over ? 'The poster' : `Clue ${clue} of ${clueCount}`;
    $('reveal-points').textContent = over ? '' : `Worth ${points} point${points === 1 ? '' : 's'}`;
    $('reveal-steps').replaceChildren(...blurs.map((_, index) =>
      Object.assign(document.createElement('span'), { className: index < clue ? 'is-on' : '' })));
    $('moreMoviesBtn').hidden = over || clue >= clueCount;
    $('guessBtn').hidden = over;
    $('giveUpBtn').hidden = over;
    $('guess-area').hidden = over;
    $('playAgainBtn').hidden = !over;
  }

  function start() {
    film = nextFilm();
    clue = 1;
    over = false;
    search.reset();
    $('movieSearch').disabled = false;
    $('result').textContent = '';
    const image = $('poster-image');
    image.alt = 'A blurred movie poster you need to guess';
    image.src = `${posterBase}${film.poster}`;
    render();
    $('movieSearch').focus({ preventScroll: true });
  }

  function finish(won, points) {
    over = true;
    if (won) {
      score += points;
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem(highScoreKey, String(highScore)); } catch { /* Keep playing. */ }
      }
    } else {
      score = 0;
    }
    $('poster-image').alt = `Poster for ${film.title}`;
    renderScores();
    $('movieSearch').disabled = true;
    render();
  }

  function guess() {
    if (over) return;
    const picked = search.selected();
    if (!picked) { showResult('Pick a movie from the list first.', false); return; }
    const title = `${film.title} (${film.year})`;
    if (picked.id === film.id) {
      const points = clueCount + 1 - clue;
      showResult(`Correct! It is ${title}. You earn ${points} point${points === 1 ? '' : 's'}.`, true);
      finish(true, points);
      return;
    }
    if (clue >= clueCount) {
      showResult(`Not quite. It was ${title}. Your streak resets.`, false);
      finish(false, 0);
      return;
    }
    showResult(`${picked.title} is not it. The poster gets sharper.`, false);
    search.reset();
    clue += 1;
    render();
  }

  function sharpen() {
    if (over || clue >= clueCount) return;
    showResult('Sharpened. Here is a clearer poster.', false);
    clue += 1;
    render();
  }

  function giveUp() {
    if (over) return;
    showResult(`It was ${film.title} (${film.year}). Your streak resets.`, false);
    finish(false, 0);
  }

  $('guessBtn').addEventListener('click', guess);
  $('moreMoviesBtn').addEventListener('click', sharpen);
  $('giveUpBtn').addEventListener('click', giveUp);
  $('playAgainBtn').addEventListener('click', start);

  async function load() {
    try {
      const response = await fetch('movie-pool.json?v=2');
      if (!response.ok) throw new Error(`Movie pool returned ${response.status}`);
      const movies = (await response.json()).filter((movie) => movie.id && movie.title &&
        movie.poster?.startsWith('/') && Number.isInteger(movie.year));
      if (movies.length < answerCount) throw new Error('The movie pool is incomplete');
      answers = movies.slice(0, answerCount);
      search = createMovieSearch({ input: $('movieSearch'), list: $('suggestions'), movies, onSubmit: guess });
      renderScores();
      $('load-message').hidden = true;
      $('reveal-game').hidden = false;
      start();
    } catch (error) {
      console.warn('Could not load Poster Reveal:', error);
      $('load-message').textContent = 'Could not load the posters. Refresh to try again.';
    }
  }
  load();
})();
