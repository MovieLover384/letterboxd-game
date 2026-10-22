// Startup self-checks reported on /health so a misconfigured deploy can be diagnosed without logs.
// Only HTTP status codes and short error messages are recorded, never keys.
async function status(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    return response.status;
  } catch (error) {
    return `${error.message}${error.cause ? `: ${error.cause.code || error.cause.message}` : ''}`;
  }
}

export function runChecks({ tmdbKey, deepseekKey, browserFetch, letterboxdProbes = [] }) {
  const checks = { tmdbKey: Boolean(tmdbKey), deepseekKey: Boolean(deepseekKey) };
  (async () => {
    if (tmdbKey) checks.tmdb = await status(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(tmdbKey)}`);
    if (deepseekKey) checks.deepseek = await status('https://api.deepseek.com/models',
      { headers: { Authorization: `Bearer ${deepseekKey}` } });
    checks.letterboxd = {};
    for (const path of letterboxdProbes) {
      const url = `https://letterboxd.com${path}`;
      const plain = await status(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MovieKnowledge/1.0)' } });
      let browser;
      try { browser = (await browserFetch(url)).status; } catch (error) { browser = error.message; }
      checks.letterboxd[path] = { plain, browser };
    }
  })().catch((error) => { checks.error = error.message; });
  return checks;
}
