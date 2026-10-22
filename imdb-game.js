const elements = {
  arena: document.getElementById('imdb-arena'),
  loading: document.getElementById('loading'),
  controls: document.getElementById('guess-controls'),
  left: document.getElementById('leftFilm'),
  right: document.getElementById('rightFilm'),
  higher: document.getElementById('higherBtn'),
  lower: document.getElementById('lowerBtn'),
  next: document.getElementById('nextBtn'),
  result: document.getElementById('result'),
  score: document.getElementById('score'),
  best: document.getElementById('highscore'),
  instruction: document.getElementById('instruction'),
};
let movies = [];
let remaining = [];
let mode = 'rating';
let left = null;
let right = null;
let score = 0;
let finished = false;
let nextTimer = null;
let slideTimer = null;

function metric(movie) { return mode === 'rating' ? movie.rating : movie.votes; }
function bestKey() { return `movieknowledge-imdb-${mode}-best-v1`; }
function readBest() {
  try { return Math.max(0, Number(localStorage.getItem(bestKey())) || 0); }
  catch { return 0; }
}
function updateScores() {
  elements.score.textContent = `Score: ${score}`;
  elements.best.textContent = `High Score: ${readBest()}`;
}
function saveBest() {
  if (score <= readBest()) return;
  try { localStorage.setItem(bestKey(), String(score)); } catch {}
  updateScores();
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function fillPool() { remaining = shuffle([...movies]); }
function draw(except) {
  const index = remaining.findIndex(movie => !except ||
    (movie.imdbId !== except.imdbId && metric(movie) !== metric(except)));
  if (index < 0) return null;
  return remaining.splice(index, 1)[0];
}
function numberText(movie) {
  return mode === 'rating'
    ? `${movie.rating.toFixed(1)} / 10`
    : new Intl.NumberFormat('en-US').format(movie.votes);
}
function renderFilm(element, movie, reveal) {
  const image = element.querySelector('img');
  const poster = `https://image.tmdb.org/t/p/w342${movie.poster}`;
  image.alt = `${movie.title} poster`;
  if (image.getAttribute('src') !== poster) {
    image.classList.add('is-loading');
    image.onload = () => image.classList.remove('is-loading');
    image.onerror = () => {
      image.onerror = null;
      image.src = 'posters/interstellar.jpg';
    };
    image.src = poster;
  }
  element.querySelector('h2').textContent = movie.title;
  element.querySelector('.imdb-year').textContent = `(${movie.year})`;
  const number = element.querySelector('.imdb-number');
  number.textContent = `${mode === 'rating' ? '★' : '●'} ${reveal ? numberText(movie) : '???'}`;
  element.querySelector('.imdb-meta').textContent = mode === 'rating'
    ? `${new Intl.NumberFormat('en-US').format(movie.votes)} ratings`
    : `★ ${movie.rating.toFixed(1)} IMDb rating`;
}
function render() {
  renderFilm(elements.left, left, true);
  renderFilm(elements.right, right, finished);
  elements.arena.hidden = false;
  elements.controls.hidden = false;
  elements.higher.disabled = false;
  elements.lower.disabled = false;
}
function newRound() {
  finished = false;
  elements.arena.classList.remove('is-sliding');
  elements.result.textContent = '';
  elements.result.classList.remove('wrong');
  elements.next.hidden = true;
  if (!left) {
    if (remaining.length < 2) fillPool();
    left = draw(null);
  }
  right = draw(left);
  if (!right) {
    fillPool();
    remaining = remaining.filter(movie => movie.imdbId !== left.imdbId);
    right = draw(left);
  }
  if (!left || !right) {
    elements.loading.textContent = 'There are not enough films for this mode.';
    elements.loading.hidden = false;
    elements.arena.hidden = true;
    elements.controls.hidden = true;
    return;
  }
  render();
}
function restart() {
  clearTimeout(nextTimer);
  clearTimeout(slideTimer);
  score = 0;
  left = null;
  right = null;
  fillPool();
  updateScores();
  newRound();
}
function guess(higher) {
  if (finished || !left || !right) return;
  finished = true;
  elements.higher.disabled = true;
  elements.lower.disabled = true;
  renderFilm(elements.right, right, true);
  const correct = higher ? metric(right) > metric(left) : metric(right) < metric(left);
  if (correct) {
    score++;
    updateScores();
    saveBest();
    elements.result.textContent = `Correct! ${right.title} has ${numberText(right)}.`;
    slideTimer = setTimeout(() => {
      elements.arena.classList.add('is-sliding');
      nextTimer = setTimeout(() => {
        left = right;
        newRound();
      }, 700);
    }, 900);
  } else {
    elements.result.textContent = `Wrong! ${right.title} has ${numberText(right)}. Final Score: ${score}`;
    elements.result.classList.add('wrong');
    elements.next.hidden = false;
  }
}
function setMode(nextMode) {
  if (nextMode === mode || !movies.length) return;
  mode = nextMode;
  document.querySelectorAll('.imdb-mode button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  elements.instruction.textContent = mode === 'rating'
    ? "Is the right film's IMDb rating higher or lower than the left film's?"
    : 'Does the right film have more or fewer IMDb user votes than the left film?';
  document.getElementById('hero-description').textContent = mode === 'rating'
    ? 'Guess if the right film has a higher or lower IMDb rating than the left film.'
    : 'Guess if the right film has more or fewer IMDb user votes than the left film.';
  restart();
}

elements.higher.addEventListener('click', () => guess(true));
elements.lower.addEventListener('click', () => guess(false));
elements.next.addEventListener('click', restart);
document.querySelectorAll('.imdb-mode button').forEach(button =>
  button.addEventListener('click', () => setMode(button.dataset.mode)));

try {
  const response = await fetch('imdb-game.json?v=1');
  if (!response.ok) throw new Error('Data request failed');
  const data = await response.json();
  movies = data.movies.filter(movie => movie.imdbId?.startsWith('tt') && movie.poster?.startsWith('/')
    && Number.isFinite(movie.rating) && Number.isFinite(movie.votes) && movie.votes >= 5000);
  if (movies.length < 2) throw new Error('Movie pool is empty');
  elements.loading.hidden = true;
  restart();
} catch {
  elements.loading.textContent = 'Could not load the IMDb game data. Please refresh and try again.';
  elements.loading.hidden = false;
}
