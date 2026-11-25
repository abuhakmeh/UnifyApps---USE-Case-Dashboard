# Playwright image = Node + Chromium, so the Scout agent can render prototypes and take screenshots.
FROM mcr.microsoft.com/playwright:v1.49.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install --no-save playwright@1.49.1
COPY . .
RUN npm run build && npm prune --omit=dev && npm install --no-save playwright@1.49.1
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["node", "server/index.js"]
