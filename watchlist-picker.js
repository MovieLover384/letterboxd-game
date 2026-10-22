import { apiRequest as api, warmUpApi } from './letterboxd-api.js?v=5';

warmUpApi();

const form = document.getElementById('watchlist-form');
const usernameInput = document.getElementById('letterboxd-username');
const loadButton = document.getElementById('load-button');
const loadMessage = document.getElementById('load-message');
const summary = document.getElementById('watchlist-summary');
const countLabel = document.getElementById('watchlist-count');
const watchlistLink = document.getElementById('watchlist-link');
const spinButton = document.getElementById('spin-button');
const spinMessage = document.getElementById('spin-message');
const stage = document.getElementById('spin-stage');
const placeholder = document.getElementById('spin-placeholder');
const reel = document.getElementById('spin-reel');
const reelTitle = document.getElementById('spin-reel-title');
const reelNote = document.getElementById('spin-reel-note');
const rouletteWindow = document.getElementById('roulette-window');
const rouletteTrack = document.getElementById('roulette-track');
const result = document.getElementById('spin-result');
const resultTitle = document.getElementById('result-title');
const resultMeta = document.getElementById('result-meta');
const resultLink = document.getElementById('result-link');
const resultPoster = document.getElementById('result-poster');
const posterFallback = document.getElementById('poster-fallback');

let loadedUsername = '';
let movies = [];
let previewMovies = [];
let previewImages = [];
let busy = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function preparePreview() {
  previewImages = [];
  const withPosters = movies.filter((movie) => movie.poster);
  previewMovies = shuffle(withPosters.length >= 3 ? withPosters : movies).slice(0, 28);
  for (const movie of previewMovies) {
    if (!movie.poster) continue;
    const image = new Image();
    image.src = movie.poster;
    previewImages.push(image);
  }
}

function message(element, text, error = false) {
  element.textContent = text;
  element.classList.toggle('error', error);
}


function resetResult() {
  stage.classList.remove('is-spinning', 'is-landing');
  placeholder.hidden = false;
  reel.hidden = true;
  result.hidden = true;
}

function invalidateWatchlist() {
  if (usernameInput.value.trim().toLowerCase() === loadedUsername) return;
  loadedUsername = '';
  movies = [];
  previewMovies = [];
  previewImages = [];
  summary.hidden = true;
  spinButton.disabled = true;
  spinButton.firstChild.textContent = 'Spin watchlist ';
  resetResult();
  message(spinMessage, 'All films in your loaded watchlist are in the draw.');
}

usernameInput.addEventListener('input', () => { if (!busy) invalidateWatchlist(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const username = usernameInput.value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,39}$/.test(username)) {
    message(loadMessage, 'Enter a valid Letterboxd username.', true);
    usernameInput.focus();
    return;
  }
  busy = true;
  loadButton.disabled = true;
  spinButton.disabled = true;
  loadButton.textContent = 'Loading…';
  message(loadMessage, 'Loading every page of your public watchlist…');
  resetResult();
  try {
    const data = await api(`api/watchlist?username=${encodeURIComponent(username)}`, { timeoutMs: 60000 });
    loadedUsername = username.toLowerCase();
    movies = data.movies;
    preparePreview();
    countLabel.textContent = `${data.count.toLocaleString()} ${data.count === 1 ? 'film' : 'films'} ready`;
    watchlistLink.href = `https://letterboxd.com/${encodeURIComponent(username)}/watchlist/`;
    summary.hidden = false;
    spinButton.disabled = false;
    placeholder.querySelector('p').textContent = 'Your watchlist is ready. Give it a spin.';
    message(loadMessage, `Loaded ${data.count.toLocaleString()} films from @${username}.`);
  } catch (error) {
    loadedUsername = '';
    movies = [];
    previewMovies = [];
    previewImages = [];
    summary.hidden = true;
    message(loadMessage, error.message, true);
  } finally {
    busy = false;
    loadButton.disabled = false;
    loadButton.textContent = 'Load watchlist';
  }
});

function showFilm(movie) {
  stage.classList.remove('is-spinning', 'is-landing');
  placeholder.hidden = true;
  reel.hidden = true;
  result.hidden = false;
  resultTitle.textContent = movie.title;
  resultMeta.textContent = [movie.year, movie.runtime ? `${movie.runtime} min` : null].filter(Boolean).join(' · ') || 'From your watchlist';
  resultLink.href = movie.url;
  resultPoster.hidden = !movie.poster;
  posterFallback.hidden = Boolean(movie.poster);
  if (movie.poster) resultPoster.src = movie.poster;
  else resultPoster.removeAttribute('src');
  spinButton.firstChild.textContent = 'Spin again ';
}

resultPoster.addEventListener('error', () => {
  resultPoster.hidden = true;
  posterFallback.hidden = false;
});

function createReelCard(movie) {
  const card = document.createElement('div');
  card.className = 'roulette-card';
  const image = document.createElement('img');
  image.alt = '';
  const fallback = document.createElement('span');
  fallback.className = 'roulette-card-fallback';
  fallback.textContent = movie.title.slice(0, 2).toUpperCase();
  if (movie.poster) {
    image.onerror = () => {
      if (image.getAttribute('src') === movie.poster) {
        image.hidden = true;
        fallback.hidden = false;
      }
    };
    image.src = movie.poster;
    fallback.hidden = true;
  } else {
    image.hidden = true;
  }
  card.append(image, fallback);
  return card;
}

async function runRoulette(movie) {
  if (reducedMotion) return;
  const choices = previewMovies.length ? previewMovies : movies;
  let deck = [];
  while (deck.length < 27) deck.push(...shuffle(choices));
  deck = deck.slice(0, 27);
  const cards = deck.map(createReelCard);
  const winner = createReelCard(movie);
  const nextMovie = shuffle(choices.filter((choice) => choice.url !== movie.url))[0] || choices[0] || movie;
  rouletteTrack.replaceChildren(...cards, winner, createReelCard(nextMovie));
  rouletteTrack.style.transform = 'translate3d(0,0,0)';
  placeholder.hidden = true;
  result.hidden = true;
  reel.hidden = false;
  const cardWidth = winner.getBoundingClientRect().width;
  rouletteTrack.style.paddingInline = `${Math.max(0, (rouletteWindow.clientWidth - cardWidth) / 2)}px`;
  reelTitle.textContent = 'Finding your next movie';
  reelNote.textContent = 'Watch the center marker.';
  stage.classList.add('is-spinning');
  const target = winner.offsetLeft + cardWidth / 2 - rouletteWindow.clientWidth / 2;
  const end = `translate3d(${-target}px,0,0)`;
  const animation = rouletteTrack.animate(
    [{ transform: 'translate3d(0,0,0)' }, { transform: end }],
    { duration: 4600, easing: 'cubic-bezier(.12,.7,.09,1)', fill: 'forwards' },
  );
  await animation.finished;
  rouletteTrack.style.transform = end;
  animation.cancel();
  winner.classList.add('is-selected');
  reelTitle.textContent = movie.title;
  reelNote.textContent = movie.year ? String(movie.year) : 'From your watchlist';
  stage.classList.remove('is-spinning');
  stage.classList.add('is-landing');
  await new Promise((resolve) => setTimeout(resolve, 750));
}

async function warmPoster(url) {
  if (!url) return;
  const image = new Image();
  await Promise.race([
    new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; image.src = url; }),
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);
}

spinButton.addEventListener('click', async () => {
  if (busy || !loadedUsername || !movies.length) return;
  busy = true;
  usernameInput.disabled = true;
  loadButton.disabled = true;
  spinButton.disabled = true;
  spinButton.firstChild.textContent = 'Spinning… ';
  resetResult();
  placeholder.querySelector('p').textContent = 'Getting your watchlist ready…';
  const runtime = document.querySelector('input[name="runtime"]:checked').value;
  message(spinMessage, runtime === 'any' ? 'Preparing your watchlist…' : 'Checking film lengths…');
  try {
    const data = await api('api/watchlist/spin', {
      timeoutMs: 60000,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loadedUsername, runtime }),
    });
    await warmPoster(data.movie.poster);
    await runRoulette(data.movie);
    showFilm(data.movie);
    message(spinMessage, `Picked from all ${data.count.toLocaleString()} films in your watchlist.`);
  } catch (error) {
    resetResult();
    placeholder.querySelector('p').textContent = 'Try another spin or choose a different length.';
    message(spinMessage, error.message, true);
    spinButton.firstChild.textContent = 'Spin watchlist ';
  } finally {
    busy = false;
    usernameInput.disabled = false;
    loadButton.disabled = false;
    spinButton.disabled = false;
  }
});
