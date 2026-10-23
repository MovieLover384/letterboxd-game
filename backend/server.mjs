import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWatchlistService, WatchlistError } from './watchlist.mjs';
import { createVerifier } from './answer-verifier.mjs';
import { runChecks } from './diagnostics.mjs';
import { dailyQuestions, utcDay } from '../daily-core.mjs';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(site, 'backend', '.data');
await fs.mkdir(dataDir, { recursive: true });
const learnedFile = path.join(dataDir, 'learned-answers.json');
try { await fs.access(learnedFile); }
catch { await fs.copyFile(path.join(site, 'backend', 'seed-learned-answers.json'), learnedFile); }
const catalog = JSON.parse(await fs.readFile(path.join(site, 'daily-catalog.json'), 'utf8'));
const moviePool = JSON.parse(await fs.readFile(path.join(site, 'movie-pool.json'), 'utf8'));
const postersById = new Map(moviePool
  .filter((movie) => Number.isInteger(movie.id) && movie.poster?.startsWith('/'))
  .map((movie) => [movie.id, movie.poster]));
const posterTitles = new Map();
for (const movie of moviePool) {
  if (!movie.poster?.startsWith('/') || !movie.title || !Number.isInteger(movie.year)) continue;
  const key = movie.title.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!posterTitles.has(key)) posterTitles.set(key, []);
  posterTitles.get(key).push(movie);
}
function poolPoster(movie) {
  const key = movie.title.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const matches = (posterTitles.get(key) || []).filter((item) => item.year === movie.year);
  const nearby = matches.length ? matches : (posterTitles.get(key) || [])
    .filter((item) => Number.isInteger(movie.year) && Math.abs(item.year - movie.year) <= 1);
  return nearby.length === 1 ? `https://image.tmdb.org/t/p/w342${nearby[0].poster}` : null;
}

const watchlists = createWatchlistService({ posterForTmdb: async (id) => postersById.get(id) || null });
const verifier = await createVerifier({ catalog, dataFile: learnedFile,
  tmdbKey: process.env.TMDB_API_KEY,
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  moviePosters: postersById });
const recentFailures = [];
const checks = runChecks({ tmdbKey: process.env.TMDB_API_KEY, deepseekKey: process.env.DEEPSEEK_API_KEY });
const pinnedFile = path.join(dataDir, 'daily-pinned.json');
let pinned = {};
try { pinned = JSON.parse(await fs.readFile(pinnedFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let pinning = Promise.resolve();
async function pinnedDaily(date) {
  if (!pinned[date]) {
    pinned[date] = dailyQuestions(catalog, date).map((question) => question.id);
    pinning = pinning.catch(() => {}).then(() => fs.writeFile(pinnedFile, JSON.stringify(pinned) + '\n'));
    await pinning;
  }
  return pinned[date];
}
const recent = new Map();
const allowedOrigins = new Set([
  'https://movieknowledge.xyz',
  'https://www.movieknowledge.xyz',
  'https://movielover384.github.io',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
]);

function headers(request) {
  const origin = request.headers.origin;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  };
}
function json(request, response, status, value) {
  response.writeHead(status, headers(request));
  response.end(JSON.stringify(value));
}
// Requests allowed per address in ten minutes. Each endpoint counts separately, so poster lookups
// during a long round cannot use up the answer checks.
const limits = { image: 600, verify: 240, watchlist: 30, other: 400 };
// Cloudflare sits in front of the host and sets the visitor's real address, which a visitor cannot
// override. Without it every player can share the proxy's address, and one busy minute then locks
// out everybody, so fall back to the first forwarded address only when it is missing.
function clientAddress(request) {
  const header = (name) => String(request.headers[name] || '').split(',')[0].trim();
  return header('cf-connecting-ip') || header('true-client-ip') || header('x-forwarded-for') ||
    request.socket.remoteAddress || 'unknown';
}
function permit(request, pathname) {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return false;
  const bucket = pathname === '/api/image' ? 'image' : pathname === '/api/verify' ? 'verify' :
    pathname.startsWith('/api/watchlist') ? 'watchlist' : 'other';
  const address = clientAddress(request);
  const key = `${bucket}:${address}`;
  const now = Date.now();
  const times = (recent.get(key) || []).filter((time) => now - time < 600_000);
  if (times.length >= limits[bucket]) return false;
  times.push(now);
  recent.set(key, times);
  if (recent.size > 2000) recent.delete(recent.keys().next().value);
  return true;
}
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new SyntaxError('Expected JSON');
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024) throw new SyntaxError('Request too large');
  }
  return JSON.parse(body);
}

const server = http.createServer(async (request, response) => {
  // Older copies of the site called /letterboxd-game/api/..., so both prefixes work.
  const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/letterboxd-game(?=\/)/, '');
  if (pathname === '/health') {
    json(request, response, 200, { status: 'ok', checks, recentFailures, you: clientAddress(request) });
    return;
  }
  if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
    if (!request.headers.origin || !allowedOrigins.has(request.headers.origin)) {
      response.writeHead(403).end();
      return;
    }
    response.writeHead(204, {
      ...headers(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
    }).end();
    return;
  }
  if (!permit(request, pathname)) {
    json(request, response, 429, { error: 'Too many requests. Try again later.' });
    return;
  }
  try {
    if (pathname === '/api/watchlist' && request.method === 'GET') {
      const username = new URL(request.url, 'http://localhost').searchParams.get('username') || '';
      const movies = await watchlists.loadWatchlist(username);
      json(request, response, 200, { username: username.trim(), count: movies.length,
        movies: movies.map((movie) => ({ ...movie, poster: poolPoster(movie) })) });
    } else if (pathname === '/api/watchlist/spin' && request.method === 'POST') {
      const { username, runtime } = await readJson(request);
      json(request, response, 200, await watchlists.spin(username, runtime));
    } else if (pathname === '/api/daily' && request.method === 'GET') {
      const date = new URL(request.url, 'http://localhost').searchParams.get('date') || '';
      if (date !== utcDay() && !pinned[date]) json(request, response, 404, { status: 'unavailable' });
      else json(request, response, 200, { date, ids: await pinnedDaily(date) });
    } else if (pathname === '/api/learned' && request.method === 'GET') {
      json(request, response, 200, { answers: verifier.getLearned() });
    } else if (pathname === '/api/image' && request.method === 'GET') {
      const params = new URL(request.url, 'http://localhost').searchParams;
      let poster = null;
      try { poster = await verifier.image(params.get('kind'), Number(params.get('id'))); }
      catch (error) { console.error('Image lookup failed:', error.message); }
      json(request, response, 200, { path: poster });
    } else if (pathname === '/api/verify' && request.method === 'POST') {
      const { questionId, answer } = await readJson(request);
      let result;
      try { result = await verifier.verify(questionId, answer); }
      catch (error) {
        recentFailures.push({ time: new Date().toISOString(), questionId,
          error: String(error.message).replace(/api_key=[^&\s]+/g, 'api_key=***') });
        if (recentFailures.length > 10) recentFailures.shift();
        throw error;
      }
      json(request, response, result.status === 'invalid' ? 400 : 200, result);
    } else {
      json(request, response, 404, { error: 'Endpoint not found.' });
    }
  } catch (error) {
    if (!(error instanceof WatchlistError) && !(error instanceof SyntaxError))
      console.error('Letterboxd API failed:', error);
    const status = error instanceof WatchlistError ? error.status : error instanceof SyntaxError ? 400 : 503;
    json(request, response, status, { error: error instanceof WatchlistError ? error.message :
      'Could not load those films right now. Please try again.' });
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit());
server.listen(Number(process.env.PORT) || 8788, '0.0.0.0', () =>
  console.log(`Letterboxd API listening on ${server.address().port}`));
