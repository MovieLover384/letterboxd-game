import { answerDetail, closestAnswer, dailyNumber, dailyQuestions, findAnswer, isNameKind, normalizeTitle, optionsFor, playableQuestions, scoreAnswer, tierExamples, unlimitedQuestions, utcDay } from './daily-core.mjs?v=26';
import { apiUrl, warmUpApi } from './letterboxd-api.js?v=5';

const $ = (id) => document.getElementById(id);
const date = utcDay();
const isUnlimited = new URLSearchParams(location.search).get('mode') === 'unlimited';
const storageKey = `movieknowledge-daily-v14-${date}`;
const unlimitedHistoryKey = 'movieknowledge-unlimited-used-v3';
const bestKeys = {
  daily: 'movieknowledge-best-daily-v1',
  unlimited: 'movieknowledge-best-unlimited-v1',
};
const secondsPerPrompt = 45;
const bestScores = { daily: null, unlimited: null };
let questions = [];
let answers = [];
let deadline = null;
let started = false;
let pendingResult = null;
let pendingCorrection = null;
let animationFrame = null;
let unlimitedHistory = [];
let checkingAnswer = false;

function validScore(value) {
  if (value === null) return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 500 ? score : null;
}

function renderBestScores() {
  for (const mode of ['daily', 'unlimited']) {
    const score = bestScores[mode];
    $(`${mode}-best`).textContent = score === null ? '—' : `${score} / 500`;
  }
}

function loadBestScores() {
  try {
    for (const mode of ['daily', 'unlimited'])
      bestScores[mode] = validScore(localStorage.getItem(bestKeys[mode]));
    // Completed Daily rounds already saved by older versions count toward the new record.
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!/^movieknowledge-daily-v14-\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      try {
        const { answers: saved } = JSON.parse(localStorage.getItem(key));
        if (!Array.isArray(saved) || saved.length !== 5 ||
          !saved.every((answer) => [0, 10, 30, 60, 85, 100].includes(answer.points))) continue;
        const total = saved.reduce((sum, answer) => sum + answer.points, 0);
        if (bestScores.daily === null || total > bestScores.daily) bestScores.daily = total;
      } catch { /* Ignore a damaged older round. */ }
    }
    if (bestScores.daily !== null)
      localStorage.setItem(bestKeys.daily, String(bestScores.daily));
  } catch { /* Scores still work for this visit when browser storage is unavailable. */ }
  renderBestScores();
}

function recordHighScore(total) {
  const mode = isUnlimited ? 'unlimited' : 'daily';
  const label = isUnlimited ? 'Unlimited' : 'Daily';
  const previous = bestScores[mode];
  const isNew = previous === null || total > previous;
  if (isNew) {
    bestScores[mode] = total;
    try { localStorage.setItem(bestKeys[mode], String(total)); }
    catch { /* Keep the record for this visit. */ }
    renderBestScores();
  }
  const note = $('record-note');
  note.textContent = previous === null ? `Your first ${label} score is saved as your personal best.` :
    isNew ? `New ${label} personal best!` :
      total === previous ? `You matched your ${label} personal best.` :
        `${label} personal best: ${previous} / 500.`;
  note.classList.toggle('new-best', isNew);
}

function addLearnedAnswer(questionId, item) {
  const question = catalog?.questions.find((candidate) => candidate.id === questionId);
  if (!question || !Number.isInteger(item?.id)) return;
  const options = optionsFor(question);
  const existing = options.find((option) => option.id === item.id);
  if (existing) {
    existing.alternateTitles = [...new Set([
      ...(existing.alternateTitles || []), ...(item.alternateTitles || []),
    ])];
    if (item.scoreFloor) existing.scoreFloor = Math.max(existing.scoreFloor || 0, item.scoreFloor);
    if (item.rated) { existing.rated = true; existing.bonus = item.bonus || 0; }
    for (const field of ['as', 'by', 'film', 'films']) if (item[field] && !existing[field]) existing[field] = item[field];
  }
  else options.push(item);
}

function nextUnlimitedQuestions() {
  const known = new Set(playableQuestions(catalog).map((question) => question.id));
  unlimitedHistory = unlimitedHistory.filter((id) => known.has(id));
  const next = unlimitedQuestions(catalog, unlimitedHistory);
  unlimitedHistory.push(...next.map((question) => question.id));
  unlimitedHistory = unlimitedHistory.slice(-2000);
  try { localStorage.setItem(unlimitedHistoryKey, JSON.stringify(unlimitedHistory)); }
  catch { /* The game still works without saved history. */ }
  return next;
}

function saveProgress() {
  if (isUnlimited) return;
  try { localStorage.setItem(storageKey, JSON.stringify({ answers, deadline, started })); }
  catch { /* The game still works when storage is unavailable. */ }
}

function restoreProgress() {
  if (isUnlimited) return;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (!Array.isArray(saved.answers)) return;
    for (const [index, answer] of saved.answers.entries()) {
      const question = questions[index];
      if (!question) break;
      const item = optionsFor(question).find((option) => option.id === answer.answerId);
      if (answer.questionId !== question.id ||
        (answer.answerId !== null && (!item || scoreAnswer(question, item).points !== answer.points)) ||
        (answer.answerId === null && answer.points !== 0)) break;
      answers.push(answer);
    }
    started = saved.started === true || answers.length > 0;
    deadline = started && answers.length < 5 && Number.isFinite(saved.deadline) ? saved.deadline : null;
  } catch { /* A damaged save starts a fresh game. */ }
}

function renderProgress() {
  $('question-counter').textContent = answers.length === 5 ? 'Complete' :
    started ? `Question ${answers.length + (pendingResult ? 0 : 1)} of 5` :
      isUnlimited ? 'Unlimited round' : "Today's game";
  const visibleAnswers = pendingResult ? answers.slice(0, -1) : answers;
  $('total-score').textContent = `${visibleAnswers.reduce((sum, answer) => sum + answer.points, 0)} / 500`;
  $('progress').replaceChildren(...questions.map((_, index) => {
    const bar = document.createElement('span');
    bar.className = index < answers.length ? 'done' : started && index === answers.length ? 'current' : '';
    return bar;
  }));
}

// Each kind of prompt tints the accent line on top of the game panel.
const CATEGORIES = {
  scenario: 'scenario', fact: 'fact', attribute: 'attribute', year: 'year', title: 'title',
  cast: 'actors', collab: 'actors', character: 'characters', role: 'characters',
  crew: 'crew', franchise: 'franchise', studio: 'studio',
};
let resultShownAt = 0;
let completeCelebrated = false;
let artRun = 0;

// Where to find an image for an answer: a film poster for movies and roles, a photo for people.
function artTarget(question, item) {
  if (!isNameKind(question.kind)) return { kind: 'movie', id: item.id };
  if (['cast', 'collab'].includes(question.kind)) return { kind: 'person', id: item.id };
  if (question.kind === 'role') return { kind: 'movie', id: item.id - question.personId * 10000000 };
  const personId = item.id - Number(question.id.split('-')[1]) * 1000000;
  return personId > 0 ? { kind: 'person', id: personId } : null;
}

async function loadResultArt(question, item) {
  const view = $('result-view');
  const art = $('result-art');
  const run = ++artRun;
  const target = item && artTarget(question, item);
  view.classList.toggle('has-art', Boolean(target));
  if (!target) return;
  art.classList.add('loading');
  $('result-art-img').removeAttribute('src');
  try {
    const response = await fetch(apiUrl(`api/image?kind=${target.kind}&id=${target.id}`));
    const { path } = await response.json();
    if (run !== artRun) return;
    if (!path) throw new Error('No image');
    const image = $('result-art-img');
    image.alt = answerLabel(question, item);
    image.onload = () => { if (run === artRun) art.classList.remove('loading'); };
    image.onerror = () => { if (run === artRun) view.classList.remove('has-art'); };
    image.src = `https://image.tmdb.org/t/p/w342${path}`;
  } catch {
    if (run === artRun) view.classList.remove('has-art');
  }
}

function burstConfetti(colors, count) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('confetti');
  const context = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const box = ($('result-view').hidden ? $('complete-view') : $('result-view')).getBoundingClientRect();
  const originX = box.left + box.width * .5;
  const originY = Math.max(80, box.top + 60);
  const pieces = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.1;
    const speed = 6 + Math.random() * 9;
    return { x: originX, y: originY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6, spin: Math.random() * Math.PI, turn: (Math.random() - .5) * .35,
      color: colors[Math.floor(Math.random() * colors.length)] };
  });
  const started = performance.now();
  const frame = (now) => {
    const age = now - started;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const piece of pieces) {
      piece.vy += .28; piece.vx *= .992; piece.x += piece.vx; piece.y += piece.vy; piece.spin += piece.turn;
      context.save();
      context.globalAlpha = Math.max(0, 1 - age / 2200);
      context.translate(piece.x, piece.y);
      context.rotate(piece.spin);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * .6);
      context.restore();
    }
    if (age < 2200) requestAnimationFrame(frame);
    else context.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(frame);
}

function isPersonAnswer(question) { return isNameKind(question.kind); }
function answerLabel(question, item) {
  return isPersonAnswer(question) ? item.name : item.title;
}
function tierClass(points) { return `tier-${points}`; }

function clearCorrection() {
  pendingCorrection = null;
  $('correction-view').hidden = true;
}

function showCorrection(question, original, item) {
  const label = answerLabel(question, item);
  pendingCorrection = item;
  $('correction-original').textContent = `“${original}”`;
  $('correction-title').textContent = `“${label}”`;
  $('correction-view').hidden = false;
  $('movie-answer').value = label;
  $('movie-answer').focus();
}

async function verifyOnline(questionId, answer) {
  try {
    const response = await fetch(apiUrl('api/verify'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Verifier returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Live answer check unavailable:', error);
    return { status: 'unavailable' };
  }
}

function updateTimer() {
  if (!started || pendingResult || checkingAnswer || answers.length >= 5 || !deadline) return;
  const remaining = Math.max(0, deadline - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  $('timer').textContent = `0:${String(seconds).padStart(2, '0')}`;
  $('timer').classList.toggle('urgent', seconds <= 10);
  document.querySelector('.timer-track').classList.toggle('urgent', seconds <= 10);
  $('timer-fill').style.width = `${remaining / (secondsPerPrompt * 1000) * 100}%`;
  if (remaining === 0) recordAnswer(null);
}

function animateScore(points) {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  $('result-score').textContent = '0';
  $('score-fill').style.width = '0%';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('result-score').textContent = String(points);
    $('score-fill').style.width = `${points}%`;
    $('total-score').textContent = `${answers.reduce((sum, answer) => sum + answer.points, 0)} / 500`;
    return;
  }
  const start = performance.now();
  const duration = 1150;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    $('result-score').textContent = String(Math.round(points * eased));
    $('score-fill').style.width = `${points * eased}%`;
    if (progress < 1) animationFrame = requestAnimationFrame(tick);
    else $('total-score').textContent = `${answers.reduce((sum, answer) => sum + answer.points, 0)} / 500`;
  };
  animationFrame = requestAnimationFrame(tick);
}

function renderAnswerBrowser(question, answer, container) {
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search all accepted answers…';
  search.setAttribute('aria-label', `Search answers for ${question.prompt}`);
  const count = document.createElement('p');
  count.className = 'answer-count';
  const list = document.createElement('ul');
  list.className = 'all-answers';
  const sorted = [...optionsFor(question)].sort((a, b) =>
    scoreAnswer(question,b).points - scoreAnswer(question,a).points ||
    (isPersonAnswer(question) ? b.order - a.order : a.votes - b.votes) ||
    answerLabel(question,a).localeCompare(answerLabel(question,b)));
  const update = () => {
    const needle = normalizeTitle(search.value);
    const matching = sorted.filter((item) =>
      normalizeTitle(answerLabel(question, item)).includes(needle));
    count.textContent = `${matching.length} of ${sorted.length} accepted answers`;
    list.replaceChildren(...matching.map((item) => {
      const row = document.createElement('li');
      if (item.id === answer.answerId) row.className = 'your-answer';
      const title = document.createElement('span');
      title.textContent = answerLabel(question, item);
      if (!isPersonAnswer(question)) {
        const year = document.createElement('small');
        year.textContent = String(item.year);
        title.append(year);
      } else if (answerDetail(question, item)) {
        const detail = document.createElement('small');
        detail.textContent = answerDetail(question, item);
        title.append(detail);
      }
      const points = document.createElement('strong');
      const value = scoreAnswer(question, item).points;
      points.className = `points-badge ${tierClass(value)}`;
      points.textContent = `+${value}`;
      row.append(title, points);
      return row;
    }));
  };
  search.addEventListener('input', update);
  container.append(search, count, list);
  update();
}

function renderRounds() {
  $('round-list').replaceChildren(...answers.map((answer, index) => {
    const question = questions[index];
    const item = optionsFor(question).find((option) => option.id === answer.answerId);
    const details = document.createElement('details');
    details.className = 'round';
    const summary = document.createElement('summary');
    const number = document.createElement('span');
    number.className = 'round-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('span');
    content.className = 'round-content';
    const prompt = document.createElement('span');
    prompt.className = 'round-prompt';
    prompt.textContent = question.prompt;
    const chosen = document.createElement('span');
    chosen.className = 'round-answer';
    chosen.textContent = item ?
      isPersonAnswer(question) ? item.name : `${item.title} (${item.year})` : 'No answer';
    if (item && answerDetail(question, item)) {
      const detail = document.createElement('small');
      detail.textContent = answerDetail(question, item);
      chosen.append(detail);
    }
    content.append(prompt, chosen);
    const points = document.createElement('span');
    points.className = `round-points points-badge ${tierClass(answer.points)}`;
    points.textContent = `+${answer.points}`;
    const toggle = document.createElement('span');
    toggle.className = 'round-toggle';
    toggle.innerHTML = '<span class="round-toggle-open">Check Answers</span><span class="round-toggle-close">Close</span>';
    summary.append(number, content, points, toggle);
    const browser = document.createElement('div');
    browser.className = 'answer-browser';
    details.append(summary, browser);
    details.addEventListener('toggle', () => {
      if (details.open && !browser.hasChildNodes()) renderAnswerBrowser(question, answer, browser);
    });
    return details;
  }));
}

function showResult(question, item, points, reason) {
  $('result-view').dataset.tier = String(points);
  $('result-kicker').textContent = item ? 'ANSWER ACCEPTED' :
    reason === 'skipped' ? 'SKIPPED' : "TIME'S UP";
  $('result-title').textContent = item ?
    isPersonAnswer(question) ? item.name : `${item.title} (${item.year})` :
      reason === 'skipped' ? 'On to the next movie' : 'The clock ran out';
  $('result-tier').textContent = item ? scoreAnswer(question, item).name :
    'End Credits';
  $('next-button').textContent = answers.length === 5 ? 'See final score →' : 'Next prompt →';
  const detail = answerDetail(question, item);
  // A creative answer says why it scored above its popularity.
  const bonusNote = item?.bonus >= 2 ? 'Creative pick: it fits in a way most players would miss, so it scores higher.' :
    item?.bonus === 1 ? 'Smart pick: not the first film most players would think of, so it scores higher.' : '';
  $('result-detail').replaceChildren(detail);
  if (bonusNote) {
    const note = document.createElement('span');
    note.className = 'bonus-note';
    note.textContent = bonusNote;
    $('result-detail').append(note);
  }
  $('result-detail').hidden = !detail && !bonusNote;
  // When nothing was answered, show the best-known answer worth each point value.
  const examples = item ? [] : tierExamples(question);
  $('example-list').replaceChildren(...examples.map(({ points: value, item: example }, index) => {
    const row = document.createElement('li');
    row.style.setProperty('--i', String(index));
    const badge = document.createElement('span');
    badge.className = `points-badge ${tierClass(value)}`;
    badge.textContent = `+${value}`;
    const text = document.createElement('span');
    text.className = 'example-text';
    text.textContent = isPersonAnswer(question) ? example.name : `${example.title} (${example.year})`;
    const extra = answerDetail(question, example);
    if (extra) {
      const small = document.createElement('small');
      small.textContent = extra;
      text.append(small);
    }
    row.append(badge, text);
    return row;
  }));
  $('result-examples').hidden = examples.length === 0;
  loadResultArt(question, item);
  $('result-view').hidden = false;
  resultShownAt = performance.now();
  animateScore(points);
  if (points >= 100) burstConfetti(['#f5d178', '#ffe9a6', '#e4a642', '#fff6d6', '#ff8a3d'], 140);
  else if (points >= 85) burstConfetti(['#c9a0ff', '#8b6bdd', '#e4d0ff', '#58aeff'], 90);
  else if (points >= 60) burstConfetti(['#ff6b6b', '#ff9a6b', '#ffc27a'], 50);
  window.dispatchEvent(new CustomEvent('mk:score', { detail: { points, skipped: reason === 'skipped' } }));
}

function recordAnswer(item, reason = 'timeout') {
  if (!started || pendingResult || answers.length >= 5) return;
  const question = questions[answers.length];
  const points = item ? scoreAnswer(question, item).points : 0;
  answers.push({ questionId: question.id, answerId: item?.id ?? null, points });
  deadline = null;
  pendingResult = { question, item, points, reason };
  saveProgress();
  clearCorrection();
  render();
}

function render() {
  renderProgress();
  for (const id of ['welcome-view', 'question-view', 'result-view', 'complete-view']) $(id).hidden = true;

  if (pendingResult) {
    showResult(pendingResult.question, pendingResult.item, pendingResult.points,
      pendingResult.reason);
    return;
  }
  if (answers.length === 5) {
    const total = answers.reduce((sum, answer) => sum + answer.points, 0);
    $('final-score').textContent = String(total);
    recordHighScore(total);
    $('final-tier').textContent = total >= 375 ? 'Deep Cut' : total >= 250 ? 'Cult Classic' :
      total >= 125 ? 'Hidden Gem' : 'Opening Act';
    renderRounds();
    $('complete-view').hidden = false;
    if (total >= 250 && !completeCelebrated) {
      completeCelebrated = true;
      burstConfetti(total >= 375 ? ['#f5d178', '#ffe9a6', '#e4a642', '#c9a0ff'] : ['#58aeff', '#c9a0ff', '#ff8a3d'], 120);
    }
    return;
  }
  completeCelebrated = false;
  if (!started) { $('welcome-view').hidden = false; return; }

  if (!deadline) { deadline = Date.now() + secondsPerPrompt * 1000; saveProgress(); }
  const question = questions[answers.length];
  $('prompt-number').textContent = String(answers.length + 1);
  const promptParts = question.prompt.match(/^(.*?)\s+(\([^()]+\))$/);
  const promptTitle = $('question-text');
  promptTitle.textContent = promptParts ? promptParts[1] : question.prompt;
  if (promptParts) {
    const hint = document.createElement('span');
    hint.className = 'prompt-hint';
    hint.textContent = promptParts[2];
    promptTitle.append(hint);
  }
  const actorPrompt = ['cast','collab'].includes(question.kind);
  const characterPrompt = ['character','role'].includes(question.kind);
  $('answer-label').textContent = actorPrompt ? 'Name an actor' :
    characterPrompt ? 'Name a character' : 'Name a movie';
  $('movie-answer').placeholder = actorPrompt ? 'Type an actor…' :
    characterPrompt ? 'Type a character…' : 'Type a movie…';
  $('movie-answer').value = '';
  $('answer-feedback').textContent = '';
  clearCorrection();
  $('game-panel').dataset.category = CATEGORIES[question.kind] || 'scenario';
  document.querySelector('.timer-track').classList.remove('urgent');
  $('question-view').hidden = false;
  $('question-view').classList.remove('prompt-enter');
  void $('question-view').offsetWidth;
  $('question-view').classList.add('prompt-enter');
  updateTimer();
  if (!pendingResult) $('movie-answer').focus();
}

// Enter starts the round and moves on from a result, so the game can be played from the keyboard.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.repeat || event.isComposing ||
    event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, summary')) return;
  const press = (button) => { event.preventDefault(); button.click(); };
  if (!$('welcome-view').hidden) press($('start-button'));
  // A short pause stops the Enter that submitted an answer from skipping the result.
  else if (!$('result-view').hidden && performance.now() - resultShownAt > 350) press($('next-button'));
  else if (!$('complete-view').hidden && !$('again-button').hidden) press($('again-button'));
});

$('start-button').addEventListener('click', () => { started = true; render(); });
$('skip-button').addEventListener('click', () => recordAnswer(null, 'skipped'));
$('again-button').addEventListener('click', () => {
  questions = nextUnlimitedQuestions();
  answers = [];
  deadline = null;
  started = false;
  pendingResult = null;
  pendingCorrection = null;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('next-button').addEventListener('click', () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  pendingResult = null;
  render();
});
$('movie-answer').addEventListener('input', () => {
  $('answer-feedback').textContent = '';
  clearCorrection();
});
$('answer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!questions.length || checkingAnswer || pendingResult || answers.length === 5) return;
  if (deadline && Date.now() >= deadline) { recordAnswer(null); return; }
  const question = questions[answers.length];
  const typed = $('movie-answer').value.trim();
  if (pendingCorrection && normalizeTitle(typed) === normalizeTitle(answerLabel(question, pendingCorrection))) {
    recordAnswer(pendingCorrection);
    return;
  }
  clearCorrection();
  const result = findAnswer(question, typed);
  const localMatch = result.status === 'match' ? result.movie : null;
  if (localMatch && result.loose) {
    showCorrection(question, typed, localMatch);
    return;
  }
  // A story answer is used as is only once it has a saved creativity rating (or cannot rise).
  if (localMatch && (question.kind !== 'scenario' || localMatch.rated ||
    scoreAnswer(question, localMatch).points >= 100)) {
    recordAnswer(localMatch);
    return;
  }
  if (result.status === 'empty') {
    $('answer-feedback').textContent = 'Type an answer first.';
    return;
  }
  if (result.status === 'series') {
    $('answer-feedback').textContent = 'Which movie in the series? Add its number or release year.';
    return;
  }
  if (result.status === 'ambiguous') {
    $('answer-feedback').textContent = 'More than one movie has that name. Add its release year.';
    return;
  }
  const startedChecking = Date.now();
  checkingAnswer = true;
  $('answer-form').setAttribute('aria-busy', 'true');
  $('answer-form').querySelector('[type="submit"]').disabled = true;
  $('skip-button').disabled = true;
  $('answer-feedback').textContent = ['character','role'].includes(question.kind) ? 'Checking this character…' :
    ['cast','collab'].includes(question.kind) ? 'Checking this actor…' : 'Checking this movie…';
  const slowNotice = setTimeout(() => {
    $('answer-feedback').textContent = 'Still checking. The movie service may be waking up…';
  }, 5000);
  let checked;
  try {
    checked = await verifyOnline(question.id, typed);
  } finally {
    clearTimeout(slowNotice);
    if (deadline) deadline += Date.now() - startedChecking;
    saveProgress();
    checkingAnswer = false;
    $('answer-form').removeAttribute('aria-busy');
    $('answer-form').querySelector('[type="submit"]').disabled = false;
    $('skip-button').disabled = false;
    updateTimer();
  }
  if (checked.status === 'accepted' && checked.item) {
    addLearnedAnswer(question.id, checked.item);
    if (normalizeTitle(typed) !== normalizeTitle(answerLabel(question, checked.item))) {
      showCorrection(question, typed, checked.item);
      return;
    }
    recordAnswer(checked.item);
    return;
  }
  if (checked.status === 'needs-detail') {
    $('answer-feedback').textContent = 'Which movie do you mean? Add its number or release year.';
    return;
  }
  if (checked.status === 'unavailable') {
    if (localMatch) { recordAnswer(localMatch); return; }
    $('answer-feedback').textContent = 'Couldn’t reach the movie database. Please try again in a moment.';
    return;
  }
  if (localMatch) { recordAnswer(localMatch); return; }
  const correction = question.id === 'title-number' && /\b(?:[2-9]|II|III|IV|V|VI|VII|VIII|IX)\s*$/i.test(typed) ?
    null : closestAnswer(question, typed);
  if (correction) {
    showCorrection(question, typed, correction);
    $('answer-feedback').textContent = '';
  } else {
    $('answer-feedback').textContent = checked.reason === 'movie-not-found' ?
      'Could not identify that movie. Try its full title or release year.' :
      checked.reason === 'not-confirmed' ?
      (checked.unsure ? `Found ${checked.title}, but the check was not sure enough that it fits this prompt.` :
        `Found ${checked.title}, but could not confirm it fits this prompt.`) +
        (checked.detail ? ` Reason: ${checked.detail}` : '') :
      checked.reason === 'is-a-movie' ?
      `${checked.title} is a movie, not a character. Try the name of a character from one of the films.` :
      checked.reason === 'not-in-credits' ?
      (question.kind === 'role' ? 'Could not find that character in this actor’s films.' :
        question.kind === 'collab' ? `${checked.person || 'That actor'} has no credit in a ${question.label} film.` :
        checked.person ? `${checked.person} is not in the credits of ${
          question.prompt.replace(/^Name an? (?:actor|character) in /, '').replace(/\.(?: \(.*\))?$/, '')}.` :
        'Could not find that name in this movie’s credits.') :
      checked.reason === 'person-not-found' ?
      'Could not identify that actor. Try their full name.' :
      'That answer could not be confirmed for this prompt. Try another answer.';
  }
});

let catalog = null;

// The server fixes each day's prompts on first request, so every player gets the same five even if
// the catalog changes during the day. Without the server, the same prompts are worked out locally.
// The request starts before the large catalog finishes downloading, so the two overlap.
function requestDailyIds() {
  return (async () => {
    try {
      const response = await fetch(apiUrl(`api/daily?date=${date}`), {
        cache: 'no-store', signal: AbortSignal.timeout(7000),
      });
      if (response.ok) return (await response.json()).ids;
    } catch (error) { console.warn('Shared daily prompts unavailable:', error); }
    return null;
  })();
}

async function loadDailyQuestions(idsRequest) {
  const ids = await idsRequest;
  const byId = new Map(catalog.questions.map((question) => [question.id, question]));
  const pinned = Array.isArray(ids) ? ids.map((id) => byId.get(id)) : [];
  if (pinned.length === 5 && pinned.every(Boolean)) return pinned;
  return dailyQuestions(catalog, date);
}

async function loadSharedAnswers() {
  try {
    const response = await fetch(apiUrl('api/learned'), {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const { answers } = await response.json();
    if (Array.isArray(answers)) answers.forEach(({ questionId, item }) =>
      addLearnedAnswer(questionId, item));
  } catch (error) { console.warn('Shared answers unavailable:', error); }
}

async function start() {
  if (isUnlimited) {
    document.title = 'Unlimited Challenge — MovieKnowledge';
    $('mode-label').textContent = 'MOVIEKNOWLEDGE UNLIMITED';
    $('page-title').innerHTML = 'Unlimited <span>Challenge</span>';
    $('page-subtitle').textContent = 'Five fresh movie prompts each round. Play as often as you like.';
    $('start-button').textContent = 'Start unlimited round →';
    $('final-title').textContent = 'Your final score';
    $('complete-note').textContent = 'Ready for another set of five?';
    $('complete-unlimited-link').hidden = true;
    $('welcome-unlimited-link').hidden = true;
    $('again-button').hidden = false;
    $('day-label').hidden = true;
  } else {
    $('day-label').textContent = new Intl.DateTimeFormat('en', {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(`${date}T12:00:00Z`));
    const number = dailyNumber(date);
    if (number) {
      const label = document.createElement('span');
      label.className = 'daily-number';
      label.textContent = ` - #${number}`;
      $('page-title').append(label);
      document.title = `Daily Challenge #${number} — MovieKnowledge`;
    }
  }
  try {
    warmUpApi();
    const idsRequest = isUnlimited ? null : requestDailyIds();
    const seedRequest = fetch('backend/seed-learned-answers.json?v=1').catch(() => null);
    const response = await fetch('daily-catalog.json?v=27');
    if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
    catalog = await response.json();
    try {
      const seedResponse = await seedRequest;
      if (seedResponse?.ok) {
        const seed = await seedResponse.json();
        if (Array.isArray(seed)) seed.forEach(({ questionId, item }) =>
          addLearnedAnswer(questionId, item));
      }
    } catch (error) { console.warn('Seed answers unavailable:', error); }
    if (isUnlimited) {
      try { unlimitedHistory = JSON.parse(localStorage.getItem(unlimitedHistoryKey) || '[]'); }
      catch { unlimitedHistory = []; }
      if (!Array.isArray(unlimitedHistory)) unlimitedHistory = [];
    }
    questions = isUnlimited ? nextUnlimitedQuestions() : await loadDailyQuestions(idsRequest);
    restoreProgress();
    loadBestScores();
    $('loading-view').hidden = true;
    render();
    void loadSharedAnswers();
    setInterval(() => {
      if (!isUnlimited && utcDay() !== date) { location.reload(); return; }
      updateTimer();
    }, 100);
  } catch (error) {
    console.error('Daily Challenge could not load:', error);
    $('loading-view').hidden = true;
    $('error-view').hidden = false;
  }
}

start();
