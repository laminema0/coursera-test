# Small production image: Node 22 on Alpine, runs TypeScript directly (type stripping), SQLite built into Node.
#   docker build -t news-verify backend/
#   docker run -d -p 127.0.0.1:8787:8787 -v news-data:/data news-verify
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    SOURCES_FILE=sources/en.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY sources ./sources
# The official image ships a non-root "node" user (uid 1000); it only needs to write /data.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
# SIGTERM → finish the running cycle, save, close the database (allow ~60 s: docker stop -t 60).
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
