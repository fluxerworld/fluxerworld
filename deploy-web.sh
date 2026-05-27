#!/bin/bash
# Deploy Fluxer web client
# Usage:  ./deploy-web.sh
# Optional: DESKTOP_VERSION=1.0.78 ./deploy-web.sh
#
# IMPORTANT: do not hand-edit /opt/fluxer/webroot/version.json.
# This script is the only correct way to update the deployed web
# client because version.json.sha MUST equal the git HEAD of the
# build that produced the deployed bundle. Hand-bumping version.json
# without rebuilding is what causes phantom PWA update notifications.

set -e

cd /opt/fluxer

echo "Building web client..."
cd fluxer_app
FLUXER_CONFIG=/opt/fluxer/config/config.json pnpm build
cd ..

echo "Deploying assets..."
rsync -av fluxer_app/dist/assets/ webroot/assets/ > /dev/null

echo "Deploying app.html..."
cp fluxer_app/dist/index.html webroot/app.html
# Fluxer → Fluxerworld branding rewrite (rspack HtmlPlugin template still
# emits "Fluxer"; manifest names + start_url are fixed at source).
sed -i 's/<title>Fluxer/<title>Fluxerworld/' webroot/app.html

echo "Deploying service worker..."
cp fluxer_app/dist/sw.js webroot/sw.js
cp fluxer_app/dist/sw.js.map webroot/sw.js.map 2>/dev/null || true

echo "Deploying manifest..."
cp fluxer_app/dist/manifest.json webroot/manifest.json

echo "Updating version.json..."
SHA=$(git rev-parse --short HEAD)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Desktop version controls the Electron native-update-hint fallback path
# (UpdaterStore compareSemver). Bump DESKTOP_VERSION (or set the env var)
# when cutting a new desktop release so Electron users see the prompt.
DESKTOP_VERSION="${DESKTOP_VERSION:-1.0.76}"
echo "{\"sha\": \"${SHA}\", \"buildTimestamp\": \"${TIMESTAMP}\", \"version\": \"${DESKTOP_VERSION}\"}" > webroot/version.json

echo "Restarting Caddy..."
sudo docker restart fluxer-caddy-1 > /dev/null

echo ""
echo "Deployed! Build: ${SHA} at ${TIMESTAMP} (desktop version: ${DESKTOP_VERSION})"
