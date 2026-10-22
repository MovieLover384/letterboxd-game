(() => {
  const $ = (id) => document.getElementById(id);
  const highScoreKey = 'movieknowledge-mastermind-highscore';
  const recentKey = 'movieknowledge-mastermind-recent-v1';
  const maxGuesses = 8;
  const columns = ['Film', 'Year', 'Genres', 'Director', 'Cast', 'Runtime', 'Rated'];
  let films = [];
  let answer = null;
  let guesses = [];
  let over = false;
  let score = 0;
  let highScore = 0;
  let search;
  let recent = [];
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }
  try { recent = JSON.parse(localStorage.getItem(recentKey)) || []; } catch { /* Private browsing. */ }

  const minutes = (text) => {
    const match = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(text || '');
    return (Number(match[1]) || 0) * 60 + (Number(match[2]) || 0);
  };
  const rated = (value) => (!value || value === 'Not Rated' || value === 'NR' ? 'NR' : value);
  const shared = (first, second) => first.filter((item) => second.includes(item));

  function nextFilm() {
    const blocked = new Set(recent.slice(-Math.min(100, Math.floor(films.length / 2))));
    const options = films.filter((film) => !blocked.has(film.title));
    const next = options[Math.floor(Math.random() * options.length)];
    recent = [...recent.filter((title) => title !== next.title), next.title].slice(-200);
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

  const cell = (status, ...content) => {
    const element = document.createElement('div');
    element.className = 'mm-cell';
    element.dataset.status = status;
    element.append(...content);
    return element;
  };
  const text = (value, className) => Object.assign(document.createElement('span'), { textContent: value, className: className || '' });
  const arrow = (difference) => text(difference > 0 ? '↑' : difference < 0 ? '↓' : '', 'mm-arrow');

  // One row of clues for a guess, compared with the mystery film.
  function compare(guess) {
    const yearGap = answer.year - guess.year;
    const runtimeGap = answer.runtime - guess.runtime;
    const sharedGenres = shared(guess.genres, answer.genres);
    const sharedCast = shared(guess.cast, answer.cast);
    const sameGenres = sharedGenres.length === guess.genres.length && sharedGenres.length === answer.genres.length;
    const sameCast = sharedCast.length === guess.cast.length && sharedCast.length === answer.cast.length;
    const genreCell = cell(sameGenres ? 'correct' : sharedGenres.length ? 'close' : 'wrong',
      ...guess.genres.map((genre) => text(genre, sharedGenres.includes(genre) ? 'is-shared' : '')));
    const castCell = cell(sameCast ? 'correct' : sharedCast.length ? 'close' : 'wrong',
      text(`${sharedCast.length} of ${answer.cast.length} shared`),
      ...sharedCast.map((name) => text(name, 'is-shared')));
    const film = document.createElement('div');
    film.className = 'mm-film';
    const poster = Object.assign(new Image(), { src: guess.poster, alt: '' });
    film.append(poster, text(guess.title));
    return [film,
      cell(yearGap === 0 ? 'correct' : Math.abs(yearGap) <= 5 ? 'close' : 'wrong', text(String(guess.year)), arrow(yearGap)),
      genreCell,
      cell(guess.director === answer.director ? 'correct' : 'wrong', text(guess.director)),
      castCell,
      cell(runtimeGap === 0 ? 'correct' : Math.abs(runtimeGap) <= 15 ? 'close' : 'wrong', text(`${guess.runtime} min`), arrow(runtimeGap)),
      cell(guess.rated === answer.rated ? 'correct' : 'wrong', text(guess.rated))];
  }

  function row(...children) {
    const element = document.createElement('div');
    element.className = 'mm-row';
    element.append(...children);
    return element;
  }

  function render() {
    const head = row(...columns.map((name) => text(name)));
    head.classList.add('mm-head');
    const empty = Array.from({ length: maxGuesses - guesses.length }, () =>
      row(...columns.map(() => Object.assign(document.createElement('div'), { className: 'mm-cell mm-cell-empty' }))));
    $('mm-board').replaceChildren(head, ...guesses.map((guess) => row(...compare(guess))), ...empty);
    $('mm-count').textContent = over ? 'Round over' : `Guess ${guesses.length + 1} of ${maxGuesses}`;
    $('mm-points').textContent = over ? '' : `Worth ${maxGuesses - guesses.length} point${maxGuesses - guesses.length === 1 ? '' : 's'}`;
    $('guessBtn').hidden = over;
    $('giveUpBtn').hidden = over;
    $('guess-area').hidden = over;
    $('playAgainBtn').hidden = !over;
    $('mm-answer').hidden = !over;
    if (over) {
      $('mm-answer-poster').src = answer.poster;
      $('mm-answer-title').textContent = `${answer.title} (${answer.year})`;
      $('mm-answer-meta').textContent = `Directed by ${answer.director}. ${answer.genres.join(', ')}.`;
    }
  }

  function start() {
    answer = nextFilm();
    guesses = [];
    over = false;
    search.reset();
    $('movieSearch').disabled = false;
    $('result').textContent = '';
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
    renderScores();
    $('movieSearch').disabled = true;
    render();
  }

  function guess() {
    if (over) return;
    const picked = search.selected();
    if (!picked) { showResult('Pick a movie from the list first.', false); return; }
    if (guesses.includes(picked)) { showResult(`You already guessed ${picked.title}.`, false); return; }
    guesses.push(picked);
    search.reset();
    if (picked === answer) {
      const points = maxGuesses + 1 - guesses.length;
      showResult(`Correct! It is ${answer.title} (${answer.year}). You earn ${points} point${points === 1 ? '' : 's'}.`, true);
      finish(true, points);
    } else if (guesses.length >= maxGuesses) {
      showResult(`Out of guesses. It was ${answer.title} (${answer.year}). Your streak resets.`, false);
      finish(false, 0);
    } else {
      showResult('', false);
      render();
    }
  }

  function giveUp() {
    if (over) return;
    showResult(`It was ${answer.title} (${answer.year}). Your streak resets.`, false);
    finish(false, 0);
  }

  $('guessBtn').addEventListener('click', guess);
  $('giveUpBtn').addEventListener('click', giveUp);
  $('playAgainBtn').addEventListener('click', start);

  async function load() {
    try {
      const response = await fetch('guessmovie.json?v=1');
      if (!response.ok) throw new Error(`Film list returned ${response.status}`);
      films = (await response.json()).map((item) => ({
        title: item.title,
        year: Number(item.year),
        genres: item.genres || [],
        director: item.director,
        cast: (item.cast || []).slice(0, 5),
        runtime: minutes(item.runtime),
        rated: rated(item.certification),
        poster: String(item.poster_url || '').replace('/original/', '/w154/'),
      })).filter((film) => film.title && film.year && film.genres.length && film.director && film.cast.length && film.runtime);
      if (films.length < 50) throw new Error('The film list is incomplete');
      search = createMovieSearch({ input: $('movieSearch'), list: $('suggestions'), movies: films, onSubmit: guess });
      renderScores();
      $('load-message').hidden = true;
      $('mm-game').hidden = false;
      start();
    } catch (error) {
      console.warn('Could not load Movie Mastermind:', error);
      $('load-message').textContent = 'Could not load the films. Refresh to try again.';
    }
  }
  load();
})();
