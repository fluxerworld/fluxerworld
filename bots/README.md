# Bot deployment manifest

This directory captures how the bot daemons listed at `fluxer.world/bots`
run on this host. It contains the per-bot Dockerfiles and a `compose.yml`
that brings up everything alongside their shared infra (MongoDB, MySQL,
NodeLink).

The bot **source repos** themselves are gitignored — they live at
`/opt/fluxer/{fluxy,functious,ratot,vinto,remix}/` as upstream clones with
small local patches. The Dockerfiles here reference those source trees as
their build contexts.

## Patches the bots need

Each bot's upstream code hardcodes `https://api.fluxer.app` as the API
base. The patches change that to `https://fluxer.world/api` so the bot
connects to this instance. Specifics per bot:

- **Fluxy** — `src/index.ts` Client constructor gets
  `rest: { api: process.env.FLUXER_API_BASE || 'https://fluxer.world/api' }`;
  `src/shardManager.ts` swaps the direct `fetch('https://api.fluxer.app/...')`
  for the env-driven URL.
- **Functious** — same one-liner on the `@erinjs/core` Client init in `index.js`.
- **Ratot** — `ratot.js` REST constructor gets the same `api:` override.
- **Vinto Music** — env-driven; set `API_BASE` and `GATEWAY_URL` in `.env`.
- **Remix** — `config.json` has a `"fluxer.js": { "rest": { "api": "..." } }` block.

## Per-bot .env contents

Each bot has a `.env` file in its source directory (gitignored). Required vars:

- `TOKEN` / `BOT_TOKEN` / `RATOT_CURRENT_TOKEN` (varies) — the bot_token
  from the OAuth application. See `bot-tokens-*.txt` in `~/` if you have
  one, otherwise reset via `POST /api/v1/oauth2/applications/<id>/bot/reset-token`.
- `MONGO_URI` or `MONGODB` or `MONGODB_URI` (varies) —
  `mongodb://fluxerbots:<password>@fluxer-mongo:27017/<dbname>?authSource=admin`
- `FLUXER_API_BASE=https://fluxer.world/api` (Fluxy/Functious/Ratot)
- `API_BASE=https://fluxer.world/api/v1` + `GATEWAY_URL=wss://fluxer.world/gateway` (Vinto)

## Bring up

```bash
export MONGO_ROOT_PASSWORD="..."   # whatever was set when mongo was first init'd
export MYSQL_ROOT_PASSWORD="..."   # same
docker compose -f /opt/fluxer/bots/compose.yml up -d
```

The `bot-net` Docker network must exist beforehand:
```bash
docker network create bot-net
docker network connect bot-net fluxer_server   # so the API can reach bots
```

## Remix-specific extra setup

Needs a MySQL `settings` table that has no migration runner:

```sql
CREATE TABLE settings (id VARCHAR(64) PRIMARY KEY, data JSON) ENGINE=InnoDB;
```

Other tables come up on demand. Also requires NodeLink — included in
compose.yml. NodeLink listens on port **3000** (image default), not 2333
like upstream docs say.

## Gotchas

See `~/.claude/projects/-home-claudeuser/memory/bot_directory_deployment.md`
for the deeper notes (BuildKit `.gitignore` quirk, LiveKit glibc requirement,
`docker restart` vs `rm+run` for picking up image changes, etc.).
