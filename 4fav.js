const round = {
  users: [],
  catalog: [],
  currentUser: null,
  previousUser: null,
  choices: [],
  settled: false,
  number: 0,
  score: 0,
  highScore: 0,
};
try { round.highScore = Number(localStorage.getItem('movieknowledge-score-4fav')) || 0; }
catch { /* Private browsing. */ }

function renderStats() {
  document.querySelector('.favorite-round-count').textContent = `ROUND ${String(round.number).padStart(2, '0')}`;
  document.getElementById('favoriteScore').textContent = String(round.score);
  document.getElementById('favoriteHighScore').textContent = String(round.highScore);
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function movieYear(movie) {
  const match = movie.title.match(/\((\d{4})\)\s*$/);
  return match ? Number(match[1]) : null;
}

function buildCatalog(users) {
  const unique = new Map();
  for (const user of users) {
    for (const movie of user.favorites || []) {
      if (movie?.title && movie?.poster_url && !unique.has(movie.title)) {
        unique.set(movie.title, movie);
      }
    }
  }
  return [...unique.values()];
}

function buildChoices(user, catalog, random = Math.random) {
  const known = new Set(user.favorites.map(movie => movie.title));
  const correct = user.favorites[0];
  const year = movieYear(correct);
  const candidates = catalog.filter(movie => !known.has(movie.title));
  const nearby = year === null ? [] : candidates.filter(movie => {
    const candidateYear = movieYear(movie);
    return candidateYear !== null && Math.abs(candidateYear - year) <= 6;
  });
  const nearbyTitles = new Set(nearby.map(movie => movie.title));
  const others = candidates.filter(movie => !nearbyTitles.has(movie.title));
  const decoys = [...shuffle(nearby, random), ...shuffle(others, random)].slice(0, 3);
  if (decoys.length !== 3) throw new Error('Not enough distinct films for four choices');
  return shuffle([correct, ...decoys], random);
}

function poster(movie, eager = false) {
  const image = document.createElement('img');
  image.src = movie.poster_url;
  image.alt = '';
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => image.classList.add('poster-unavailable'));
  return image;
}

function renderKnownMovies() {
  const container = document.getElementById('favorites');
  container.replaceChildren();
  for (const [index, movie] of round.currentUser.favorites.slice(1).entries()) {
    const card = document.createElement('article');
    card.className = 'favorite-known-card';
    card.appendChild(poster(movie, true));
    const details = document.createElement('div');
    const number = document.createElement('span');
    number.className = 'favorite-known-number';
    number.textContent = String(index + 2).padStart(2, '0');
    const title = document.createElement('h3');
    title.textContent = movie.title;
    details.append(number, title);
    card.appendChild(details);
    container.appendChild(card);
  }
}

function renderChoices() {
  const container = document.getElementById('choices');
  container.replaceChildren();
  round.choices.forEach((movie, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-choice';
    button.dataset.title = movie.title;
    button.appendChild(poster(movie));
    const copy = document.createElement('span');
    copy.className = 'favorite-choice-copy';
    const number = document.createElement('small');
    number.textContent = `OPTION ${String(index + 1).padStart(2, '0')}`;
    const title = document.createElement('strong');
    title.textContent = movie.title;
    copy.append(number, title);
    button.append(copy);
    button.addEventListener('click', () => finishRound(movie.title));
    container.appendChild(button);
  });
}

function startNewGame() {
  const available = round.users.filter(user => user !== round.previousUser);
  round.currentUser = available[Math.floor(Math.random() * available.length)] || round.users[0];
  round.previousUser = round.currentUser;
  round.choices = buildChoices(round.currentUser, round.catalog);
  round.settled = false;
  round.number += 1;

  document.getElementById('username').textContent = round.currentUser.username;
  renderStats();
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = 'favorite-result';
  document.getElementById('giveUpBtn').hidden = false;
  document.getElementById('playAgainBtn').hidden = true;
  renderKnownMovies();
  renderChoices();
}

function finishRound(selectedTitle = null) {
  if (round.settled) return;
  round.settled = true;
  const correctTitle = round.currentUser.favorites[0].title;
  if (selectedTitle === correctTitle) {
    round.score += 1;
    if (round.score > round.highScore) {
      round.highScore = round.score;
      try { localStorage.setItem('movieknowledge-score-4fav',String(round.highScore)); }
      catch { /* Keep playing. */ }
    }
  }
  renderStats();
  for (const button of document.querySelectorAll('.favorite-choice')) {
    button.disabled = true;
    if (button.dataset.title === correctTitle) button.classList.add('is-correct');
    if (selectedTitle === button.dataset.title && selectedTitle !== correctTitle) {
      button.classList.add('is-wrong');
    }
  }
  const result = document.getElementById('result');
  result.classList.add(selectedTitle === correctTitle ? 'is-correct' : 'is-revealed');
  result.textContent = selectedTitle === correctTitle
    ? `You got it. ${correctTitle} is their #1 favorite.`
    : selectedTitle ? `Good try. ${correctTitle} is their #1 favorite.`
      : `${correctTitle} is their #1 favorite.`;
  document.getElementById('giveUpBtn').hidden = true;
  document.getElementById('playAgainBtn').hidden = false;
}

async function loadUsers() {
  try {
    const response = await fetch('4fav_tmdb.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    round.users = (await response.json()).filter(user =>
      user?.favorites?.length === 4 &&
      new Set(user.favorites.map(movie => movie.title)).size === 4 &&
      user.favorites.every(movie => movie.title && movie.poster_url)
    );
    round.catalog = buildCatalog(round.users);
    if (!round.users.length) throw new Error('No playable rounds');
    startNewGame();
  } catch (error) {
    document.getElementById('username').textContent = 'Could not load this round';
    document.getElementById('result').textContent = 'Please refresh the page to try again.';
    document.getElementById('giveUpBtn').hidden = true;
    console.error(error);
  }
}

if (typeof document !== 'undefined') {
  document.getElementById('giveUpBtn').addEventListener('click', () => finishRound());
  document.getElementById('playAgainBtn').addEventListener('click', startNewGame);
  loadUsers();
}

if (typeof module !== 'undefined') module.exports = { buildCatalog, buildChoices };
