// Re-mint the theme CSS files in S3 from webroot/themes.json.
// IDs are content-addressed (sha256 of the CSS body, first 16 hex)
// so any edit to the CSS produces a fresh id and URL — the
// /media/themes/<id>.css responses are served with
// cache-control: immutable max-age=1y, so reusing the same id when
// the body changes would permanently freeze users on the old CSS
// until the file actually rotated. Editing the gallery without
// rotating the id was the bug behind the "Add Friend button is a
// blank purple block" report on 2026-05-24.
//
// Old files at the old ids stay in S3 — they're tiny (~1KB each)
// and any users who applied the theme before a re-mint still have
// the previous id stored against their account, so the URL must
// keep resolving. Re-applying from the gallery routes them through
// the new id and they pick up fresh CSS.
//
// Usage (from host):
//   sudo docker cp /opt/fluxer/webroot/themes.json fluxer_server:/tmp/themes.json
//   sudo docker cp /opt/fluxer/scripts/mint-gallery-themes.cjs fluxer_server:/tmp/mint.cjs
//   sudo docker exec fluxer_server node /tmp/mint.cjs
//   sudo docker cp fluxer_server:/tmp/themes.out.json /opt/fluxer/webroot/themes.json
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');

const SRC = process.env.THEMES_JSON || '/tmp/themes.json';
const DST = process.env.THEMES_OUT  || '/tmp/themes.out.json';
const S3_DIR = process.env.S3_THEMES_DIR || '/usr/src/app/data/s3/fluxer/themes';

mkdirSync(S3_DIR, { recursive: true });
const data = JSON.parse(readFileSync(SRC, 'utf-8'));

for (const theme of data.themes) {
  const id = createHash('sha256').update(theme.css).digest('hex').slice(0, 16);
  writeFileSync(join(S3_DIR, `${id}.css`), theme.css, 'utf-8');
  theme.theme_id = id;
  console.log(`${theme.slug.padEnd(20)} -> ${id} (${theme.css.length} bytes)`);
}

writeFileSync(DST, JSON.stringify(data, null, 2) + '\n');
