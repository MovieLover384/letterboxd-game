FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/ ./backend/
COPY movie-pool.json ./movie-pool.json
COPY daily-catalog.json daily-core.mjs daily-rules.mjs ./
RUN mkdir -p /app/data && cp backend/seed-learned-answers.json /app/data/learned-answers.json \
    && chown -R node:node /app/data

ENV NODE_ENV=production \
    CHROME_PATH=/usr/bin/chromium \
    DATA_DIR=/app/data
USER node
CMD ["node", "backend/server.mjs"]
