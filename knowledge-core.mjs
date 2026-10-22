export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function directorGroups(movies, minimum = 3) {
  const groups = new Map();
  for (const movie of movies) {
    if (!movie.director || !Number.isInteger(movie.year) || !movie.poster) continue;
    if (!groups.has(movie.director)) groups.set(movie.director, []);
    groups.get(movie.director).push(movie);
  }
  return [...groups].filter(([, films]) => new Set(films.map(film => film.year)).size >= minimum);
}

export function directorRounds(movies, random = Math.random) {
  const groups = directorGroups(movies);
  const names = groups.map(([name]) => name);
  return shuffle(groups, random).map(([answer, films]) => ({
    type: 'director', answer,
    films: shuffle(films, random).slice(0, 3),
    options: shuffle([answer, ...shuffle(names.filter(name => name !== answer), random).slice(0, 3)], random),
  }));
}

export function castRounds(movies, random = Math.random) {
  const candidates = [];
  for (let i = 0; i < movies.length; i++) {
    const left = movies[i];
    if (!left.cast?.length || !left.poster) continue;
    for (let j = i + 1; j < movies.length; j++) {
      const right = movies[j];
      if (!right.cast?.length || !right.poster || left.director === right.director ||
          Math.abs(left.year - right.year) < 2) continue;
      const common = left.cast.filter(actor => right.cast.includes(actor));
      if (common.length !== 1) continue;
      const alternatives = [...new Set([...left.cast, ...right.cast].filter(actor => actor !== common[0]))];
      if (alternatives.length < 3) continue;
      candidates.push({ left, right, answer: common[0], alternatives, priority: i + j });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  const actorUses = new Map();
  const filmUses = new Map();
  const chosen = [];
  for (const pair of candidates) {
    if ((actorUses.get(pair.answer) || 0) >= 7 ||
        (filmUses.get(pair.left.title) || 0) >= 8 ||
        (filmUses.get(pair.right.title) || 0) >= 8) continue;
    chosen.push(pair);
    actorUses.set(pair.answer, (actorUses.get(pair.answer) || 0) + 1);
    filmUses.set(pair.left.title, (filmUses.get(pair.left.title) || 0) + 1);
    filmUses.set(pair.right.title, (filmUses.get(pair.right.title) || 0) + 1);
    if (chosen.length >= 220) break;
  }
  return shuffle(chosen, random).map(pair => ({
    type: 'cast', answer: pair.answer, films: [pair.left, pair.right],
    options: shuffle([pair.answer, ...shuffle(pair.alternatives, random).slice(0, 3)], random),
  }));
}

export function timelineRounds(movies, random = Math.random) {
  return shuffle(directorGroups(movies, 4), random).map(([director, films]) => {
    const byYear = new Map();
    for (const film of shuffle(films, random)) if (!byYear.has(film.year)) byYear.set(film.year, film);
    return { type: 'timeline', director, films: shuffle([...byYear.values()].slice(0, 4), random) };
  });
}

export function timelineResult(round, orderedFilms) {
  const correct = [...round.films].sort((a, b) => a.year - b.year);
  return { correct, exact: orderedFilms.every((film, i) => film === correct[i]),
    positions: orderedFilms.filter((film, i) => film === correct[i]).length };
}
