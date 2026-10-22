// The public GitHub Pages site needs a separate server for Letterboxd lookups.
// Set this to the deployed backend origin; localhost keeps using the local Node server.
const LETTERBOXD_API_ORIGIN = '';

window.letterboxdApi = async function letterboxdApi(path, options) {
  const publicPages = window.location.hostname === 'movielover384.github.io';
  if (publicPages && !LETTERBOXD_API_ORIGIN)
    throw new Error('Letterboxd lookups are temporarily unavailable. Please try again later.');
  const origin = publicPages ? LETTERBOXD_API_ORIGIN : window.location.origin;
  const url = new URL(`/letterboxd-game/${path}`, origin);
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(90_000) });
  } catch {
    throw new Error('Could not reach the movie service. Please try again in a moment.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load those films right now. Please try again.');
  return data;
};
