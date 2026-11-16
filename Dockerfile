FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=3100
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public
COPY config ./config
RUN mkdir -p cache/logos && chown -R node:node cache

USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1

CMD ["node", "server/index.js"]
