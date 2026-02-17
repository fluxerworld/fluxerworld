#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from deploy_workflow import build_standard_deploy_steps, run_deploy_workflow


PUSH_AND_DEPLOY_SCRIPT = """
set -euo pipefail
docker pussh "${IMAGE_TAG}" "${SERVER}"

ssh "${SERVER}" \
  "IMAGE_TAG=${IMAGE_TAG} STACK=${STACK} CADDY_DOMAIN=${CADDY_DOMAIN} REPLICAS=${REPLICAS} RELEASE_CHANNEL=${RELEASE_CHANNEL} IS_CANARY=${IS_CANARY} bash" << 'REMOTE_EOF'
set -euo pipefail

if [[ "${IS_CANARY}" == "true" ]]; then
  CONFIG_PATH="/etc/fluxer/config.canary.json"
else
  CONFIG_PATH="/etc/fluxer/config.stable.json"
fi
sudo mkdir -p "/opt/${STACK}"
sudo chown -R "${USER}:${USER}" "/opt/${STACK}"
cd "/opt/${STACK}"

cat > compose.yaml << COMPOSEEOF
x-deploy-base: &deploy_base
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

x-healthcheck: &healthcheck
  test: ['CMD', 'curl', '-f', 'http://localhost:8080/']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

services:
  app:
    image: ${IMAGE_TAG}
    environment:
      FLUXER_CONFIG: /etc/fluxer/config.json
    volumes:
      - ${CONFIG_PATH}:/etc/fluxer/config.json:ro
    deploy:
      <<: *deploy_base
      replicas: ${REPLICAS}
      labels:
        - "caddy=${CADDY_DOMAIN}"
        - 'caddy.reverse_proxy={{upstreams 8080}}'
        - 'caddy.header.X-Robots-Tag="noindex, nofollow, nosnippet, noimageindex"'
        - 'caddy.header.Strict-Transport-Security="max-age=31536000; includeSubDomains; preload"'
        - 'caddy.header.X-Xss-Protection="1; mode=block"'
        - 'caddy.header.X-Content-Type-Options=nosniff'
        - 'caddy.header.Referrer-Policy=strict-origin-when-cross-origin'
        - 'caddy.header.X-Frame-Options=DENY'
    networks: [fluxer-shared]
    healthcheck: *healthcheck

networks:
  fluxer-shared:
    external: true
COMPOSEEOF

docker stack deploy \
  --with-registry-auth \
  --detach=false \
  --resolve-image never \
  -c compose.yaml \
  "${STACK}"
REMOTE_EOF
"""

STEPS = build_standard_deploy_steps(
    push_and_deploy_script=PUSH_AND_DEPLOY_SCRIPT,
)


def main() -> int:
    return run_deploy_workflow(STEPS)


if __name__ == "__main__":
    raise SystemExit(main())
