ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL=nightly

FROM node:24-bookworm-slim AS base

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/ ./packages/
COPY fluxer_marketing/package.json ./fluxer_marketing/

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfigs /usr/src/app/tsconfigs
COPY fluxer_marketing/tsconfig.json ./fluxer_marketing/
COPY fluxer_marketing/src ./fluxer_marketing/src
WORKDIR /usr/src/app
RUN pnpm --filter @fluxer/config generate
RUN pnpm --filter @fluxer/marketing build:css \
	&& mkdir -p fluxer_marketing/public/static \
	&& cp -r packages/marketing/public/static/. fluxer_marketing/public/static/

FROM base AS prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ ./patches/
COPY packages/ ./packages/
COPY fluxer_marketing/package.json ./fluxer_marketing/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /usr/src/app/packages/marketing/public /usr/src/app/packages/marketing/public

FROM node:24-bookworm-slim

ARG BUILD_SHA
ARG BUILD_NUMBER
ARG BUILD_TIMESTAMP
ARG RELEASE_CHANNEL

WORKDIR /usr/src/app/fluxer_marketing

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl && \
	rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

COPY --from=prod-deps /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=prod-deps /usr/src/app/fluxer_marketing/node_modules ./node_modules
COPY --from=prod-deps /usr/src/app/packages /usr/src/app/packages
COPY --from=build /usr/src/app/packages/config/src/ConfigSchema.json /usr/src/app/packages/config/src/ConfigSchema.json
COPY --from=build /usr/src/app/packages/config/src/MasterZodSchema.generated.tsx /usr/src/app/packages/config/src/MasterZodSchema.generated.tsx
COPY tsconfigs /usr/src/app/tsconfigs
COPY --from=build /usr/src/app/fluxer_marketing/tsconfig.json ./tsconfig.json
COPY --from=build /usr/src/app/fluxer_marketing/src ./src
COPY --from=build /usr/src/app/fluxer_marketing/public ./public
COPY fluxer_marketing/package.json ./

RUN mkdir -p /usr/src/app/.cache/corepack && \
	chown -R nobody:nogroup /usr/src/app

ENV HOME=/usr/src/app
ENV COREPACK_HOME=/usr/src/app/.cache/corepack
ENV NODE_ENV=production
ENV FLUXER_MARKETING_PORT=8080
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_NUMBER=${BUILD_NUMBER}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV RELEASE_CHANNEL=${RELEASE_CHANNEL}

USER nobody

EXPOSE 8080

CMD ["pnpm", "start"]
