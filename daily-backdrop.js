(() => {
  // Posters in the empty space beside the game: an evenly spaced, slightly staggered row on each
  // side. All are softly see-through, and the smaller ones are fainter, which gives some depth.
  const layer = document.getElementById('poster-drift');
  if (!layer) return;
  const random = (low, high) => low + Math.random() * (high - low);
  // How far each row sits from the screen edge (percent), and how big and faint it is.
  const rows = [
    { size: 1, left: [2, 4.5], right: [86, 88.5] },
    { size: 0, left: [5.5, 8], right: [83, 85.5] },
    { size: 2, left: [2, 4.5], right: [87, 89.5] },
    { size: 1, left: [5.5, 8], right: [84, 86.5] },
    { size: 0, left: [2.5, 5], right: [86, 88.5] },
  ];
  fetch('poster-pool.json?v=1').then((response) => {
    if (!response.ok) throw new Error('Could not load poster pool');
    return response.json();
  }).then((pool) => {
    const posters = pool.filter((item) => item?.src?.startsWith('posters/'));
    for (let i = posters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posters[i], posters[j]] = [posters[j], posters[i]];
    }
    posters.slice(0, rows.length * 2).forEach((item, index) => {
      const side = index % 2 === 0 ? 'left' : 'right';
      const row = rows[Math.floor(index / 2)];
      const image = document.createElement('img');
      image.className = `drift-poster size-${row.size}`;
      image.src = item.src;
      image.alt = '';
      image.decoding = 'async';
      image.style.setProperty('--x', `${random(...row[side])}%`);
      // Rows start below the header and end above the footer, so no poster is cut off or stacked.
      image.style.setProperty('--y', `${12 + Math.floor(index / 2) * 15.5 + random(-1.2, 1.2)}%`);
      image.style.setProperty('--rot', `${random(-9, 9)}deg`);
      image.style.setProperty('--sway', `${random(-4, 4)}deg`);
      image.style.setProperty('--rise', `${random(10, 22)}px`);
      image.style.setProperty('--dur', `${random(8, 14)}s`);
      image.style.setProperty('--delay', `-${random(0, 14)}s`);
      layer.append(image);
    });
  }).catch((error) => console.warn('Poster backdrop unavailable:', error));
})();
