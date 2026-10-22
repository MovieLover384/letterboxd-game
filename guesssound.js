(() => {
  const $ = (id) => document.getElementById(id);
  const highScoreKey = 'movieknowledge-guesssound-highscore';
  const recentKey = 'movieknowledge-guesssound-recent-v2';
  const spacing = 150;
  const levels = 3; // 1: dialogue only, 2: cast, 3: release year
  const maxClipSeconds = 20;
  let films = [];
  let allMovies = [];
  let film = null;
  let clip = null;
  let window_ = { start:0,end:maxClipSeconds };
  let level = 1;
  let over = false;
  let selected = null;
  let activeIndex = -1;
  let matches = [];
  let score = 0;
  let highScore = 0;
  let recent = [];
  let player = null;
  let playerReady = false;
  let failures = 0;
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }
  try { recent = JSON.parse(localStorage.getItem(recentKey)) || []; } catch { /* Private browsing. */ }

  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();

  // ---- Picking a clip: keep films and their series apart between rounds ----
  function seriesKey(item) {
    const base = normalize(item.title.split(/[:–—-]/)[0])
      .replace(/\b(part|chapter|vol|volume)\s+\w+$/,'').replace(/\s+(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)$/,'').trim();
    return `t${base}`;
  }

  function nextFilm() {
    const series = new Set(films.map(seriesKey));
    const holdBack = Math.min(spacing,Math.floor(series.size/2));
    const blocked = new Set(recent.slice(-holdBack));
    let options = films.filter((item) => !blocked.has(seriesKey(item)));
    if (!options.length) options = films;
    const totalWeight = options.reduce((sum,item) => sum + (item.familiar ? 3 : 1),0);
    let draw = Math.random()*totalWeight;
    let next = options.at(-1);
    for (const item of options) {
      draw -= item.familiar ? 3 : 1;
      if (draw < 0) { next = item; break; }
    }
    recent = recent.filter((key) => key !== seriesKey(next));
    recent.push(seriesKey(next));
    recent = recent.slice(-spacing*2);
    try { localStorage.setItem(recentKey,JSON.stringify(recent)); } catch { /* Keep playing. */ }
    return next;
  }

  // ---- Sound: YouTube's own embedded player, used for its sound only ----
  // The clip is loaded (muted) and paused at its start as soon as the round begins, so pressing
  // play starts it at once instead of waiting for it to buffer.
  let volume = 80;
  let muted = false;
  let phase = 'idle'; // idle -> settling -> ready
  let ticker = null;
  try { volume = Number(localStorage.getItem('movieknowledge-guesssound-volume') ?? 80); muted = localStorage.getItem('movieknowledge-guesssound-muted') === '1'; } catch { /* Private browsing. */ }
  if (!Number.isFinite(volume)) volume = 80;

  function loadYouTube() {
    return new Promise((resolve,reject) => {
      if (window.YT?.Player) { resolve(); return; }
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = reject;
      document.head.append(script);
    });
  }

  const clock = (seconds) => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const clipSeconds = () => window_.end-window_.start;

  function fill(input) {
    input.style.setProperty('--fill',`${(input.value-input.min)/(input.max-input.min)*100}%`);
  }

  function showTime(elapsed) {
    const length = clipSeconds();
    const shown = Math.min(Math.max(elapsed,0),length);
    $('time-now').textContent = clock(shown);
    $('time-total').textContent = clock(length);
    $('timeline').value = String(Math.round(shown/length*1000));
    fill($('timeline'));
  }

  function applyVolume() {
    const silent = muted || volume === 0;
    $('volume').value = String(volume);
    fill($('volume'));
    $('muteBtn').classList.toggle('is-muted',silent);
    $('muteBtn').setAttribute('aria-label',silent ? 'Unmute' : 'Mute');
    if (!player || !playerReady || phase === 'settling') return;
    try { player.setVolume(volume); if (silent) player.mute(); else player.unMute(); } catch { /* The player is gone. */ }
  }

  function setPlaying(playing) {
    $('sound-card').classList.toggle('is-playing',playing);
    $('playBtn').setAttribute('aria-label',playing ? 'Pause the clip' : 'Play the clip');
    clearInterval(ticker);
    if (playing) ticker = setInterval(tick,100);
  }

  // Runs while playing: moves the timeline and stops at the end of the stretch.
  function tick() {
    if (phase !== 'ready') return;
    const elapsed = player.getCurrentTime()-window_.start;
    showTime(elapsed);
    if (elapsed >= clipSeconds()) { player.pauseVideo(); player.seekTo(window_.start,true); setPlaying(false); showTime(0); }
  }

  function stopSound() {
    clearInterval(ticker);
    if (playerReady && phase === 'ready') { try { player.pauseVideo(); } catch { /* The player is gone. */ } }
    setPlaying(false);
  }

  // Play the curated excerpt around the spoken line, with a firm 20-second ceiling.
  function chooseWindow() {
    return { start:clip.start,end:Math.min(clip.end,clip.start+maxClipSeconds) };
  }

  function loadClip() {
    if (!playerReady) return;
    setPlaying(false);
    $('playBtn').disabled = true;
    $('timeline').disabled = true;
    $('sound-caption').textContent = 'Getting the clip ready…';
    window_ = chooseWindow();
    showTime(0);
    player.mute();
    phase = 'settling';
    player.loadVideoById({ videoId:clip.video,startSeconds:window_.start });
  }

  function becomeReady() {
    phase = 'ready';
    player.pauseVideo();
    player.seekTo(window_.start,true);
    $('playBtn').disabled = false;
    $('timeline').disabled = false;
    $('sound-caption').textContent = 'Press play and listen closely. You can replay the clip as often as you like.';
    showTime(0);
    applyVolume();
  }

  function play() {
    if (phase !== 'ready') return;
    if ($('sound-card').classList.contains('is-playing')) { player.pauseVideo(); setPlaying(false); return; }
    const elapsed = player.getCurrentTime()-window_.start;
    if (elapsed < 0 || elapsed >= clipSeconds()-0.2) player.seekTo(window_.start,true);
    applyVolume();
    player.playVideo();
    setPlaying(true);
  }

  function onStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      if (phase === 'settling') becomeReady();
    }
    if (event.data === YT.PlayerState.ENDED && phase === 'ready') setPlaying(false);
  }

  // A video that cannot play (removed, or embedding switched off) is swapped for another clip.
  function onError() {
    failures++;
    setPlaying(false);
    if (failures > 8) { $('sound-caption').textContent = 'Clips are not playing right now. Try again later.'; return; }
    if (!over) swapClip();
  }

  function setUpPlayer() {
    loadYouTube().then(() => {
      player = new YT.Player('yt-player',{ width:'200',height:'200',videoId:clip.video,
        playerVars:{ controls:0,disablekb:1,fs:0,modestbranding:1,rel:0,playsinline:1,iv_load_policy:3,autoplay:0,origin:location.origin },
        events:{ onReady:() => { playerReady = true; loadClip(); },onStateChange,onError } });
    }).catch(() => { $('sound-caption').textContent = 'Could not reach YouTube. Check your connection and refresh.'; });
  }
  // ---- The round ----
  function renderScores() {
    $('score').innerText = `Score: ${score}`;
    $('highscore').innerText = `High Score: ${highScore}`;
  }

  function showResult(message,good) {
    const box = $('result');
    box.textContent = message;
    box.dataset.tone = good ? 'good' : 'bad';
  }

  function showReveal() {
    const poster = $('sound-reveal-poster');
    poster.hidden = !film.poster;
    if (film.poster) poster.src = `https://image.tmdb.org/t/p/w342${film.poster}`;
    $('sound-reveal-title').textContent = film.title;
    $('sound-reveal-year').textContent = `(${film.year})`;
    $('sound-reveal-line').textContent = `“${clip.line}”`;
    $('sound-reveal-speaker').textContent = `— ${clip.speaker} in ${film.title} (${film.year})`;
    $('sound-reveal').hidden = false;
  }

  function render() {
    const points = levels+1-level;
    $('sound-level').textContent = over ? 'Answer revealed' : ['Listen first','Cast revealed','Year revealed'][level-1];
    $('sound-points').textContent = over ? '' : `Worth ${points} point${points === 1 ? '' : 's'}`;
    $('sound-hints').hidden = over || level === 1;
    $('sound-cast-hint').hidden = over || level < 2;
    $('sound-year-hint').hidden = over || level < 3;
    $('sound-cast').textContent = film.cast.join(' and ');
    $('sound-year').textContent = String(film.year);
    $('moreMoviesBtn').hidden = over || level >= levels;
    $('moreMoviesBtn').textContent = level === 1 ? 'Reveal cast' : 'Reveal year';
    $('guessBtn').hidden = over;
    $('giveUpBtn').hidden = over;
    $('guess-area').hidden = over;
    $('playAgainBtn').hidden = !over;
    $('sound-source').hidden = !over;
    if (over) $('sound-source').href = `https://www.youtube.com/watch?v=${clip.video}${clip.start ? `&t=${clip.start}s` : ''}`;
  }

  function pickClip(item) {
    return item.clips[Math.floor(Math.random()*item.clips.length)];
  }

  function swapClip() {
    // Another clip of this film if there is one, otherwise another film.
    const others = film.clips.filter((item) => item !== clip);
    if (others.length) clip = others[Math.floor(Math.random()*others.length)];
    else { film = nextFilm(); clip = pickClip(film); level = 1; $('result').textContent = ''; }
    stopSound();
    loadClip();
    render();
  }

  function start() {
    stopSound();
    film = nextFilm();
    clip = pickClip(film);
    level = 1;
    over = false;
    selected = null;
    $('movieSearch').value = '';
    $('movieSearch').disabled = false;
    $('result').textContent = '';
    $('sound-reveal').hidden = true;
    $('sound-caption').textContent = 'Press play and listen closely. You can replay the clip as often as you like.';
    hideSuggestions();
    render();
    if (!player) setUpPlayer(); else loadClip();
    $('movieSearch').focus({ preventScroll:true });
  }

  function finish(won,points) {
    over = true;
    stopSound();
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
    showReveal();
    render();
  }

  function guess() {
    if (over) return;
    if (!selected) { showResult('Pick a movie from the list first.',false); return; }
    if (selected.id === film.id) {
      const points = levels+1-level;
      showResult(`Correct! +${points} point${points === 1 ? '' : 's'}.`,true);
      finish(true,points);
      return;
    }
    if (level >= levels) {
      showResult('Not quite. The answer is below. Your score resets.',false);
      finish(false,0);
      return;
    }
    showResult(`${selected.title} is not it. ${level === 1 ? 'Cast' : 'Release year'} revealed.`,false);
    selected = null;
    $('movieSearch').value = '';
    hideSuggestions();
    level++;
    render();
  }

  function moreHelp() {
    if (over || level >= levels) return;
    $('result').textContent = '';
    level++;
    render();
  }

  function giveUp() {
    if (over) return;
    showResult('Answer revealed. Your score resets.',false);
    finish(false,0);
  }

  // ---- Movie search ----
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
    // Whole title first, then titles starting with the search, then titles with a word that
    // starts with it, then the rest; the better-known film comes first in each group.
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
    list.replaceChildren(...matches.map((movie) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggestion';
      item.setAttribute('role','option');
      item.append(movie.title,Object.assign(document.createElement('small'),{ textContent:String(movie.year) }));
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
  $('playBtn').addEventListener('click',play);
  $('timeline').addEventListener('input',() => {
    if (phase !== 'ready') return;
    const elapsed = $('timeline').value/1000*clipSeconds();
    player.seekTo(window_.start+elapsed,true);
    showTime(elapsed);
  });
  $('volume').addEventListener('input',() => {
    volume = Number($('volume').value);
    if (volume > 0) muted = false;
    try { localStorage.setItem('movieknowledge-guesssound-volume',String(volume)); localStorage.setItem('movieknowledge-guesssound-muted',muted ? '1' : '0'); } catch { /* Keep playing. */ }
    applyVolume();
  });
  $('muteBtn').addEventListener('click',() => {
    muted = !(muted || volume === 0);
    if (!muted && volume === 0) volume = 60;
    try { localStorage.setItem('movieknowledge-guesssound-volume',String(volume)); localStorage.setItem('movieknowledge-guesssound-muted',muted ? '1' : '0'); } catch { /* Keep playing. */ }
    applyVolume();
  });  $('guessBtn').addEventListener('click',guess);
  $('moreMoviesBtn').addEventListener('click',moreHelp);
  $('giveUpBtn').addEventListener('click',giveUp);
  $('playAgainBtn').addEventListener('click',() => start());
  window.addEventListener('pagehide',stopSound);

  async function load() {
    try {
      const [clipResponse,movieResponse] = await Promise.all([fetch('sound-clips-featured.json?v=3'),fetch('movie-pool.json?v=2')]);
      if (!clipResponse.ok || !movieResponse.ok) throw new Error('Could not fetch the film lists');
      films = (await clipResponse.json()).filter((item) => item.id && item.title &&
        Array.isArray(item.clips) && item.clips.length && item.clips.every((entry) =>
          /^[\w-]{11}$/.test(entry.video) && Number.isFinite(entry.start) && Number.isFinite(entry.end) &&
          entry.start >= 0 && entry.end > entry.start && entry.end-entry.start <= maxClipSeconds));
      allMovies = (await movieResponse.json()).map((movie) => ({ id:movie.id,title:movie.title,year:movie.year,
        search:normalize(movie.title) }));
      if (films.length < 10) throw new Error('The clip list is incomplete');
      renderScores();
      applyVolume();
      $('load-message').hidden = true;
      $('sound-game').hidden = false;
      start();
    } catch (error) {
      console.warn('Could not load Movie Quote Quiz:',error);
      $('load-message').textContent = 'Could not load the clips. Refresh to try again.';
    }
  }
  load();
})();
