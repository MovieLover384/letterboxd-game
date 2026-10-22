# MovieKnowledge API

GitHub Pages serves the HTML and JavaScript in this repository. It cannot run the username lookups or live answer verification.

`render.yaml` defines a separate Node web service using `Dockerfile`. The image includes Chromium for Letterboxd rating pages. The service exposes `/letterboxd-game/api/watchlist`, `/letterboxd-game/api/watchlist/spin`, `/letterboxd-game/api/keepcut`, `/letterboxd-game/api/daily`, `/letterboxd-game/api/verify`, `/letterboxd-game/api/learned`, `/letterboxd-game/api/image`, and `/health`.

Set `TMDB_API_KEY` and `DEEPSEEK_API_KEY` as secret environment variables on the service. They are needed to verify answers outside the catalog; never add them to this repository. After deployment, set `LETTERBOXD_API_ORIGIN` in `letterboxd-api.js` to the service's HTTPS origin and publish that change to GitHub Pages. CORS is limited to the site's GitHub Pages origin and localhost development. If the site's domain changes, update the origin allowlist in `server.mjs`.

The included learned-answer file seeds the service. New answers are written to `DATA_DIR`. Render's free plan does not persist these writes across restarts, so durable learning requires a persistent store. The free plan also sleeps after idle time, so the first lookup can be slow. Letterboxd can reject automated lookups from hosting providers; verify a real public watchlist and a real rated list after deployment.
