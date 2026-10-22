(() => {
  const $ = (id) => document.getElementById(id);
  const highScoreKey = 'movieknowledge-tagline-highscore';
  const recentKey = 'movieknowledge-tagline-recent-v1';
  let films = [];
  let film = null;
  let answered = true;
  let score = 0;
  let highScore = 0;
  let recent = [];
  try { highScore = Number(localStorage.getItem(highScoreKey)) || 0; } catch { /* Private browsing. */ }
  try { recent = JSON.parse(localStorage.getItem(recentKey)) || []; } catch { /* Private browsing. */ }

  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function nextFilm() {
    const blocked = new Set(recent.slice(-Math.min(100, Math.floor(films.length / 2))));
    const options = films.filter((item) => !blocked.has(item.title));
    const next = options[Math.floor(Math.random() * options.length)];
    recent = [...recent.filter((title) => title !== next.title), next.title].slice(-200);
    try { localStorage.setItem(recentKey, JSON.stringify(recent)); } catch { /* Keep playing. */ }
    return next;
  }

  // Wrong answers come from films of the same main genre, so the tagline has to do the work.
  function choices(correct) {
    const others = films.filter((item) => item !== correct);
    const sameGenre = shuffle(others.filter((item) => item.genre === correct.genre));
    const rest = shuffle(others.filter((item) => item.genre !== correct.genre));
    return shuffle([correct, ...[...sameGenre, ...rest].slice(0, 3)]);
  }

  function renderScores() {
    $('score').innerText = `Score: ${score}`;
    $('highscore').innerText = `High Score: ${highScore}`;
  }

  function start() {
    film = nextFilm();
    answered = false;
    $('tag-quote').textContent = film.tagline;
    $('result').textContent = '';
    $('tag-reveal').hidden = true;
    $('nextBtnContainer').hidden = true;
    $('tag-options').replaceChildren(...choices(film).map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-option';
      button.append(Object.assign(document.createElement('kbd'), { textContent: String(index + 1) }), item.title);
      button.addEventListener('click', () => answer(item, button));
      return button;
    }));
  }

  function answer(picked, button) {
    if (answered) return;
    answered = true;
    const correct = picked === film;
    for (const option of $('tag-options').children) {
      option.disabled = true;
      if (option.textContent.slice(1) === film.title) option.classList.add('is-correct');
    }
    if (!correct) button.classList.add('is-wrong');
    const box = $('result');
    if (correct) {
      score += 1;
      if (score > highScore) {
        highScore = score;
        try { localStorage.setItem(highScoreKey, String(highScore)); } catch { /* Keep playing. */ }
      }
      box.textContent = 'Correct!';
      box.dataset.tone = 'good';
    } else {
      box.textContent = `Not quite. It was ${film.title}. Your streak resets.`;
      box.dataset.tone = 'bad';
      score = 0;
    }
    renderScores();
    $('tag-poster').src = film.poster;
    $('tag-poster').alt = `Poster for ${film.title}`;
    $('tag-title').textContent = `${film.title} (${film.year})`;
    $('tag-meta').textContent = `Directed by ${film.director}`;
    $('tag-reveal').hidden = false;
    $('nextBtnContainer').hidden = false;
    $('nextBtn').focus({ preventScroll: true });
  }

  $('nextBtn').addEventListener('click', start);
  document.addEventListener('keydown', (event) => {
    if (answered || event.altKey || event.ctrlKey || event.metaKey) return;
    const option = $('tag-options').children[Number(event.key) - 1];
    if (option) option.click();
  });

  async function load() {
    try {
      const response = await fetch('guessmovie.json?v=1');
      if (!response.ok) throw new Error(`Film list returned ${response.status}`);
      // A tagline that contains the film's title would give the answer away.
      films = (await response.json()).map((item) => ({
        title: item.title,
        year: item.year,
        director: item.director,
        genre: (item.genres || [])[0] || '',
        tagline: String(item.tagline || '').trim(),
        poster: String(item.poster_url || '').replace('/original/', '/w185/'),
      })).filter((item) => item.title && item.tagline && item.poster && !normalize(item.tagline).includes(normalize(item.title)));
      if (films.length < 20) throw new Error('The tagline list is incomplete');
      renderScores();
      $('load-message').hidden = true;
      $('tag-game').hidden = false;
      start();
    } catch (error) {
      console.warn('Could not load Tagline Quiz:', error);
      $('load-message').textContent = 'Could not load the taglines. Refresh to try again.';
    }
  }
  load();
})();
