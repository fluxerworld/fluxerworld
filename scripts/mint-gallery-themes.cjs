// Re-mint the theme CSS files in S3 from webroot/themes.json.
// IDs are deterministic (sha256('gallery:<slug>'), first 16 hex)
// so re-running this overwrites the same theme_id rather than
// orphaning the old one. Safe to run any time themes.json changes.
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
  const id = createHash('sha256').update(`gallery:${theme.slug}`).digest('hex').slice(0, 16);
  writeFileSync(join(S3_DIR, `${id}.css`), theme.css, 'utf-8');
  theme.theme_id = id;
  console.log(`${theme.slug.padEnd(20)} -> ${id} (${theme.css.length} bytes)`);
}

writeFileSync(DST, JSON.stringify(data, null, 2) + '\n');
