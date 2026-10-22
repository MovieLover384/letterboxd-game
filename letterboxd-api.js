// The public site (GitHub Pages) needs a separate server for live game requests.
// Set this to the deployed backend origin; localhost keeps using the local Node server.
const LETTERBOXD_API_ORIGIN = 'https://movieknowledge-letterboxd-api.onrender.com';
const PUBLIC_HOSTS = ['movieknowledge.xyz', 'www.movieknowledge.xyz', 'movielover384.github.io'];

export function apiUrl(path) {
  const publicPages = PUBLIC_HOSTS.includes(window.location.hostname);
  if (publicPages && !LETTERBOXD_API_ORIGIN)
    throw new Error('The movie service is temporarily unavailable. Please try again later.');
  const origin = publicPages ? LETTERBOXD_API_ORIGIN : window.location.origin;
  return new URL(`/${path}`, origin);
}

export async function apiRequest(path, options) {
  const url = apiUrl(path);
  const { timeoutMs = 15000, ...requestOptions } = options || {};
  let response;
  try {
    response = await fetch(url, { ...requestOptions, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error('Could not reach the movie service. Please try again in a moment.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load those films right now. Please try again.');
  return data;
}
