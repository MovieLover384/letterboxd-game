import { randomInt } from 'node:crypto';

const letterboxd = 'https://letterboxd.com';
const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,39}$/;
const cacheLife = 15 * 60 * 1000;
const detailCacheLife = 24 * 60 * 60 * 1000;
const maximumPages = 1000;

export class WatchlistError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function validUsername(value) {
  return typeof value === 'string' && usernamePattern.test(value.trim());
}

function decodeEntities(value) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|quot|apos|lt|gt|nbsp|#39);/gi, (match, entity) => {
    const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'" };
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const code = entity[1].toLowerCase() === 'x'
      ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code) : match;
  });
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`));
  return match ? decodeEntities(match[1] ?? match[2]) : null;
}

export function parseFilmListPage(html, listPath) {
  const movies = [];
  for (const match of html.matchAll(/<div\b[^>]*\bdata-component-class="LazyPoster"[^>]*>/g)) {
    const tag = match[0];
    const name = attribute(tag, 'data-item-name');
    const link = attribute(tag, 'data-item-link');
    if (!name || !link || !/^\/film\/[^/?#]+\/$/.test(link)) continue;
    const yearMatch = name.match(/\s+\((\d{4})\)$/);
    movies.push({
      title: yearMatch ? name.slice(0, yearMatch.index) : name,
      year: yearMatch ? Number(yearMatch[1]) : null,
      url: `${letterboxd}${link}`,
    });
  }
  const pageNumbers = [...html.matchAll(/href="([^"]+)"/g)]
    .filter((match) => match[1].toLowerCase().startsWith(listPath))
    .map((match) => match[1].match(/\/page\/(\d+)\/$/))
    .filter(Boolean).map((match) => Number(match[1]));
  const nextMatch = html.match(/<a\b[^>]*class="next"[^>]*href="([^"]+)"/);
  const next = nextMatch?.[1]?.toLowerCase().startsWith(listPath)
    ? Number(nextMatch[1].match(/\/page\/(\d+)\/$/)?.[1]) || null : null;
  return { movies, lastPage: Math.max(1, ...pageNumbers), next };
}

export function parseWatchlistPage(html, username) {
  return parseFilmListPage(html, `/${username.toLowerCase()}/watchlist/`);
}

export function parseFilmDetails(html) {
  const footer = html.match(/<p\b[^>]*class="[^"]*text-footer[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
  const runtimeMatch = footer.match(/\b(\d{1,4})(?:\s|&nbsp;|&#160;)*mins\b/i);
  const body = html.match(/<body\b[^>]*>/)?.[0] || '';
  const tmdbType = attribute(body, 'data-tmdb-type');
  const tmdbId = Number(attribute(body, 'data-tmdb-id')) || null;
  const ogTag = html.match(/<meta\b[^>]*property="og:image"[^>]*>/)?.[0] || '';
  const ogImage = attribute(ogTag, 'content');
  let image = null;
  try {
    const url = new URL(ogImage);
    if (url.protocol === 'https:' && (url.hostname === 'ltrbxd.com' || url.hostname.endsWith('.ltrbxd.com')))
      image = url.href;
  } catch { /* No usable image. */ }
  return { runtime: runtimeMatch ? Number(runtimeMatch[1]) : null, tmdbType, tmdbId, image };
}

export function runtimeMatches(runtime, range) {
  if (range === 'any') return true;
  if (!Number.isInteger(runtime) || runtime <= 0) return false;
  if (range === 'under-90') return runtime < 90;
  if (range === '90-119') return runtime >= 90 && runtime < 120;
  if (range === '120-plus') return runtime >= 120;
  return false;
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createWatchlistService({ fetchImpl = fetch, posterForTmdb = async () => null } = {}) {
  const watchlists = new Map();
  const details = new Map();
  const pendingWatchlists = new Map();
  const pendingDetails = new Map();

  async function fetchHtml(url) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovieKnowledge/1.0)', Accept: 'text/html' },
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new WatchlistError(503, 'Could not reach Letterboxd right now. Please try again.');
    }
    if (response.status === 404) throw new WatchlistError(404, 'That public Letterboxd profile could not be found. Check the username.');
    if (response.status === 403 || response.status === 429)
      throw new WatchlistError(503, 'Letterboxd is blocking automatic lookups of this page right now.');
    if (!response.ok) throw new WatchlistError(503, 'Letterboxd is unavailable right now. Please try again later.');
    const finalUrl = new URL(response.url || url);
    if (finalUrl.hostname !== 'letterboxd.com') throw new WatchlistError(503, 'Letterboxd returned an unexpected page.');
    const html = await response.text();
    if (html.length > 2_000_000) throw new WatchlistError(503, 'This Letterboxd page was too large to read.');
    return html;
  }

  // Loads every page of one Letterboxd film list. `pagePath` is where page 1 lives and `listPath`
  // is the prefix every pagination link on it shares.
  async function loadFilmList(key, pagePath, listPath, emptyMessage) {
    const cached = watchlists.get(key);
    if (cached && Date.now() - cached.time < cacheLife) return cached.movies;
    if (pendingWatchlists.has(key)) return pendingWatchlists.get(key);
    const parse = (html) => parseFilmListPage(html, listPath);
    const pending = (async () => {
      const first = parse(await fetchHtml(`${letterboxd}${pagePath}`));
      const pages = new Map([[1, first]]);
      let lastPage = Math.max(first.lastPage, first.next || 1);
      if (lastPage > maximumPages) throw new WatchlistError(422, 'This list is too large to load right now.');
      for (let start = 2; start <= lastPage; start += 4) {
        const numbers = Array.from({ length: Math.min(4, lastPage - start + 1) }, (_, i) => start + i);
        const loaded = await Promise.all(numbers.map(async (number) =>
          [number, parse(await fetchHtml(`${letterboxd}${pagePath}page/${number}/`))]));
        for (const [number, page] of loaded) {
          pages.set(number, page);
          lastPage = Math.max(lastPage, page.lastPage, page.next || 1);
        }
        if (lastPage > maximumPages) throw new WatchlistError(422, 'This list is too large to load right now.');
      }
      const unique = new Map();
      for (const page of [...pages.keys()].sort((a, b) => a - b)) {
        for (const movie of pages.get(page).movies) unique.set(movie.url, movie);
      }
      const movies = [...unique.values()];
      if (!movies.length && emptyMessage) throw new WatchlistError(404, emptyMessage);
      if (watchlists.size > 300) watchlists.delete(watchlists.keys().next().value);
      watchlists.set(key, { time: Date.now(), movies });
      return movies;
    })();
    pendingWatchlists.set(key, pending);
    try { return await pending; }
    finally { pendingWatchlists.delete(key); }
  }

  async function loadWatchlist(username) {
    if (!validUsername(username)) throw new WatchlistError(400, 'Enter a valid Letterboxd username.');
    const handle = username.trim().toLowerCase();
    const path = `/${encodeURIComponent(handle)}/watchlist/`;
    return loadFilmList(handle, path, `/${handle}/watchlist/`,
      'This watchlist is empty or private. Only public watchlists can be used.');
  }

  async function filmDetails(movie) {
    const cached = details.get(movie.url);
    if (cached && Date.now() - cached.time < detailCacheLife) return cached.value;
    if (pendingDetails.has(movie.url)) return pendingDetails.get(movie.url);
    const pending = (async () => {
      const parsed = parseFilmDetails(await fetchHtml(movie.url));
      let poster = parsed.image;
      if (parsed.tmdbType === 'movie' && parsed.tmdbId) {
        try {
          const path = await posterForTmdb(parsed.tmdbId);
          if (typeof path === 'string' && /^\/[a-zA-Z0-9/_-]+\.jpg$/.test(path))
            poster = `https://image.tmdb.org/t/p/w500${path}`;
        } catch { /* The Letterboxd artwork remains usable. */ }
      }
      const value = { runtime: parsed.runtime, poster };
      if (details.size > 3000) details.delete(details.keys().next().value);
      details.set(movie.url, { time: Date.now(), value });
      return value;
    })();
    pendingDetails.set(movie.url, pending);
    try { return await pending; }
    finally { pendingDetails.delete(movie.url); }
  }

  async function spin(username, range = 'any') {
    if (!['any', 'under-90', '90-119', '120-plus'].includes(range))
      throw new WatchlistError(400, 'Choose a valid runtime option.');
    const movies = await loadWatchlist(username);
    const candidates = shuffled(movies);
    for (const movie of candidates) {
      let detail;
      try { detail = await filmDetails(movie); }
      catch (error) {
        if (range === 'any') return { movie: { ...movie, runtime: null, poster: null }, count: movies.length };
        throw error;
      }
      if (runtimeMatches(detail.runtime, range))
        return { movie: { ...movie, ...detail }, count: movies.length };
    }
    throw new WatchlistError(404, 'No films with a known runtime match that range. Try another length.');
  }

  return { loadWatchlist, spin };
}
