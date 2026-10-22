FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/ ./backend/
COPY movie-pool.json ./movie-pool.json

ENV NODE_ENV=production \
    CHROME_PATH=/usr/bin/chromium
USER node
CMD ["node", "backend/server.mjs"]
