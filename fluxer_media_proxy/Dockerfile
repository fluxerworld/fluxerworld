ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL=nightly

FROM node:24-bookworm-slim AS base

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

FROM base AS generator

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/config/ ./packages/config/
COPY packages/constants/ ./packages/constants/

RUN pnpm install --frozen-lockfile --filter @fluxer/config...
RUN pnpm --filter @fluxer/config generate

FROM base AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential \
	gcc \
	g++ \
	make \
	python3 \
	pkg-config \
	libssl-dev \
	libvips-dev && \
	rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/ ./packages/
COPY fluxer_media_proxy/package.json ./fluxer_media_proxy/

RUN pnpm install --frozen-lockfile --prod

FROM node:24-bookworm-slim

ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL

WORKDIR /usr/src/app/fluxer_media_proxy

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	ffmpeg \
	libvips \
	libgomp1 \
	libatomic1 && \
	rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY --from=deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=deps /usr/src/app/fluxer_media_proxy/node_modules ./node_modules
COPY --from=deps /usr/src/app/packages /usr/src/app/packages
COPY --from=generator /usr/src/app/packages/config/src/ConfigSchema.json /usr/src/app/packages/config/src/ConfigSchema.json
COPY --from=generator /usr/src/app/packages/config/src/MasterZodSchema.generated.tsx /usr/src/app/packages/config/src/MasterZodSchema.generated.tsx
COPY tsconfigs /usr/src/app/tsconfigs
COPY fluxer_media_proxy/package.json ./
COPY fluxer_media_proxy/tsconfig.json ./
COPY fluxer_media_proxy/src ./src
COPY fluxer_media_proxy/data ./data

RUN mkdir -p /opt/data /usr/src/app/.cache/corepack && \
	cp data/model.onnx /opt/data/model.onnx && \
	chown -R nobody:nogroup /usr/src/app

ENV HOME=/usr/src/app
ENV COREPACK_HOME=/usr/src/app/.cache/corepack
ENV NODE_ENV=production
ENV PORT=8080
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV RELEASE_CHANNEL=${RELEASE_CHANNEL}

USER nobody

EXPOSE 8080

CMD ["pnpm", "start"]
