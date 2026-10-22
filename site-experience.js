(() => {
  // Gentle outcome cues. One audio context is unlocked by the first game gesture.
  let context;
  function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!context) context = new AudioContextClass();
    if (context.state === 'suspended') context.resume().catch(() => {});
  }
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
  function note(frequency, start, duration, level, type = 'sine') {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }
  function playCue(kind) {
    if (!context || context.state !== 'running') return;
    const now = context.currentTime;
    if (kind === 'wrong') {
      note(262, now, .18, .025, 'triangle');
      note(196, now + .09, .22, .018);
    } else {
      note(523, now, .24, .032);
      note(659, now + .085, .27, .025);
      if (kind === 'rare') note(784, now + .17, .36, .022);
    }
  }

  window.addEventListener('mk:score', (event) => {
    const { points, skipped } = event.detail || {};
    if (!skipped) playCue(points >= 75 ? 'rare' : points ? 'correct' : 'wrong');
  });

  const result = document.querySelector('#result');
  if (result && !document.querySelector('.game-panel')) {
    let previous = '';
    new MutationObserver(() => {
      const message = result.textContent.trim().toLowerCase();
      if (!message || message === previous) return;
      previous = message;
      if (/^(correct!|you won!|you got it\.)/.test(message)) playCue('correct');
      else if (/^(wrong!|you lost!|good try\.|incorrect)/.test(message)) playCue('wrong');
    }).observe(result, { childList: true, subtree: true, characterData: true });
  }

  const posters = [...document.querySelectorAll('.poster-stage .floating-poster')];
  if (!posters.length) return;
  fetch('poster-pool.json?v=1').then((response) => {
    if (!response.ok) throw new Error('Could not load poster pool');
    return response.json();
  }).then((pool) => {
    const available = pool.filter((item) => item?.src?.startsWith('posters/'));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    posters.forEach((poster, index) => {
      const item = available[index];
      if (item) poster.src = item.src;
    });
    document.querySelectorAll('.games-grid .card').forEach((card, index) => {
      const item = available[posters.length + index];
      if (item) card.style.setProperty('--card-poster', `url("${item.src}")`);
    });
  }).catch((error) => console.warn('Poster shuffle unavailable:', error));
})();
