FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 && rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-workspace --prod --ignore-scripts
COPY dist ./dist
CMD ["node", "dist/src/index.js"]
