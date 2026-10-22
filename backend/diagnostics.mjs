// Startup self-checks reported on /health so a misconfigured key can be diagnosed without logs.
// Only HTTP status codes and short error messages are recorded, never keys.
async function status(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    return response.status;
  } catch (error) {
    return `${error.message}${error.cause ? `: ${error.cause.code || error.cause.message}` : ''}`;
  }
}

export function runChecks({ tmdbKey, deepseekKey }) {
  const checks = { tmdbKey: Boolean(tmdbKey), deepseekKey: Boolean(deepseekKey) };
  (async () => {
    if (tmdbKey) checks.tmdb = await status(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(tmdbKey)}`);
    if (deepseekKey) checks.deepseek = await status('https://api.deepseek.com/models',
      { headers: { Authorization: `Bearer ${deepseekKey}` } });
  })().catch((error) => { checks.error = error.message; });
  return checks;
}
