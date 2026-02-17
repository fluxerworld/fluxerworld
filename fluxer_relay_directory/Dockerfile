FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

FROM base AS deps

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY patches/ ./patches/
COPY fluxer_relay_directory/package.json ./fluxer_relay_directory/
COPY packages/hono/package.json ./packages/hono/
COPY packages/schema/package.json ./packages/schema/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod --filter fluxer-relay-directory...

FROM node:24-bookworm-slim

WORKDIR /app

# Install runtime utilities (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
	curl && \
	rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/fluxer_relay_directory/node_modules ./fluxer_relay_directory/node_modules
COPY --from=deps /app/packages ./packages

# Copy relay directory source
COPY fluxer_relay_directory/package.json fluxer_relay_directory/tsconfig.json ./fluxer_relay_directory/
COPY fluxer_relay_directory/src ./fluxer_relay_directory/src
COPY fluxer_relay_directory/config ./fluxer_relay_directory/config

# Create data directory for SQLite database
RUN mkdir -p /app/fluxer_relay_directory/data && \
	mkdir -p /app/.cache/corepack && \
	chown -R nobody:nogroup /app

WORKDIR /app/fluxer_relay_directory

ENV HOME=/app
ENV COREPACK_HOME=/app/.cache/corepack
ENV NODE_ENV=production

USER nobody

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8080/_health || exit 1

CMD ["pnpm", "start"]
