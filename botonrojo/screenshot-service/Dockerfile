# Official Playwright image — ships Chromium + all its OS-level dependencies
# already installed and matched to the exact playwright npm version below.
# Alpine isn't viable here: Playwright's browser binaries need glibc.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
