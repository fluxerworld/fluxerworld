ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL=nightly

FROM node:24-trixie-slim AS base

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	python3 \
	make \
	g++ \
	&& rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY patches/ ./patches/

COPY packages/admin/package.json ./packages/admin/
COPY packages/api/package.json ./packages/api/
COPY packages/app/package.json ./packages/app/
COPY packages/cache/package.json ./packages/cache/
COPY packages/captcha/package.json ./packages/captcha/
COPY packages/cassandra/package.json ./packages/cassandra/
COPY packages/config/package.json ./packages/config/
COPY packages/constants/package.json ./packages/constants/
COPY packages/email/package.json ./packages/email/
COPY packages/errors/package.json ./packages/errors/
COPY packages/hono/package.json ./packages/hono/
COPY packages/hono_types/package.json ./packages/hono_types/
COPY packages/initialization/package.json ./packages/initialization/
COPY packages/ip_utils/package.json ./packages/ip_utils/
COPY packages/logger/package.json ./packages/logger/
COPY packages/marketing/package.json ./packages/marketing/
COPY packages/media_proxy/package.json ./packages/media_proxy/
COPY packages/oauth2/package.json ./packages/oauth2/
COPY packages/queue/package.json ./packages/queue/
COPY packages/rate_limit/package.json ./packages/rate_limit/
COPY packages/s3/package.json ./packages/s3/
COPY packages/sentry/package.json ./packages/sentry/
COPY packages/sms/package.json ./packages/sms/
COPY packages/snowflake/package.json ./packages/snowflake/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/ui/package.json ./packages/ui/
COPY packages/validation/package.json ./packages/validation/
COPY packages/virus_scan/package.json ./packages/virus_scan/
COPY packages/worker/package.json ./packages/worker/
COPY packages/http_client/package.json ./packages/http_client/
COPY packages/schema/package.json ./packages/schema/
COPY fluxer_server/package.json ./fluxer_server/
COPY fluxer_app/package.json ./fluxer_app/

RUN pnpm install --frozen-lockfile

RUN pnpm approve-builds msgpackr-extract@3.0.3 @parcel/watcher@2.5.6

RUN pnpm rebuild msgpackr-extract @parcel/watcher

FROM deps AS build

COPY tsconfigs /usr/src/app/tsconfigs

COPY packages/ ./packages/
RUN pnpm --filter @fluxer/config generate
COPY fluxer_server/ ./fluxer_server/

RUN pnpm --filter @fluxer/marketing build:css

COPY fluxer_media_proxy/data/model.onnx ./fluxer_media_proxy/data/model.onnx

RUN cd fluxer_server && pnpm typecheck

FROM erlang:28-slim AS gateway-build

ARG LOGGER_LEVEL=info

WORKDIR /usr/src/app/gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	ca-certificates \
	gettext-base \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/erlang/rebar3/releases/download/3.24.0/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

COPY fluxer_gateway/rebar.config fluxer_gateway/rebar.lock* ./
RUN rebar3 compile --deps_only

COPY fluxer_gateway/. ./fluxer_gateway
RUN LOGGER_LEVEL=${LOGGER_LEVEL} envsubst '${LOGGER_LEVEL}' < fluxer_gateway/config/vm.args.template > fluxer_gateway/config/vm.args && \
	LOGGER_LEVEL=${LOGGER_LEVEL} envsubst '${LOGGER_LEVEL}' < fluxer_gateway/config/sys.config.template > fluxer_gateway/config/sys.config && \
	(cd fluxer_gateway && rebar3 as prod release)

FROM deps AS app-build

COPY tsconfigs /usr/src/app/tsconfigs

COPY packages/ ./packages/
COPY fluxer_app/ ./fluxer_app/

RUN cd fluxer_app && pnpm build

FROM node:24-trixie-slim AS production

ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL

LABEL org.opencontainers.image.title="Fluxer Server"
LABEL org.opencontainers.image.description="Unified Fluxer server for self-hosting - combines all backend services into a single deployable container"
LABEL org.opencontainers.image.vendor="Fluxer Contributors"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.source="https://github.com/fluxerapp/fluxer"
LABEL org.opencontainers.image.documentation="https://docs.fluxer.app"
LABEL org.opencontainers.image.revision="${BUILD_SHA}"
LABEL org.opencontainers.image.version="${BUILD_NUMBER}"
LABEL org.opencontainers.image.created="${BUILD_TIMESTAMP}"

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	ffmpeg \
	&& rm -rf /var/lib/apt/lists/*


RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/packages ./packages
COPY --from=build /usr/src/app/fluxer_server ./fluxer_server
COPY --from=build /usr/src/app/tsconfigs ./tsconfigs
COPY --from=build /usr/src/app/pnpm-workspace.yaml ./
COPY --from=build /usr/src/app/package.json ./
COPY --from=gateway-build /usr/src/app/gateway/fluxer_gateway/_build/prod/rel/fluxer_gateway /opt/fluxer_gateway
COPY --from=app-build /usr/src/app/fluxer_app/dist /usr/src/app/assets

RUN mkdir -p /usr/src/app/data/storage && \
	mkdir -p /usr/src/app/data/db && \
	mkdir -p /opt/data && \
	mkdir -p /data/s3 && \
	mkdir -p /data/sqlite && \
	mkdir -p /data/queue && \
	mkdir -p /var/log/fluxer && \
	chown -R root:root /usr/src/app/data && \
	chown -R root:root /opt/data && \
	chown -R root:root /data

ARG INCLUDE_NSFW_ML=false

RUN --mount=type=bind,from=build,source=/usr/src/app/fluxer_media_proxy/data/model.onnx,target=/tmp/model.onnx \
    if [ "$INCLUDE_NSFW_ML" = "true" ]; then \
        echo "Including NSFW detection model..."; \
        cp /tmp/model.onnx /opt/data/model.onnx; \
    else \
        echo "Skipping NSFW detection model (INCLUDE_NSFW_ML=$INCLUDE_NSFW_ML)"; \
    fi



EXPOSE 8080


ENV NODE_ENV=production

ENV FLUXER_SERVER_HOST=0.0.0.0
ENV FLUXER_SERVER_PORT=8080
ENV FLUXER_GATEWAY_HOST=127.0.0.1
ENV FLUXER_GATEWAY_PORT=8082
ENV DATABASE_BACKEND=sqlite
ENV SQLITE_PATH=/usr/src/app/data/db/fluxer.db
ENV STORAGE_ROOT=/usr/src/app/data/storage
ENV SEARCH_BACKEND=sqlite
ENV FLUXER_SERVER_STATIC_DIR=/usr/src/app/assets

ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV RELEASE_CHANNEL=${RELEASE_CHANNEL}

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
	CMD curl -f http://localhost:8080/_health || exit 1

ENTRYPOINT ["pnpm", "start"]
