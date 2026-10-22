import { castRounds, directorRounds, timelineRounds, timelineResult, shuffle } from './knowledge-core.mjs?v=1';

const configs = {
  cast: { title: 'Cast Connection', intro: 'Two films. One familiar face. Find the actor they share.', eyebrow: 'THE COMMON CAST MEMBER' },
  director: { title: "Director's Cut", intro: 'Three films by one filmmaker. Name the director behind all of them.', eyebrow: 'THREE FILMS, ONE DIRECTOR' },
  timeline: { title: 'Director Timeline', intro: 'Put four films from the same director in release order.', eyebrow: 'EARLIEST TO LATEST' },
};
const requestedMode = new URLSearchParams(location.search).get('mode');
const mode = Object.hasOwn(configs, requestedMode) ? requestedMode : 'cast';
const elements = {
  title: document.getElementById('game-title'), intro: document.getElementById('game-intro'),
  loading: document.getElementById('loading'), stage: document.getElementById('knowledge-stage'),
  score: document.getElementById('score'),
  best: document.getElementById('best'), kind: document.getElementById('round-kind'),
  prompt: document.getElementById('knowledge-prompt'), help: document.getElementById('knowledge-help'),
  films: document.getElementById('knowledge-films'), options: document.getElementById('knowledge-options'),
  check: document.getElementById('check-order'), feedback: document.getElementById('knowledge-feedback'),
  next: document.getElementById('next-round'),
};
let allRounds = [];
let deck = [];
let currentRound = null;
let recentFilms = [];
let score = 0;
let selected = [];
let answered = false;
let resetOnNext = false;

document.body.dataset.knowledgeMode = mode;
document.title = `${configs[mode].title} | MovieKnowledge`;
elements.title.textContent = configs[mode].title;
elements.intro.textContent = configs[mode].intro;

function bestKey() { return `movieknowledge-knowledge-${mode}-best-v1`; }
function bestScore() {
  try { return Math.max(0, Number(localStorage.getItem(bestKey())) || 0); }
  catch { return 0; }
}
function updateStats() {
  elements.score.textContent = String(score);
  elements.best.textContent = String(bestScore());
}
function awardPoint() {
  score++;
  try { if (score > bestScore()) localStorage.setItem(bestKey(), String(score)); } catch {}
  updateStats();
}
function nextQuestion() {
  if (!deck.length) deck = shuffle(allRounds);
  const recentlySeen = new Set(recentFilms.flat());
  const freshIndex = deck.findIndex(round => round.films.every(film =>
    !recentlySeen.has(`${film.title}|${film.year}`)));
  currentRound = deck.splice(freshIndex < 0 ? 0 : freshIndex, 1)[0];
  recentFilms.push(currentRound.films.map(film => `${film.title}|${film.year}`));
  if (recentFilms.length > 4) recentFilms.shift();
  renderRound();
}
function makeFilm(film, index, selectable = false) {
  const card = document.createElement(selectable ? 'button' : 'article');
  card.className = `knowledge-film${selectable ? ' selectable' : ''}`;
  if (selectable) {
    card.type = 'button';
    card.setAttribute('aria-pressed', 'false');
    card.addEventListener('click', () => selectFilm(index));
    const badge = document.createElement('span');
    badge.className = 'order-badge';
    badge.hidden = true;
    card.append(badge);
  }
  const image = document.createElement('img');
  image.src = film.poster;
  image.alt = `${film.title} poster`;
  image.width = 156;
  image.height = 234;
  image.onerror = () => { image.onerror = null; image.src = 'posters/interstellar.jpg'; };
  const title = document.createElement('strong');
  title.textContent = film.title;
  const year = document.createElement('small');
  year.textContent = String(film.year);
  year.hidden = selectable;
  card.append(image, title, year);
  return card;
}
function setFeedback(message, wrong = false) {
  elements.feedback.replaceChildren(document.createTextNode(message));
  elements.feedback.classList.toggle('wrong', wrong);
}
function renderRound() {
  answered = false;
  selected = [];
  elements.films.replaceChildren();
  elements.options.replaceChildren();
  elements.check.hidden = true;
  elements.next.hidden = true;
  elements.feedback.replaceChildren();
  elements.feedback.classList.remove('wrong');
  updateStats();
  const round = currentRound;
  elements.kind.textContent = configs[mode].eyebrow;
  elements.next.textContent = 'Next question →';
  if (mode === 'timeline') {
    elements.prompt.textContent = `Order these ${round.director} films`;
    elements.help.textContent = 'Tap the posters from earliest release to latest. Tap a choice again to undo it.';
    round.films.forEach((film, index) => elements.films.append(makeFilm(film, index, true)));
    elements.check.hidden = false;
    elements.check.disabled = true;
  } else {
    elements.prompt.textContent = mode === 'cast'
      ? 'Which actor connects these films?'
      : 'Who directed all three?';
    elements.help.textContent = mode === 'cast'
      ? 'Choose the actor in the leading cast of both films.'
      : 'Use the filmography clues to choose the director.';
    round.films.forEach((film, index) => elements.films.append(makeFilm(film, index)));
    for (const option of round.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option;
      button.addEventListener('click', () => answerOption(option));
      elements.options.append(button);
    }
  }
}
function answerOption(choice) {
  if (answered) return;
  answered = true;
  const round = currentRound;
  const correct = choice === round.answer;
  if (correct) awardPoint();
  else resetOnNext = true;
  for (const button of elements.options.querySelectorAll('button')) {
    button.disabled = true;
    if (button.textContent === round.answer) button.classList.add('correct');
    else if (button.textContent === choice) button.classList.add('incorrect');
  }
  const detail = mode === 'cast'
    ? `${round.answer} is in ${round.films[0].title} and ${round.films[1].title}.`
    : `${round.answer} directed all three films.`;
  setFeedback(`${correct ? 'Correct!' : `Not quite. Your streak ended at ${score}.`} ${detail}`, !correct);
  elements.next.hidden = false;
}
function selectFilm(index) {
  if (answered) return;
  const position = selected.indexOf(index);
  if (position >= 0) selected.splice(position, 1);
  else selected.push(index);
  elements.films.querySelectorAll('.knowledge-film').forEach((card, filmIndex) => {
    const number = selected.indexOf(filmIndex);
    const badge = card.querySelector('.order-badge');
    badge.hidden = number < 0;
    badge.textContent = number < 0 ? '' : String(number + 1);
    card.classList.toggle('selected', number >= 0);
    card.setAttribute('aria-pressed', String(number >= 0));
  });
  elements.check.disabled = selected.length !== 4;
}
function checkTimeline() {
  if (answered || selected.length !== 4) return;
  answered = true;
  const round = currentRound;
  const result = timelineResult(round, selected.map(index => round.films[index]));
  if (result.exact) awardPoint();
  else resetOnNext = true;
  elements.films.querySelectorAll('.knowledge-film').forEach(card => {
    card.disabled = true;
    card.querySelector('small').hidden = false;
  });
  elements.check.hidden = true;
  setFeedback(result.exact ? 'Perfect order!' : `${result.positions} of 4 films were in the right position. Your streak ended at ${score}.`, !result.exact);
  const order = document.createElement('span');
  order.className = 'correct-order';
  order.textContent = `Correct order: ${result.correct.map(film => `${film.title} (${film.year})`).join(' → ')}`;
  elements.feedback.append(order);
  elements.next.hidden = false;
}

elements.check.addEventListener('click', checkTimeline);
elements.next.addEventListener('click', () => {
  if (resetOnNext) {
    score = 0;
    resetOnNext = false;
  }
  nextQuestion();
});

try {
  const response = await fetch('knowledge-pool.json?v=1');
  if (!response.ok) throw new Error(`Movie pool request failed: ${response.status}`);
  const { movies } = await response.json();
  allRounds = mode === 'cast' ? castRounds(movies)
    : mode === 'director' ? directorRounds(movies) : timelineRounds(movies);
  if (allRounds.length < 2) throw new Error('Not enough questions');
  elements.loading.hidden = true;
  elements.stage.hidden = false;
  nextQuestion();
} catch (error) {
  elements.loading.textContent = 'Could not load the movie questions. Please refresh and try again.';
  console.error(error);
}
