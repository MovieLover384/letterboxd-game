import { apiRequest as api } from './letterboxd-api.js?v=4';
import { parseRatingsCsv } from './ratings-csv.mjs?v=2';

const form = document.getElementById('keepcut-form');
const usernameInput = document.getElementById('letterboxd-username');
const ratingsFile = document.getElementById('ratings-file');
const startButton = document.getElementById('start-button');
const startMessage = document.getElementById('start-message');
const poolSummary = document.getElementById('pool-summary');
const poolCount = document.getElementById('pool-count');
const poolLink = document.getElementById('pool-link');
const placeholder = document.getElementById('keepcut-placeholder');
const play = document.getElementById('keepcut-play');
const progress = document.getElementById('keepcut-progress');
const keepCount = document.getElementById('keep-count');
const cutCount = document.getElementById('cut-count');
const card = document.getElementById('keepcut-card');
const poster = document.getElementById('film-poster');
const posterFallback = document.getElementById('film-fallback');
const filmTitle = document.getElementById('film-title');
const filmMeta = document.getElementById('film-meta');
const filmLink = document.getElementById('film-link');
const keepButton = document.getElementById('keep-button');
const cutButton = document.getElementById('cut-button');
const undoButton = document.getElementById('undo-button');
const result = document.getElementById('keepcut-result');
const board = document.getElementById('keepcut-board');
const keepSlots = document.getElementById('keep-slots');
const cutSlots = document.getElementById('cut-slots');
const againButton = document.getElementById('again-button');
const copyButton = document.getElementById('copy-button');
const gameMessage = document.getElementById('keepcut-message');
const gamePanel = document.querySelector('.spin-panel');

const HALF = 4;
let busy = false;
let username = '';
let rating = '5';
let films = [];
let choices = [];
let verdict = { kept: [], cut: [] };
let csvText = null;
let deckSource = 'username';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}


function tally(choice) {
  return choices.filter((item) => item === choice).length;
}

function showFilm() {
  const film = films[choices.length];
  progress.textContent = `FILM ${choices.length + 1} OF ${films.length}`;
  filmTitle.textContent = film.title;
  filmMeta.textContent = [film.year, film.runtime ? `${film.runtime} min` : null].filter(Boolean).join(' · ');
  filmLink.href = film.url;
  poster.hidden = !film.poster;
  posterFallback.hidden = Boolean(film.poster);
  if (film.poster) poster.src = film.poster;
  else poster.removeAttribute('src');
  undoButton.disabled = !choices.length;
  if (!reducedMotion) {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }
}

poster.addEventListener('error', () => {
  poster.hidden = true;
  posterFallback.hidden = false;
});

function initials(film) {
  const art = document.createElement('i');
  art.textContent = film.title.slice(0, 2).toUpperCase();
  return art;
}

function slot(film, position, isNew) {
  const item = document.createElement('li');
  item.className = 'keepcut-slot';
  if (!film) {
    const empty = document.createElement('span');
    empty.className = 'keepcut-slot-empty';
    empty.textContent = position + 1;
    item.append(empty);
    return item;
  }
  item.classList.toggle('is-new', isNew);
  const link = document.createElement('a');
  link.href = film.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = film.year ? `${film.title} (${film.year})` : film.title;
  const art = document.createElement('span');
  art.className = 'keepcut-slot-art';
  if (film.poster) {
    const image = new Image();
    image.alt = '';
    image.src = film.poster;
    image.addEventListener('error', () => image.replaceWith(initials(film)));
    art.append(image);
  } else {
    art.append(initials(film));
  }
  const title = document.createElement('span');
  title.className = 'keepcut-slot-title';
  title.textContent = film.title;
  link.append(art, title);
  item.append(link);
  return item;
}

// Both rows always show four slots; the newest film dropped into a row gets a small entrance.
function renderBoard(kept, cut, newest = null) {
  const fill = (list, films) => list.replaceChildren(
    ...Array.from({ length: HALF }, (_, index) => slot(films[index], index, films[index] === newest)));
  fill(keepSlots, kept);
  fill(cutSlots, cut);
  keepCount.textContent = kept.length;
  cutCount.textContent = cut.length;
}

function decided() {
  return {
    kept: films.filter((_, index) => choices[index] === 'keep'),
    cut: films.filter((_, index) => choices[index] === 'cut'),
  };
}

function finish() {
  // Once one side holds four films, every film left over belongs to the other side.
  const keepFull = tally('keep') === HALF;
  const kept = [];
  const cut = [];
  films.forEach((film, index) => {
    const choice = choices[index] || (keepFull ? 'cut' : 'keep');
    (choice === 'keep' ? kept : cut).push(film);
  });
  verdict = { kept, cut };
  renderBoard(kept, cut, films[choices.length - 1]);
  play.hidden = true;
  result.hidden = false;
  const auto = films.length - choices.length;
  message(gameMessage, auto
    ? `${keepFull ? 'Four kept' : 'Four cut'}, so the last ${auto === 1 ? 'film goes' : `${auto} films go`} to ${keepFull ? 'cut' : 'kept'} automatically.`
    : 'All eight decided. No take-backs now.');
}

function choose(choice) {
  if (play.hidden || busy) return;
  choices.push(choice);
  if (tally('keep') === HALF || tally('cut') === HALF || choices.length === films.length) finish();
  else {
    const { kept, cut } = decided();
    renderBoard(kept, cut, films[choices.length - 1]);
    showFilm();
  }
}

keepButton.addEventListener('click', () => choose('keep'));
cutButton.addEventListener('click', () => choose('cut'));
undoButton.addEventListener('click', () => {
  if (!choices.length || play.hidden) return;
  choices.pop();
  const { kept, cut } = decided();
  renderBoard(kept, cut);
  showFilm();
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest?.('input, textarea, select, summary') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); choose('keep'); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); choose('cut'); }
});
function preload(items) {
  return Promise.all(items.filter((film) => film.poster).map((film) => new Promise((resolve) => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = film.poster;
    setTimeout(resolve, 2500);
  })));
}

async function addCsvPosters(movies) {
  try {
    const response = await fetch('movie-pool.json?v=1', { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return movies;
    const pool = await response.json();
    const key = (movie) => `${movie.title.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}:${movie.year}`;
    const posters = new Map(pool.filter((movie) => movie.poster?.startsWith('/')).map((movie) =>
      [key(movie), `https://image.tmdb.org/t/p/w342${movie.poster}`]));
    return movies.map((movie) => ({ ...movie, poster: posters.get(key(movie)) || null }));
  } catch { return movies; }
}

async function showDeal(data, source) {
  await preload(data.movies);
  films = data.movies;
  choices = [];
  deckSource = source;
  poolCount.textContent = `${data.count.toLocaleString()} ${data.count === 1 ? 'film' : 'films'} in the draw`;
  poolLink.href = source === 'csv' ? 'https://letterboxd.com/user/exportdata/' :
    `https://letterboxd.com/${encodeURIComponent(username)}/films/rated/${rating}/by/date/`;
  poolLink.textContent = source === 'csv' ? 'Export your data ↗' : 'View ratings ↗';
  poolSummary.hidden = false;
  placeholder.hidden = true;
  board.hidden = false;
  result.hidden = true;
  play.hidden = false;
  renderBoard([], []);
  showFilm();
  gamePanel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  message(startMessage, source === 'csv' ? `Picked from ${data.count.toLocaleString()} films in your ratings.csv.` :
    `Picked from ${data.count.toLocaleString()} films for @${username}.`);
  message(gameMessage, 'Use the ← and → keys on a keyboard, or tap the buttons.');
}

async function deal(source = 'username') {
  if (busy) return;
  busy = true;
  rating = document.querySelector('input[name="rating"]:checked').value;
  startButton.disabled = true;
  againButton.disabled = true;
  usernameInput.disabled = true;
  ratingsFile.disabled = true;
  startButton.firstChild.textContent = 'Dealing… ';
  message(startMessage, 'Reading your ratings and picking eight films…');
  try {
    let data;
    if (source === 'csv') {
      if (!csvText) {
        const file = ratingsFile.files?.[0];
        if (!file || file.size > 20_000_000) throw new Error('Choose a ratings.csv file under 20 MB.');
        csvText = await file.text();
      }
      const pool = parseRatingsCsv(csvText, rating);
      if (pool.length < 8) throw new Error(`Only ${pool.length} films meet that rating. Choose a lower rating.`);
      data = { count: pool.length, movies: await addCsvPosters(shuffle(pool).slice(0, 8)) };
    } else data = await api(`api/keepcut?username=${encodeURIComponent(username)}&min=${rating}`);
    await showDeal(data, source);
  } catch (error) {
    message(startMessage, error.message, true);
  } finally {
    busy = false;
    startButton.disabled = false;
    againButton.disabled = false;
    usernameInput.disabled = false;
    ratingsFile.disabled = false;
    startButton.firstChild.textContent = 'Deal my films ';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = usernameInput.value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,39}$/.test(value)) {
    message(startMessage, 'Enter a valid Letterboxd username.', true);
    usernameInput.focus();
    return;
  }
  username = value;
  deal('username');
});

ratingsFile.addEventListener('change', () => { csvText = null; deal('csv'); });
againButton.addEventListener('click', () => deal(deckSource));

copyButton.addEventListener('click', async () => {
  const names = (list) => list.map((film) => film.year ? `${film.title} (${film.year})` : film.title).join(', ');
  const label = deckSource === 'csv' ? 'my ratings' : `@${username}`;
  const text = `Keep 4, Cut 4 (${label})\nKept: ${names(verdict.kept)}\nCut: ${names(verdict.cut)}`;
  try {
    await navigator.clipboard.writeText(text);
    message(gameMessage, 'Result copied to your clipboard.');
  } catch {
    message(gameMessage, 'Could not copy automatically. Select the lists and copy them instead.', true);
  }
});
