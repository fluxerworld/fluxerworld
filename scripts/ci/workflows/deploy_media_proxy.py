#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from deploy_workflow import build_standard_deploy_steps, run_deploy_workflow


PUSH_AND_DEPLOY_SCRIPT = """
set -euo pipefail

docker pussh "${IMAGE_TAG}" "${SERVER}"

ssh "${SERVER}" "IMAGE_TAG=${IMAGE_TAG} SERVICE_NAME=${SERVICE_NAME} COMPOSE_STACK=${COMPOSE_STACK} RELEASE_CHANNEL=${RELEASE_CHANNEL} bash" << 'REMOTE_EOF'
set -euo pipefail

if [[ "${RELEASE_CHANNEL}" == "canary" ]]; then
  CONFIG_PATH="/etc/fluxer/config.canary.json"
else
  CONFIG_PATH="/etc/fluxer/config.stable.json"
fi
sudo mkdir -p "/opt/${SERVICE_NAME}"
sudo chown -R "${USER}:${USER}" "/opt/${SERVICE_NAME}"
cd "/opt/${SERVICE_NAME}"

cat > compose.yaml << COMPOSEEOF
services:
  app:
    image: ${IMAGE_TAG}
    command: ['pnpm', 'start']
    environment:
      - FLUXER_CONFIG=/etc/fluxer/config.json
    volumes:
      - ${CONFIG_PATH}:/etc/fluxer/config.json:ro
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
      labels:
        - 'caddy=http://fluxerusercontent.com'
        - 'caddy.reverse_proxy={{upstreams 8080}}'
        - 'caddy.header.X-Robots-Tag="noindex, nofollow, nosnippet, noimageindex"'
        - 'caddy.header.Strict-Transport-Security="max-age=31536000; includeSubDomains; preload"'
        - 'caddy.header.X-Xss-Protection="1; mode=block"'
        - 'caddy.header.X-Content-Type-Options=nosniff'
        - 'caddy.header.Referrer-Policy=strict-origin-when-cross-origin'
        - 'caddy.header.X-Frame-Options=DENY'
        - 'caddy.header.Expect-Ct="max-age=86400, report-uri=\"https://o4510149383094272.ingest.us.sentry.io/api/4510205811556352/security/?sentry_key=2670068cd12b6a62f3a30a7f0055f0f1\""'
    networks:
      - fluxer-shared
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/_health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  fluxer-shared:
    external: true
COMPOSEEOF

docker stack deploy --with-registry-auth --detach=false --resolve-image never -c compose.yaml "${COMPOSE_STACK}"
REMOTE_EOF
"""

STEPS = build_standard_deploy_steps(
    push_and_deploy_script=PUSH_AND_DEPLOY_SCRIPT,
)


def main() -> int:
    return run_deploy_workflow(STEPS)


if __name__ == "__main__":
    raise SystemExit(main())
