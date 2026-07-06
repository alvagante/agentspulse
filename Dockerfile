FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/web/package*.json ./packages/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages ./packages
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git sqlite3 \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV AGENTS_PULSE_HOST=0.0.0.0
ENV AGENTS_PULSE_PORT=4040

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/packages/server/package*.json ./packages/server/
COPY --from=build /app/packages/web/package*.json ./packages/web/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/web/dist ./packages/web/dist

EXPOSE 4040

CMD ["npm", "run", "start"]
