(() => {
  const $ = (id) => document.getElementById(id);
  // Frames are stills of real trailers and scene clips, served as images by YouTube.
  const frameUrl = (frame) => `https://i.ytimg.com/vi/${frame}.jpg`;
  const highScoreKey = 'movieknowledge-guessframe-highscore';
  const frameCount = 6;
  let films = [];
  let allMovies = [];
  let film = null;
  let shown = 1;
  let viewing = 1;
  let over = false;
  let selected = null;
  let activeIndex = -1;
  let matches = [];
  let score = 0;
  let highScore = 0;
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }

  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();

  // A film (and the other films of its series) does not come back until about 150 other
  // films have been played. What was played is remembered in this browser.
  const recentKey = 'movieknowledge-guessframe-recent-v3';
  const spacing = 150;
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem(recentKey)) || []; } catch { /* Private browsing. */ }

  // Sequels share a series key: the collection TMDB puts them in, or else the title before
  // any colon or dash with trailing numbers, "Part 2" and roman numerals removed.
  function seriesKey(item) {
    if (item.collection) return `c${item.collection}`;
    const base = normalize(item.title.split(/[:\u2013\u2014-]/)[0])
      .replace(/\b(part|chapter|vol|volume)\s+\w+$/,'').replace(/\s+(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)$/,'').trim();
    return `t${base}`;
  }

  // Films the Letterboxd crowd loves come up more often: a higher rating and more members
  // listing it as a favorite both raise the odds. Films from big series (Transformers,
  // Superman, ...) come up less, so no franchise takes over.
  let seriesSizes = new Map();
  function weightOf(item) {
    const rating = item.rating;
    const quality = rating === undefined ? 1 : rating >= 7.6 ? 3 : rating >= 7.2 ? 2 : rating >= 6.6 ? 1 : 0.4;
    const fans = 1+Math.min(item.favorites || 0,10)*0.4;
    const franchise = (seriesSizes.get(seriesKey(item)) || 1) >= 3 ? 0.3 : 1;
    return quality*fans*franchise;
  }

  function nextFilm() {
    if (!seriesSizes.size) for (const item of films) {
      const key = seriesKey(item);
      seriesSizes.set(key,(seriesSizes.get(key) || 0)+1);
    }
    // With a short list, hold back at most half of the series so there is always a choice.
    const holdBack = Math.min(spacing,Math.floor(seriesSizes.size/2));
    const blocked = new Set(recent.slice(-holdBack));
    let options = films.filter((item) => !blocked.has(seriesKey(item)));
    if (!options.length) options = films;
    const total = options.reduce((sum,item) => sum+weightOf(item),0);
    let ticket = Math.random()*total;
    let next = options[options.length-1];
    for (const item of options) {
      ticket -= weightOf(item);
      if (ticket <= 0) { next = item; break; }
    }
    recent = recent.filter((key) => key !== seriesKey(next));
    recent.push(seriesKey(next));
    recent = recent.slice(-spacing*2);
    try { localStorage.setItem(recentKey,JSON.stringify(recent)); } catch { /* Keep playing. */ }
    return next;
  }

  function renderScores() {
    $('score').innerText = `Score: ${score}`;
    $('highscore').innerText = `High Score: ${highScore}`;
  }

  function showResult(message,good) {
    const box = $('result');
    box.textContent = message;
    box.dataset.tone = good ? 'good' : 'bad';
  }

  function renderThumbs() {
    $('frame-thumbs').replaceChildren(...film.frames.map((path,index) => {
      const number = index+1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'frame-thumb';
      if (number > shown) {
        button.classList.add('is-locked');
        button.disabled = true;
        button.textContent = String(number);
        button.setAttribute('aria-label',`Frame ${number}, not revealed yet`);
      } else {
        if (number === viewing) button.classList.add('is-current');
        const image = document.createElement('img');
        image.src = frameUrl(path);
        image.alt = '';
        const label = document.createElement('span');
        label.textContent = String(number);
        button.append(image,label);
        button.setAttribute('aria-label',`Look at frame ${number} again`);
        button.addEventListener('click',() => { viewing = number; render(); });
      }
      return button;
    }));
  }

  function render() {
    $('frame-image').src = frameUrl(film.frames[viewing-1]);
    $('frame-count').textContent = `Frame ${viewing} of ${frameCount}`;
    $('frame-points').textContent = over ? '' : `Worth ${frameCount+1-shown} point${frameCount+1-shown === 1 ? '' : 's'}`;
    renderThumbs();
    const last = shown >= frameCount;
    $('moreMoviesBtn').hidden = over || last;
    $('guessBtn').hidden = over;
    $('giveUpBtn').hidden = over;
    $('guess-area').hidden = over;
    $('playAgainBtn').hidden = !over;
    if (!over && shown < frameCount) new Image().src = frameUrl(film.frames[shown]);
  }

  function start() {
    film = nextFilm();
    shown = 1;
    viewing = 1;
    over = false;
    selected = null;
    $('movieSearch').value = '';
    $('movieSearch').disabled = false;
    $('result').textContent = '';
    hideSuggestions();
    render();
    $('movieSearch').focus({ preventScroll:true });
  }

  function finish(won,points) {
    over = true;
    viewing = shown;
    if (won) {
      score += points;
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem(highScoreKey,String(highScore)); } catch { /* Keep playing. */ }
      }
    } else {
      score = 0;
    }
    renderScores();
    $('movieSearch').disabled = true;
    hideSuggestions();
    render();
  }

  function revealNext() {
    shown = Math.min(frameCount,shown+1);
    viewing = shown;
    render();
  }

  function guess() {
    if (over) return;
    if (!selected) { showResult('Pick a movie from the list first.',false); return; }
    const title = `${film.title} (${film.year})`;
    if (selected.id === film.id) {
      const points = frameCount+1-shown;
      showResult(`Correct! It is ${title}. You earn ${points} point${points === 1 ? '' : 's'}.`,true);
      finish(true,points);
      return;
    }
    if (shown >= frameCount) {
      showResult(`Not quite. It was ${title}. Your streak resets.`,false);
      finish(false,0);
      return;
    }
    showResult(`${selected.title} is not it. Here is the next frame.`,false);
    selected = null;
    $('movieSearch').value = '';
    hideSuggestions();
    revealNext();
  }

  function skip() {
    if (over || shown >= frameCount) return;
    showResult('Skipped. Here is the next frame.',false);
    revealNext();
  }

  function giveUp() {
    if (over) return;
    showResult(`It was ${film.title} (${film.year}). Your streak resets.`,false);
    finish(false,0);
  }

  function hideSuggestions() {
    $('suggestions').hidden = true;
    $('suggestions').replaceChildren();
    $('movieSearch').setAttribute('aria-expanded','false');
    matches = [];
    activeIndex = -1;
  }

  function choose(movie) {
    selected = movie;
    $('movieSearch').value = `${movie.title} (${movie.year})`;
    hideSuggestions();
  }

  function setActive(index) {
    activeIndex = index;
    [...$('suggestions').children].forEach((item,position) =>
      item.classList.toggle('is-active',position === index));
  }

  function search() {
    selected = null;
    const query = normalize($('movieSearch').value);
    if (query.length < 2) { hideSuggestions(); return; }
    const words = query.split(' ');
    // Best matches first: the whole title, a title that starts with the search, titles with a
    // word that starts with it, and only then titles that merely contain it. Within each
    // group the better-known film comes first (the list is sorted that way).
    const ranked = [[],[],[],[]];
    for (const movie of allMovies) {
      if (!words.every((word) => movie.search.includes(word))) continue;
      const title = movie.search.replace(/^the /,'');
      if (movie.search === query || title === query) ranked[0].push(movie);
      else if (movie.search.startsWith(query) || title.startsWith(query)) ranked[1].push(movie);
      else if (words.every((word) => (` ${movie.search}`).includes(` ${word}`))) ranked[2].push(movie);
      else ranked[3].push(movie);
    }
    matches = ranked.flat().slice(0,30);
    const list = $('suggestions');
    list.replaceChildren(...matches.map((movie,index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggestion';
      item.setAttribute('role','option');
      item.append(movie.title,Object.assign(document.createElement('small'),{ textContent:String(movie.year) }));
      // mousedown fires before the input loses focus, so the pick is never lost.
      item.addEventListener('mousedown',(event) => { event.preventDefault(); choose(movie); });
      return item;
    }));
    list.hidden = !matches.length;
    $('movieSearch').setAttribute('aria-expanded',String(Boolean(matches.length)));
    activeIndex = -1;
  }

  $('movieSearch').addEventListener('input',search);
  $('movieSearch').addEventListener('blur',() => setTimeout(hideSuggestions,120));
  $('movieSearch').addEventListener('keydown',(event) => {
    if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setActive((activeIndex+1)%matches.length); }
    else if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setActive((activeIndex-1+matches.length)%matches.length); }
    else if (event.key === 'Escape') hideSuggestions();
    else if (event.key === 'Enter') {
      event.preventDefault();
      if (matches.length) choose(matches[Math.max(activeIndex,0)]);
      else guess();
    }
  });
  $('guessBtn').addEventListener('click',guess);
  $('moreMoviesBtn').addEventListener('click',skip);
  $('giveUpBtn').addEventListener('click',giveUp);
  $('playAgainBtn').addEventListener('click',start);

  async function load() {
    try {
      const [frameResponse,movieResponse,blockResponse] = await Promise.all([fetch('frame-pool.json?v=7'),fetch('movie-pool.json?v=2'),fetch('frame-blocklist.json?v=1')]);
      // Frames listed in frame-blocklist.json (ones that show a title or other giveaway) take their whole film out of play.
      const blocked = new Set(blockResponse.ok ? await blockResponse.json() : []);
      if (!frameResponse.ok || !movieResponse.ok) throw new Error('Could not fetch the film lists');
      films = (await frameResponse.json()).filter((item) => item.id && item.title && !item.frames.some((frame) => blocked.has(frame)) &&
        Array.isArray(item.frames) && item.frames.length === frameCount);
      allMovies = (await movieResponse.json()).map((movie) => ({ id:movie.id,title:movie.title,year:movie.year,
        search:normalize(movie.title) }));
      if (films.length < 10) throw new Error('The scene list is incomplete');
      renderScores();
      $('load-message').hidden = true;
      $('frame-game').hidden = false;
      start();
    } catch (error) {
      console.warn('Could not load Guess the Scene:',error);
      $('load-message').textContent = 'Could not load the scenes. Refresh to try again.';
    }
  }
  load();
})();
