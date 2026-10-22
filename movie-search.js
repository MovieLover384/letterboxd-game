// Movie title autocomplete shared by the guessing games.
// createMovieSearch({ input, list, movies, onSubmit }) wires an <input> and a listbox <div>
// to a list of { title, year } films. It returns { selected(), reset() }.
(() => {
  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

  window.createMovieSearch = function createMovieSearch({ input, list, movies, onSubmit = () => {} }) {
    const index = movies.map((movie) => ({ movie, search: normalize(movie.title) }));
    let matches = [];
    let activeIndex = -1;
    let selected = null;

    function hide() {
      list.hidden = true;
      list.replaceChildren();
      input.setAttribute('aria-expanded', 'false');
      matches = [];
      activeIndex = -1;
    }

    function choose(movie) {
      selected = movie;
      input.value = `${movie.title} (${movie.year})`;
      hide();
    }

    function setActive(position) {
      activeIndex = position;
      [...list.children].forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === position));
    }

    function search() {
      selected = null;
      const query = normalize(input.value);
      if (query.length < 2) { hide(); return; }
      const words = query.split(' ');
      // The whole title first, then titles starting with the search, then titles with a word that
      // starts with it, then titles that merely contain it. The list is sorted best known first.
      const ranked = [[], [], [], []];
      for (const entry of index) {
        if (!words.every((word) => entry.search.includes(word))) continue;
        const title = entry.search.replace(/^the /, '');
        if (entry.search === query || title === query) ranked[0].push(entry.movie);
        else if (entry.search.startsWith(query) || title.startsWith(query)) ranked[1].push(entry.movie);
        else if (words.every((word) => ` ${entry.search}`.includes(` ${word}`))) ranked[2].push(entry.movie);
        else ranked[3].push(entry.movie);
      }
      matches = ranked.flat().slice(0, 30);
      list.replaceChildren(...matches.map((movie) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'suggestion';
        item.setAttribute('role', 'option');
        item.append(movie.title, Object.assign(document.createElement('small'), { textContent: String(movie.year) }));
        // mousedown fires before the input loses focus, so the pick is never lost.
        item.addEventListener('mousedown', (event) => { event.preventDefault(); choose(movie); });
        return item;
      }));
      list.hidden = !matches.length;
      input.setAttribute('aria-expanded', String(Boolean(matches.length)));
      activeIndex = -1;
    }

    input.addEventListener('input', search);
    input.addEventListener('blur', () => setTimeout(hide, 120));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && matches.length) { event.preventDefault(); setActive((activeIndex + 1) % matches.length); }
      else if (event.key === 'ArrowUp' && matches.length) { event.preventDefault(); setActive((activeIndex - 1 + matches.length) % matches.length); }
      else if (event.key === 'Escape') hide();
      else if (event.key === 'Enter') {
        event.preventDefault();
        if (matches.length) choose(matches[Math.max(activeIndex, 0)]);
        else onSubmit();
      }
    });

    return {
      selected: () => selected,
      reset() { selected = null; input.value = ''; hide(); },
    };
  };
})();
