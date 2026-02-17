#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import EnvArg
from deploy_workflow import build_standard_deploy_steps, run_deploy_workflow


VALIDATE_CONFIRMATION_STEP = """
set -euo pipefail
if [ "${CONFIRMATION}" != "RESTART" ]; then
  echo "::error::Confirmation failed. You must type 'RESTART' to proceed with a full restart."
  echo "::error::For regular updates, use deploy-gateway.yaml instead."
  exit 1
fi
"""

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
    hostname: "{{.Node.Hostname}}-{{.Task.Slot}}"
    environment:
      - FLUXER_CONFIG=/etc/fluxer/config.json
      - FLUXER_GATEWAY_NODE_FLAG=-sname
      - FLUXER_GATEWAY_NODE_NAME=fluxer_gateway_{{.Node.ID}}_{{.Task.Slot}}
    volumes:
      - ${CONFIG_PATH}:/etc/fluxer/config.json:ro
    deploy:
      replicas: 1
      endpoint_mode: dnsrr
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
        - 'caddy_gw=gateway.fluxer.app'
        - 'caddy_gw.reverse_proxy={{upstreams 8080}}'
    networks:
      - fluxer-shared
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/_health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

networks:
  fluxer-shared:
    external: true
COMPOSEEOF

docker stack deploy --with-registry-auth --detach=false --resolve-image never -c compose.yaml "${COMPOSE_STACK}"
REMOTE_EOF
"""

STEPS = {
    "validate_confirmation": VALIDATE_CONFIRMATION_STEP,
    **build_standard_deploy_steps(
        push_and_deploy_script=PUSH_AND_DEPLOY_SCRIPT,
        include_build_timestamp=False,
    ),
}


def main() -> int:
    return run_deploy_workflow(
        STEPS,
        env_args=[
            EnvArg("--confirmation", "CONFIRMATION"),
        ],
    )


if __name__ == "__main__":
    raise SystemExit(main())
