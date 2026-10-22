function rows(text) {
  const result = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if ((char === '"' && text[index + 1] === '"') ||
        (char === '\\' && text[index + 1] === '"')) { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && !value) quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value);
      if (row.some((cell) => cell.trim())) result.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('This CSV has an unfinished quoted field.');
  row.push(value);
  if (row.some((cell) => cell.trim())) result.push(row);
  return result;
}

export function parseRatingsCsv(text, minimum = '5') {
  if (!['4', '4.5', '5'].includes(minimum)) throw new Error('Choose a valid rating.');
  const [head, ...body] = rows(text.replace(/^\uFEFF/, ''));
  const columns = head?.map((column) => column.trim().toLowerCase()) || [];
  const field = (...names) => names.map((name) => columns.indexOf(name)).find((index) => index >= 0) ?? -1;
  const titleColumn = field('name', 'title');
  const urlColumn = field('letterboxd uri', 'letterboxduri', 'url');
  if (titleColumn < 0 || field('rating') < 0 || urlColumn < 0)
    throw new Error('Choose ratings.csv from your Letterboxd export.');
  const unique = new Map();
  for (const row of body) {
    const rating = Number(row[field('rating')]);
    const title = row[titleColumn]?.trim();
    const rawUrl = row[urlColumn]?.trim();
    const year = Number(row[field('year')]);
    if (!title || !Number.isFinite(rating) || rating < Number(minimum) || rating > 5) continue;
    let url;
    try { url = new URL(rawUrl); } catch { continue; }
    if (url.protocol !== 'https:' || !(
      (url.hostname === 'letterboxd.com' && /^\/film\/[^/?#]+\/$/.test(url.pathname)) ||
      (url.hostname === 'boxd.it' && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname))
    )) continue;
    unique.set(url.href, { title, year: Number.isInteger(year) && year > 1870 ? year : null,
      url: url.href, runtime: null, poster: null });
  }
  return [...unique.values()];
}
