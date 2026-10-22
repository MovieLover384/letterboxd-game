(() => {
  const $ = (id) => document.getElementById(id);
  const storageKey = 'movieknowledge-movie-throne-v3';
  const posterBase = 'https://image.tmdb.org/t/p/w342';
  // The pool is sorted most well-known first. A run starts with the famous films
  // and unlocks more obscure ones as rounds go by, until the whole pool is in play.
  const startPool = 250;
  const unlockPerRound = 12;
  let movies = [];
  let byId = new Map();
  let state;

  function unlocked(rounds) {
    return Math.min(movies.length,startPool+rounds*unlockPerRound);
  }

  // Picks a random unlocked film that has not appeared in this run yet. Once the
  // unlocked part is used up, it falls back to any unseen film in the whole pool.
  function pick(rounds,seen) {
    const limit = unlocked(rounds);
    for (let attempt=0;attempt<50;attempt++) {
      const movie = movies[Math.floor(Math.random()*limit)];
      if (!seen.has(movie.id)) return movie.id;
    }
    const open = movies.slice(0,limit).filter((movie) => !seen.has(movie.id));
    const rest = open.length ? open : movies.filter((movie) => !seen.has(movie.id));
    return rest.length ? rest[Math.floor(Math.random()*rest.length)].id : null;
  }

  function freshRun(best = 0,bestId = null) {
    const champion = pick(0,new Set());
    const challenger = pick(0,new Set([champion]));
    return { champion,challenger,rounds:0,reign:0,best,bestId,seen:[champion,challenger],
      note:'Pick the one you would watch again.' };
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && byId.has(saved.champion) && byId.has(saved.challenger) &&
          saved.champion !== saved.challenger && Array.isArray(saved.seen) &&
          saved.seen.includes(saved.champion) && saved.seen.includes(saved.challenger) &&
          Number.isInteger(saved.rounds) && saved.rounds >= 0 &&
          Number.isInteger(saved.reign) && saved.reign >= 0 &&
          Number.isInteger(saved.best) && saved.best >= 0)
        return saved;
    } catch { /* An unavailable or old save starts a fresh run. */ }
    return freshRun();
  }

  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(state)); }
    catch { /* Play continues when local storage is unavailable. */ }
  }

  function nextChallenger() {
    return pick(state.rounds,new Set(state.seen));
  }

  function fillCard(side,movie,action) {
    $(`${side}-poster`).src = `${posterBase}${movie.poster}`;
    $(`${side}-poster`).alt = `Poster for ${movie.title}`;
    $(`${side}-title`).textContent = movie.title;
    $(`${side}-year`).textContent = String(movie.year);
    $(`${side}-action`).firstChild.textContent = `${action} `;
    $(`${side}-choice`).setAttribute('aria-label',`${action}: ${movie.title} (${movie.year})`);
  }

  function render(animate = false) {
    const champion = byId.get(state.champion);
    const challenger = byId.get(state.challenger);
    $('matchup-count').textContent = String(state.rounds);
    $('current-run').textContent = String(state.reign);
    $('best-run').textContent = String(state.best);
    $('best-film').textContent = byId.get(state.bestId)?.title || '';
    $('matchup-number').textContent = String(state.rounds+1).padStart(2,'0');
    $('champion-role').textContent = state.rounds ?
      `THE CHAMPION · ${state.reign} ${state.reign === 1 ? 'MATCHUP' : 'MATCHUPS'} WON` : 'OPENING FILM';
    fillCard('champion',champion,state.rounds ? 'Keep this film' : 'Pick this film');
    fillCard('challenger',challenger,state.rounds ? 'Dethrone it' : 'Pick this film');
    $('throne-status').textContent = state.note;
    if (animate) {
      const card = $('challenger-choice');
      card.classList.remove('is-new');
      void card.offsetWidth;
      card.classList.add('is-new');
    }
  }

  function choose(side) {
    if (!state) return;
    const opening = state.rounds === 0;
    if (side === 'challenger') state.champion = state.challenger;
    state.rounds++;
    state.reign = side === 'champion' && !opening ? state.reign+1 : 1;
    if (state.reign > state.best) {
      state.best = state.reign;
      state.bestId = state.champion;
    }
    // Every film shown so far stays out for the rest of the run, so a film that
    // lost a matchup never comes back.
    let next = nextChallenger();
    if (next === null) {
      // The whole pool has been shown: start over, keeping only the champion out.
      state.seen = [state.champion];
      next = nextChallenger();
    }
    state.challenger = next;
    state.seen.push(next);
    const champion = byId.get(state.champion).title;
    const challenger = byId.get(state.challenger).title;
    state.note = opening || side === 'challenger' ?
      `${champion} takes the throne. ${challenger} is next.` :
      `${champion} keeps the throne. ${challenger} is next.`;
    save();
    render(true);
  }

  $('champion-choice').addEventListener('click',() => choose('champion'));
  $('challenger-choice').addEventListener('click',() => choose('challenger'));
  $('new-run').addEventListener('click',() => {
    if (!movies.length) return;
    state = freshRun(state?.best || 0,state?.bestId ?? null);
    save();
    render(true);
    $('champion-choice').focus();
  });

  async function load() {
    $('load-message').textContent = 'Shuffling the films…';
    try {
      const response = await fetch('movie-pool.json?v=2');
      if (!response.ok) throw new Error(`Movie pool returned ${response.status}`);
      const pool = await response.json();
      movies = pool.filter((movie) => movie.id && movie.title && movie.poster?.startsWith('/') &&
        Number.isInteger(movie.year));
      if (movies.length < 10) throw new Error('The movie pool is incomplete');
      byId = new Map(movies.map((movie) => [movie.id,movie]));
      state = restore();
      $('load-message').hidden = true;
      $('throne-arena').hidden = false;
      render();
    } catch (error) {
      console.warn('Could not load Movie Throne:',error);
      $('load-message').textContent = 'Could not load the films. Refresh to try again.';
    }
  }
  load();
})();
