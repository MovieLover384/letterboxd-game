# Letterboxd username API

GitHub Pages serves the HTML and JavaScript in this repository. It cannot run the username lookup routes used by Keep 4, Cut 4 and Watchlist Picker.

`render.yaml` defines a separate Node web service using `Dockerfile`. The image includes Chromium for Letterboxd rating pages. The service exposes `/letterboxd-game/api/watchlist`, `/letterboxd-game/api/watchlist/spin`, `/letterboxd-game/api/keepcut`, and `/health`.

After deployment, set `LETTERBOXD_API_ORIGIN` in `letterboxd-api.js` to the service's HTTPS origin and publish that change to GitHub Pages. CORS is limited to the site's GitHub Pages origin and localhost development. If the site's domain changes, update the origin allowlist in `server.mjs`.

The free Render plan sleeps after idle time, so the first lookup can be slow. Letterboxd can also reject automated lookups from hosting providers; verify both a real public watchlist and a real rated list after deployment.
