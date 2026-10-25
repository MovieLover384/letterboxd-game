export const TIERS = [
  { points: 10, name: 'Opening Act', minimumVotes: 20000 },
  { points: 30, name: 'Fan Favorite', minimumVotes: 8000 },
  { points: 60, name: 'Hidden Gem', minimumVotes: 2500 },
  { points: 85, name: 'Cult Classic', minimumVotes: 500 },
  { points: 100, name: 'Deep Cut', minimumVotes: 0 },
];

export function scoreVotes(votes) {
  return TIERS.find((tier) => votes >= tier.minimumVotes);
}

export function normalizeTitle(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[’‘']/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
    .replace(/^(the|a|an) /, '');
}

// Every title a film can be typed as. Building this is slow, and the server checks answers against
// tens of thousands of films, so the result is kept until the film's alternate titles change.
const aliasCache = new WeakMap();
function aliases(movie) {
  const cached = aliasCache.get(movie);
  if (cached && cached.alternates === movie.alternateTitles && cached.title === movie.title) return cached.names;
  const names = buildAliases(movie);
  aliasCache.set(movie, { alternates: movie.alternateTitles, title: movie.title, names });
  return names;
}

function buildAliases(movie) {
  const names = [movie.title, movie.originalTitle, ...(movie.alternateTitles || [])].filter(Boolean);
  const namesWithSubtitles = names.flatMap((name) => {
    const prefix = name.split(':')[0];
    return /\b(?:[2-9]|II|III|IV|V)$/.test(prefix) ? [name, prefix] : [name];
  });
  const namesFromSeries = SERIES.flatMap((series) => {
    const position = series.films.findIndex(([title, year]) =>
      movie.year === year && normalizeTitle(movie.title) === normalizeTitle(title));
    if (position < 0) return [];
    const number = position + 1;
    return [`${series.name} ${number}`, `${series.name} ${series.numerals[position]}`, `${series.name} ${movie.year}`];
  });
  // A title in another script (or one made only of symbols) has no letters or digits left once
  // normalized. An empty alias would match any answer with no letters, such as "?".
  return new Set([...namesWithSubtitles, ...namesFromSeries].flatMap((name) => {
    const full = normalizeTitle(name);
    return [full, full.replace(/^(the|a|an) /, '')];
  }).filter(Boolean));
}

// The ways a title can be typed with its spaces dropped ("spiderman", "et"), kept per film for the
// same reason as the aliases: scanning every film's names on each lookup is slow on a small server.
const looseCache = new WeakMap();
function looseAliases(movie) {
  const cached = looseCache.get(movie);
  if (cached && cached.alternates === movie.alternateTitles && cached.title === movie.title) return cached.names;
  const names = new Set();
  for (const name of aliases(movie)) {
    names.add(name.replace(/ /g, ''));
    // "et" is also "E.T." followed by more words, so leading single letters can be run together.
    const words = name.split(' ');
    let joined = '';
    for (let index = 0; index < Math.min(words.length, 4) && words[index].length === 1; index++) {
      joined += words[index];
      if (index >= 1) names.add(joined);
    }
  }
  looseCache.set(movie, { alternates: movie.alternateTitles, title: movie.title, names });
  return names;
}

const SERIES = [
  { name: 'Madagascar', numerals: ['I','II','III'], films: [
    ['Madagascar',2005],['Madagascar: Escape 2 Africa',2008],
    ["Madagascar 3: Europe's Most Wanted",2012],
  ] },
  { name: 'Indiana Jones', numerals: ['I','II','III','IV','V'], films: [
    ['Raiders of the Lost Ark',1981],['Indiana Jones and the Temple of Doom',1984],
    ['Indiana Jones and the Last Crusade',1989],
    ['Indiana Jones and the Kingdom of the Crystal Skull',2008],
    ['Indiana Jones and the Dial of Destiny',2023],
  ] },
];

export function findMovie(question, answer) {
  const trimmed = answer.trim();
  if (!trimmed) return { status: 'empty' };
  const query = normalizeTitle(trimmed);
  // Nothing but symbols ("?", "!!") names no film.
  if (!query) return { status: 'empty' };
  const bareSeries = SERIES.find((series) => normalizeTitle(series.name) === query);
  if (bareSeries) {
    const matches = question.movies.filter((movie) =>
      bareSeries.films.some(([title, year]) => movie.year === year &&
        normalizeTitle(movie.title) === normalizeTitle(title)));
    if (matches.length) return { status: 'series', matches };
  }
  // "yiyi", "spiderman" and "et" should find "Yi Yi", "Spider-Man" and "E.T. the
  // Extra-Terrestrial". These are only suggestions (loose), so the player confirms them.
  const squashed = query.replace(/ /g, '');
  const exact = [];
  const spaced = [];
  for (const movie of question.movies) {
    if (aliases(movie).has(query)) exact.push(movie);
    else if (squashed.length >= 2 && looseAliases(movie).has(squashed)) spaced.push(movie);
  }
  const found = exact.length ? exact : spaced;
  // An undated title usually means the best-known release. Years still select remakes.
  if (found.length) return { status: 'match', loose: !exact.length,
    movie: [...found].sort((a, b) => b.votes - a.votes)[0] };
  const dated = trimmed.match(/^(.+?)\s*(?:\((\d{4})\)|\s+(\d{4}))$/);
  if (!dated) return { status: 'not-found' };
  const title = dated ? dated[1] : trimmed;
  const year = dated ? Number(dated[2] || dated[3]) : null;
  const needle = normalizeTitle(title);
  const matches = question.movies.filter((movie) =>
    aliases(movie).has(needle) && (year === null || movie.year === year));
  if (!matches.length) return { status: 'not-found' };
  if (matches.length > 1) return { status: 'ambiguous', matches };
  return { status: 'match', movie: matches[0] };
}

// Prompts whose answers are people or characters rather than movies.
export function isNameKind(kind) {
  return ['cast','character','role','collab'].includes(kind);
}

export function optionsFor(question) {
  return ['cast','collab'].includes(question.kind) ? question.people :
    ['character','role'].includes(question.kind) ? question.characters : question.movies;
}

export function scoreAnswer(question, item) {
  if (!isNameKind(question.kind)) {
    const rarity = scoreVotes(item.votes);
    // Popularity sets the starting score. A creative answer, one that fits the prompt without
    // being the first film players think of, moves up one or two levels (item.bonus), and a
    // hand-checked floor (item.scoreFloor) can lift a famous film further.
    const lifted = TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(rarity) + (item.bonus || 0))];
    return TIERS.find((tier) => tier.points === Math.max(lifted.points, item.scoreFloor || 0)) || lifted;
  }
  const rank = item.order;
  const points = rank < 3 ? 10 : rank < 8 ? 30 : rank < 16 ? 60 : rank < 30 ? 85 : 100;
  return TIERS.find((tier) => tier.points === points);
}

// Where a person or character answer comes from, shown under the answer on the result screen.
export function answerDetail(question, item) {
  if (!item) return '';
  if (question.kind === 'collab' && item.films?.length) return `in ${item.films.join(', ')}`;
  if (question.kind === 'role' && item.film) return `in ${item.film}`;
  if (question.kind === 'cast' && item.as) return `as ${item.as}`;
  if (question.kind === 'character' && item.by) return `played by ${item.by}`;
  return '';
}

// The best-known answer worth each point value, shown when a player skips or runs out of time.
export function tierExamples(question) {
  const best = new Map();
  const names = isNameKind(question.kind);
  for (const item of optionsFor(question)) {
    const points = scoreAnswer(question, item).points;
    const current = best.get(points);
    const stronger = names ? (item.order ?? 99) < (current?.order ?? 99) :
      (item.votes || 0) > (current?.votes || 0);
    if (!current || stronger) best.set(points, item);
  }
  return TIERS.map((tier) => ({ points: tier.points, item: best.get(tier.points) }))
    .filter((entry) => entry.item);
}

export function findAnswer(question, answer) {
  if (!isNameKind(question.kind)) return findMovie(question, answer);
  const needle = normalizeTitle(answer);
  if (!needle) return { status: 'empty' };
  const matches = optionsFor(question).filter((person) => normalizeTitle(person.name) === needle);
  return matches.length === 1 ? { status: 'match', movie: matches[0] }
    : matches.length ? { status: 'ambiguous', matches } : { status: 'not-found' };
}

// Edit distance between two strings. This runs for every candidate title, so it reuses two typed
// rows instead of allocating new arrays for each letter.
let rowA = new Int32Array(64);
let rowB = new Int32Array(64);
function distance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (rowA.length <= b.length) { rowA = new Int32Array(b.length * 2); rowB = new Int32Array(b.length * 2); }
  let previous = rowA;
  let current = rowB;
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    const letter = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const substitute = previous[j - 1] + (letter === b.charCodeAt(j - 1) ? 0 : 1);
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;
      current[j] = substitute < insert ? (substitute < remove ? substitute : remove) : (insert < remove ? insert : remove);
    }
    const swap = previous; previous = current; current = swap;
  }
  return previous[b.length];
}

// `strict` is for film titles, where a suggestion should come from a real misspelling or a clear
// beginning of the title, not from a short word that merely appears in it ("star" is not "Lucky Star").
const FILLER_WORDS = new Set(['a', 'an', 'the', 'of']);
const sortedCache = new Map();
// The words of a title in alphabetical order without filler, so reordered titles compare equal.
// The same labels are compared on every check, so each one is worked out once.
function sortedWords(value) {
  let words = sortedCache.get(value);
  if (words === undefined) {
    words = value.split(' ').filter((word) => !FILLER_WORDS.has(word)).sort().join(' ');
    if (sortedCache.size > 300000) sortedCache.clear();
    sortedCache.set(value, words);
  }
  return words;
}

function correctionScore(query, candidate, strict = false) {
  if (sortedWords(query) === sortedWords(candidate)) return 1;
  const whole = 1 - distance(query, candidate) / Math.max(query.length, candidate.length);
  // Character names are short: one extra letter can otherwise hide an obvious match.
  if (query.length >= (strict ? 6 : 4) && candidate.length >= 4 &&
    query.slice(0, 3) === candidate.slice(0, 3) && distance(query, candidate) <= (strict ? 1 : 2) &&
    !query.includes(' ') && !candidate.includes(' ')) return Math.max(whole, .84);
  const candidateWords = candidate.split(' ');
  const queryWords = query.split(' ');
  // Match each typed word to a different title word. Reusing one short word
  // made unrelated inputs such as "la la la land" look like a close match.
  const extraWords = Math.max(0, candidateWords.length - queryWords.length);
  // One typed word does not pick a title out of a longer one: "lord" is not "Metal Lords".
  const lonelyWord = strict && queryWords.length === 1 && candidateWords.length > 1;
  let partial = 0;
  if (!lonelyWord && queryWords.length <= candidateWords.length &&
    queryWords.some((word) => word.length >= 4)) {
    const unusedWords = [...candidateWords];
    let total = 0;
    let matched = true;
    for (const word of queryWords) {
      let bestIndex = -1;
      let bestScore = 0;
      unusedWords.forEach((part, index) => {
        // A typed word may stand for the beginning of a longer title word only when it is most of it.
        const beginning = !strict || word.length >= Math.max(5, Math.ceil(part.length * .6));
        const prefix = part.length > word.length && beginning ? part.slice(0, word.length) : part;
        const score = 1 - distance(word, prefix) / Math.max(word.length, prefix.length);
        if (score > bestScore) { bestIndex = index; bestScore = score; }
      });
      if (bestIndex >= 0) unusedWords.splice(bestIndex, 1);
      // Every typed word must match one of the title's words, so the first miss ends the comparison.
      if (bestScore < .7) { matched = false; break; }
      total += bestScore;
    }
    if (matched) partial = total / queryWords.length * .94 * Math.max(.7, 1 - extraWords * .1);
  }
  return Math.max(whole, partial);
}

function answerName(question, item) {
  return isNameKind(question.kind) ? item.name : item.title;
}

const NAME_FILLER = new Set(['the','and','von','van','der','den','mrs','mr','dr','sir','lady','lord','jr','sr']);

// Share of two-letter pairs two words have in common. It forgives swapped or missing letters
// better than counting single-letter edits.
function pairOverlap(a, b) {
  const pairs = (word) => Array.from({ length: Math.max(0, word.length - 1) }, (_, index) => word.slice(index, index + 2));
  const left = pairs(a);
  const right = pairs(b);
  if (!left.length || !right.length) return 0;
  const pool = [...right];
  let shared = 0;
  for (const pair of left) {
    const index = pool.indexOf(pair);
    if (index >= 0) { shared++; pool.splice(index, 1); }
  }
  return 2 * shared / (left.length + right.length);
}

function wordSimilarity(typed, word) {
  const edits = distance(typed, word);
  const spelling = 1 - edits / Math.max(typed.length, word.length);
  const similarLength = Math.abs(typed.length - word.length) <= 2;
  // "hermanie" is clearly meant to be "hermione": same start, similar length, a few wrong letters.
  if (similarLength && typed.slice(0, 3) === word.slice(0, 3) &&
    (edits <= 2 || (edits <= 3 && Math.min(typed.length, word.length) >= 7))) return Math.max(spelling, .85);
  // Swapped neighbouring letters keep most letter pairs, as in "nathalie" and "natalie".
  return typed[0] === word[0] && similarLength && pairOverlap(typed, word) >= .7 ?
    Math.max(spelling, .85) : spelling;
}

// How well a typed name matches a person or character. A single word counts as a first name,
// surname, or nickname, so "hermione" finds "Hermione Granger" and "venkman" finds "Peter Venkman".
export function nameSimilarity(typed, name) {
  const query = normalizeTitle(typed);
  const candidate = normalizeTitle(name);
  if (!query || !candidate) return 0;
  let best = correctionScore(query, candidate);
  const queryWords = query.split(' ');
  const words = candidate.split(' ').filter((word) => word.length >= 3 && !NAME_FILLER.has(word));
  if (queryWords.length === 1 && query.length >= 3) {
    for (const word of words) best = Math.max(best, wordSimilarity(query, word) * .95);
  } else if (queryWords.length >= 2 && queryWords.length <= words.length) {
    const unused = [...words];
    const scores = queryWords.map((word) => {
      let bestIndex = -1;
      let bestScore = 0;
      unused.forEach((part, index) => {
        const score = wordSimilarity(word, part);
        if (score > bestScore) { bestIndex = index; bestScore = score; }
      });
      if (bestIndex >= 0) unused.splice(bestIndex, 1);
      return bestScore;
    });
    if (scores.every((score) => score >= .75))
      best = Math.max(best, scores.reduce((sum, score) => sum + score, 0) / scores.length * .97);
  }
  return best;
}

export function closestAnswer(question, answer) {
  const query = normalizeTitle(answer);
  const names = isNameKind(question.kind);
  if (query.length < (names ? 3 : 4)) return null;
  const queryHasSpace = query.includes(' ');
  const queryWordCount = query.split(' ').length;
  // Most titles are nowhere near what was typed. A title can only score well when it is about as
  // long as the text, or longer with the typed words at its start, so the rest skip the full compare.
  const reachable = (label) => {
    const gap = Math.abs(label.length - query.length) / Math.max(label.length, query.length);
    if (gap <= .22) return true;
    if (label.includes(' ')) return label.split(' ').length >= queryWordCount;
    return !queryHasSpace && query.length >= 5 && gap <= .4;
  };
  const matches = optionsFor(question).map((item) => {
    if (names) return { item, score: nameSimilarity(answer, item.name) };
    let score = 0;
    for (const label of aliases(item)) {
      if (!label || !reachable(label)) continue;
      const labelScore = correctionScore(query, label, true);
      if (labelScore > score) score = labelScore;
    }
    return { item, score };
  }).sort((a, b) => b.score - a.score || (names ? (a.item.order ?? 99) - (b.item.order ?? 99) :
    (b.item.votes || 0) - (a.item.votes || 0)));
  const [best] = matches;
  if (!best) return null;
  // Remakes share a title, so only a different title counts as a competing suggestion.
  const labelOf = (item) => normalizeTitle(answerName(question, item));
  const second = matches.find((match) => labelOf(match.item) !== labelOf(best.item));
  // Names are matched more loosely. When several people share a first name or surname, the
  // best-known one (lowest billing order) is suggested and the player confirms it.
  if (best.score < (names ? .7 : .78)) return null;
  if (second && best.score - second.score < (names ? .02 : .08) && !(names && best.score >= .9)) return null;
  return best.item;
}

export function titleSimilarity(a, b, strict = false) {
  return correctionScore(normalizeTitle(a), normalizeTitle(b), strict);
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// The Daily Challenge is numbered from its first day, 20 October 2026, which is #1.
export const DAILY_NUMBER_START = '2026-10-20';
export function dailyNumber(date = utcDay()) {
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${DAILY_NUMBER_START}T00:00:00Z`)) / 86400000);
  return Number.isFinite(days) && days >= 0 ? days + 1 : null;
}

const RETIRED_SCENARIOS = new Set(['helicopter','underwater','police-officer','baseball',
  'based-on-video-game']);

// The page picks prompts from daily-index.json, which has the same questions without their answer
// lists, so selection reads these counts (stored on the index) instead of the lists themselves.
function optionCount(question) {
  return question.optionCount ?? optionsFor(question).length;
}

function poolFor(catalog, slot) {
  if (slot === 'scenario') return catalog.questions.filter((question) =>
    question.kind === 'scenario' && optionCount(question) >= 30 &&
    !RETIRED_SCENARIOS.has(question.label));
  if (slot === 'fact') return catalog.questions.filter((question) =>
    question.kind === 'fact' && optionCount(question) >= 30);
  if (slot === 'character') return catalog.questions.filter((question) =>
    ['character','role'].includes(question.kind) && optionCount(question) >= 15);
  // Players should know a decent number of the films, so a language only counts when it
  // has plenty of well-known ones.
  if (slot === 'attribute') return catalog.questions.filter((question) =>
    question.kind === 'attribute' && optionCount(question) >= 30 &&
    (question.attribute.type !== 'language' || wellKnown(question, 500) >= 25));
  // Prompts about film crews, shared casts, franchises, and collaborators have smaller
  // answer pools than the broad themes, so each type sets its own minimum.
  if (slot === 'special') return catalog.questions.filter((question) =>
    optionCount(question) >= (SPECIAL_MINIMUMS[question.kind] ?? Infinity));
  return catalog.questions.filter((question) =>
    optionCount(question) >= (FILM_MINIMUMS[question.kind] ?? Infinity) &&
    (question.kind !== 'studio' || wellKnown(question, 1000) >= 10));
}
function wellKnown(question, minimumVotes) {
  if (question.wellKnown) return question.wellKnown[minimumVotes] ?? 0;
  return question.movies.filter((movie) => movie.votes >= minimumVotes).length;
}
const SPECIAL_MINIMUMS = { title: 30, year: 30, crew: 10, franchise: 5, collab: 15 };
const FILM_MINIMUMS = { studio: 15, cast: 15, collab: 15 };

const ROUND_SLOTS = ['scenario','fact','attribute','character','special'];

const RELATED_SCENARIOS = [
  ['dog','cat','horse','talking-animal','animal-rescue'],
  ['spaceship','space-travel','space-station','astronaut','alien-planet','alien-invasion'],
  ['heist','bank-robbery','treasure-hunt'],
  ['prison','prison-escape'],
  ['witch','magic','magic-spell','curse','supernatural'],
  ['ghost','haunted-house','haunted-hotel'],
  ['cooking','restaurant','chef'],
  ['courtroom','jury','lawyer'],
  ['musician','concert','rock-band','music-competition'],
  ['dinosaur','monster','dragon'],
  ['forest','wilderness','jungle'],
  ['ocean','underwater','submarine','shipwreck','cruise-ship'],
  ['family-vacation','road-trip'],
  ['weapon-sword','weapon-bow','weapon-knife','weapon-axe','weapon-chainsaw','weapon-machete',
    'weapon-shotgun','weapon-sniper','weapon-machine-gun','weapon-grenade','weapon-dynamite',
    'weapon-bomb','weapon-whip','weapon-poison','booby-trap'],
  ['public-fight','shootout','duel','ambush','foot-chase','explosion','car-crash'],
  ['most-die','self-sacrifice','presumed-dead','terminal-illness','funeral'],
  ['forbidden-love','love-at-first-sight','love-triangle','love-letter','prom'],
  ['unlikely-friendship','friendship','childhood-friends','found-family','sibling-rivalry'],
  ['framed','conspiracy','whistleblower','double-agent','blackmail','undercover','secret-society'],
  ['plot-twist','unreliable-narrator','flashbacks','mistaken-identity','secret-identity','disguise'],
  ['non-human-lead','talking-animal','robot','dog','cat','horse'],
  ['dance-scene','talent-show','karaoke','music-competition','dance-competition','ballet'],
  ['chess','poker','board-game','casino'],
  ['stalker','lost-in-the-woods','forest','wilderness'],
];
function topicOf(question) {
  if (question.id === 'fact-video-game-adaptation' || question.id === 'scenario-video-game')
    return 'video-game';
  if (question.kind === 'attribute') return `attribute-${question.attribute.type.replace(/-.*/, '')}`;
  if (question.kind === 'fact') {
    if (question.fact.type === 'genre') return 'fact-genre';
    if (/book|comic|video-game-adaptation|stage-adaptation|manga-adaptation|toy-adaptation|short-story/.test(question.id))
      return 'fact-adaptation';
    if (/remake|sequel|prequel|spin-off/.test(question.id)) return 'fact-series';
    if (/black-and-white|stop-motion|silent-film|film-noir|neo-noir|anime|found-footage|mockumentary/.test(question.id))
      return 'fact-film-form';
    if (/halloween|new-years-eve|valentines-day/.test(question.id)) return 'fact-holiday';
    if (/western|swashbuckler|kaiju|slasher|cyberpunk/.test(question.id)) return 'fact-subgenre';
    return question.id;
  }
  // Prompts that all share one template should not appear together in a round.
  if (question.kind === 'year' || question.kind === 'title') return `${question.kind}-puzzle`;
  if (['cast','character'].includes(question.kind)) return `film-${question.id.split('-')[1]}`;
  // Each new prompt type is its own topic so a round never holds two of the same kind.
  if (['studio','crew','franchise','role','collab'].includes(question.kind)) return question.kind;
  if (question.kind !== 'scenario') return question.id;
  const group = RELATED_SCENARIOS.find((items) => items.includes(question.label));
  return group ? `scenario-${group[0]}` : question.id;
}
// Pick a type of prompt first, then a prompt inside it, so a big family of near-identical
// prompts (forty release years, sixteen genres) cannot crowd out everything else.
function pickBalanced(candidates, random) {
  const groups = new Map();
  for (const question of candidates) {
    const group = ['fact','attribute','year','title'].includes(question.kind) ? topicOf(question) :
      question.kind;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(question);
  }
  const list = [...groups.values()];
  const weights = list.map((group) => Math.sqrt(group.length));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  const index = weights.findIndex((weight) => (roll -= weight) < 0);
  const group = list[index < 0 ? list.length - 1 : index];
  return group[Math.floor(random() * group.length)];
}

function promptShape(question) {
  if (question.kind !== 'scenario') return null;
  if (/^Name a movie featuring/i.test(question.prompt)) return 'feature';
  if (/^Name a movie (?:about|where)/i.test(question.prompt)) return 'story';
  if (/^Name a movie set/i.test(question.prompt)) return 'setting';
  return 'other';
}

export function playableQuestions(catalog) {
  return [...new Map(['scenario','fact','film','character','special','attribute'].flatMap((slot) =>
    poolFor(catalog,slot)).map((question) => [question.id,question])).values()];
}

export function dailyQuestions(catalog, date) {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  if (!Number.isFinite(dayNumber)) throw new Error('Invalid daily date');
  let schedule = dailySchedules.get(catalog);
  if (!schedule) {
    schedule = { next: Math.min(dayNumber, DAILY_ANCHOR), days: new Map(), lastSeen: new Map() };
    dailySchedules.set(catalog, schedule);
  }
  // Build one deterministic sequence so yesterday's questions are excluded on
  // every device, without relying on browser storage or the order of requests.
  if (dayNumber < schedule.next && !schedule.days.has(dayNumber)) {
    schedule.next = dayNumber;
    schedule.days.clear();
    schedule.lastSeen.clear();
  }
  while (schedule.next <= dayNumber) {
    const current = schedule.next;
    let seed = (current ^ 0x71a19e6d) >>> 0;
    const random = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const recent = Array.from({ length: 10 }, (_, offset) =>
      schedule.days.get(current - offset - 1) || []).flat();
    const recentIds = new Set(recent.map((question) => question.id));
    const recentTopics = new Set(recent.slice(0, 20).map(topicOf));
    const selected = [];
    for (const slot of ROUND_SLOTS) {
      const pool = poolFor(catalog, slot).filter((question) =>
        !recentIds.has(question.id) && !selected.some((item) => item.id === question.id));
      if (!pool.length) throw new Error(`Not enough ${slot} prompts for a ten-day daily rotation`);
      const varied = pool.filter((question) => !recentTopics.has(topicOf(question)) &&
        !selected.some((item) => topicOf(item) === topicOf(question)));
      const candidates = varied.length ? varied : pool;
      const oldest = [...candidates].sort((a,b) =>
        (schedule.lastSeen.get(a.id) ?? -Infinity) - (schedule.lastSeen.get(b.id) ?? -Infinity));
      const frontier = oldest.slice(0, Math.max(1, Math.ceil(oldest.length * .2)));
      selected.push(pickBalanced(frontier, random));
    }
    for (let index=selected.length-1;index>0;index--) {
      const swap=Math.floor(random()*(index+1));
      [selected[index],selected[swap]]=[selected[swap],selected[index]];
    }
    schedule.days.set(current, selected);
    for (const question of selected) schedule.lastSeen.set(question.id, current);
    schedule.next++;
  }
  return schedule.days.get(dayNumber);
}

const DAILY_ANCHOR = Math.floor(Date.UTC(2020, 0, 1) / 86400000);
const dailySchedules = new WeakMap();

export function unlimitedQuestions(catalog, previousIds = [], random = Math.random) {
  const previous = new Set(previousIds);
  const eligible = playableQuestions(catalog);
  const recent = new Set(previousIds.slice(-40));
  const lastUsed = new Map(previousIds.map((id, index) => [id, index]));
  if (eligible.length < 5) throw new Error('The unlimited catalog needs at least five prompts');
  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  };
  const chosen = [];
  const byId = new Map(eligible.map((item) => [item.id, item]));
  const recentTopics = new Set(previousIds.slice(-30).map((id) => byId.get(id)).filter(Boolean).map(topicOf));
  const plans = [
    ['scenario','fact','character','special','film'],
    ['scenario','fact','attribute','character','film'],
    ['scenario','fact','special','attribute','film'],
    ['scenario','fact','film','special','character'],
    ['character','special','attribute','film','fact'],
    ['scenario','character','special','film','fact'],
  ];
  const plan = shuffle(plans[Math.floor(random() * plans.length)]);
  for (const slot of plan) {
    const notChosen = (question) => !chosen.some((item) => item.id === question.id);
    const slotPool = poolFor(catalog, slot).filter(notChosen);
    // Prefer prompts never played. When a type runs out, replay its longest-unseen
    // prompts instead of filling the round with another type.
    const unused = slotPool.filter((question) => !previous.has(question.id));
    const rested = slotPool.filter((question) => !recent.has(question.id))
      .sort((a, b) => (lastUsed.get(a.id) ?? -1) - (lastUsed.get(b.id) ?? -1));
    const pool = unused.length ? unused : rested.length ? rested.slice(0, Math.max(1, Math.ceil(rested.length / 2)))
      : slotPool;
    const varied = pool.filter((question) => !recentTopics.has(topicOf(question)) &&
      !chosen.some((item) => topicOf(item) === topicOf(question) ||
        (promptShape(question) && promptShape(item) === promptShape(question))));
    const candidates = varied.length ? varied : pool;
    chosen.push(pickBalanced(candidates.length ? candidates : eligible.filter(notChosen), random));
  }
  return chosen;
}
