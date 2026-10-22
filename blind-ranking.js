(() => {
  const $ = (id) => document.getElementById(id);
  const storageKey = 'movieknowledge-blind-ranking-v1';
  const posterBase = 'https://image.tmdb.org/t/p/';
  const size = 10;
  // The pool is sorted most well-known first. The top 600 mixes blockbusters with the
  // films the movie community loves, so most people have seen most of them.
  const famousCount = 600;
  let movies = [];
  let byId = new Map();
  let state;
  let lastPlaced = -1;

  function drawFilms() {
    const pool = movies.slice(0,famousCount);
    for (let index=0;index<size;index++) {
      const other = index+Math.floor(Math.random()*(pool.length-index));
      [pool[index],pool[other]] = [pool[other],pool[index]];
    }
    return pool.slice(0,size).map((movie) => movie.id);
  }

  function freshGame() {
    return { films:drawFilms(),slots:Array(size).fill(null),skipped:[] };
  }

  // "I haven't seen it": swap the current film for another well-known one.
  function skip() {
    if (!state) return;
    const placed = placedCount(state);
    if (placed >= size) return;
    const used = new Set([...state.films,...state.skipped]);
    const options = movies.slice(0,famousCount).filter((movie) => !used.has(movie.id));
    if (!options.length) return;
    state.skipped.push(state.films[placed]);
    state.films[placed] = options[Math.floor(Math.random()*options.length)].id;
    save();
    render(true);
  }

  const placedCount = (game) => game.slots.filter((id) => id !== null).length;

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.films) && saved.films.length === size &&
          saved.films.every((id) => byId.has(id)) && new Set(saved.films).size === size &&
          Array.isArray(saved.slots) && saved.slots.length === size) {
        const placed = saved.slots.filter((id) => id !== null);
        const expected = saved.films.slice(0,placed.length);
        if (placed.length && !placed.every((id) => expected.includes(id))) return freshGame();
        if (!Array.isArray(saved.skipped)) saved.skipped = [];
        if (new Set(placed).size === placed.length) return saved;
      }
    } catch { /* An unavailable or old save starts a fresh ranking. */ }
    return freshGame();
  }

  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(state)); }
    catch { /* Play continues when local storage is unavailable. */ }
  }

  function slotLabel(index) {
    if (index === 0) return 'Best';
    if (index === size-1) return 'Worst';
    return '';
  }

  function renderSlots(done) {
    const list = $('slots');
    list.replaceChildren();
    state.slots.forEach((id,index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'br-slot';
      const rank = document.createElement('span');
      rank.className = 'br-slot-rank';
      rank.textContent = String(index+1);
      const thumb = document.createElement('span');
      thumb.className = 'br-slot-thumb';
      const name = document.createElement('span');
      name.className = 'br-slot-name';
      const note = document.createElement('span');
      note.className = 'br-slot-note';
      note.textContent = slotLabel(index);
      if (id === null) {
        button.classList.add('is-empty');
        button.disabled = done;
        name.textContent = 'Place it here';
        button.setAttribute('aria-label',`Place the film at number ${index+1}${slotLabel(index) ? `, ${slotLabel(index).toLowerCase()}` : ''}`);
        button.addEventListener('click',() => place(index));
      } else {
        const movie = byId.get(id);
        button.classList.add('is-filled');
        if (index === lastPlaced) button.classList.add('is-just-placed');
        button.disabled = true;
        const image = document.createElement('img');
        image.src = `${posterBase}w92${movie.poster}`;
        image.alt = '';
        image.width = 38;
        image.height = 57;
        thumb.append(image);
        name.append(movie.title);
        const year = document.createElement('small');
        year.textContent = String(movie.year);
        name.append(year);
        button.setAttribute('aria-label',`Number ${index+1}: ${movie.title} (${movie.year})`);
      }
      button.append(rank,thumb,name,note);
      item.append(button);
      list.append(item);
    });
  }

  function render(animate = false) {
    const placed = placedCount(state);
    const done = placed === size;
    $('film-number').textContent = String(done ? size : placed+1);
    $('spots-left').textContent = String(size-placed);
    $('current-panel').hidden = done;
    $('done-panel').hidden = !done;
    renderSlots(done);
    if (done) {
      const top = byId.get(state.slots[0]);
      const bottom = byId.get(state.slots[size-1]);
      $('done-title').textContent = `${top.title} is your #1`;
      $('done-text').textContent = `${bottom.title} ended up last. Your ranking is locked in.`;
      $('ranking-status').textContent = 'All ten spots are filled.';
      return;
    }
    const movie = byId.get(state.films[placed]);
    $('current-eyebrow').textContent = `FILM ${placed+1} OF ${size}`;
    $('current-poster').src = `${posterBase}w342${movie.poster}`;
    $('current-poster').alt = `Poster for ${movie.title}`;
    $('current-title').textContent = movie.title;
    $('current-year').textContent = String(movie.year);
    const previous = state.films[placed-1];
    $('ranking-status').textContent = placed ?
      `${byId.get(previous).title} is locked in at number ${state.slots.indexOf(previous)+1}.` :
      'Where does this film belong, from 1 (best) to 10 (worst)?';
    if (animate) {
      const panel = $('current-panel');
      panel.classList.remove('is-new');
      void panel.offsetWidth;
      panel.classList.add('is-new');
    }
  }

  function place(index) {
    if (!state || state.slots[index] !== null) return;
    const placed = placedCount(state);
    if (placed >= size) return;
    state.slots[index] = state.films[placed];
    lastPlaced = index;
    save();
    render(true);
  }

  function restart() {
    if (!movies.length) return;
    state = freshGame();
    lastPlaced = -1;
    save();
    render(true);
  }

  $('new-run').addEventListener('click',restart);
  $('play-again').addEventListener('click',restart);
  $('skip-film').addEventListener('click',skip);

  async function load() {
    try {
      const response = await fetch('movie-pool.json?v=2');
      if (!response.ok) throw new Error(`Movie pool returned ${response.status}`);
      const pool = await response.json();
      movies = pool.filter((movie) => movie.id && movie.title && movie.poster?.startsWith('/') &&
        Number.isInteger(movie.year));
      if (movies.length < famousCount) throw new Error('The movie pool is incomplete');
      byId = new Map(movies.map((movie) => [movie.id,movie]));
      state = restore();
      $('load-message').hidden = true;
      $('ranking-arena').hidden = false;
      render();
    } catch (error) {
      console.warn('Could not load Blind Ranking:',error);
      $('load-message').textContent = 'Could not load the films. Refresh to try again.';
    }
  }
  load();
})();
