#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_steps import ADD_KNOWN_HOSTS_SCRIPT
from ci_workflow import EnvArg, parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "install_dependencies": """
set -euo pipefail
cd fluxer_api
pnpm install --frozen-lockfile
""",
    "validate_migrations": """
set -euo pipefail
cd fluxer_api
pnpm tsx scripts/CassandraMigrate.tsx check
""",
    "add_known_hosts": ADD_KNOWN_HOSTS_SCRIPT,
    "setup_tunnel": """
set -euo pipefail
TUNNEL_PID_FILE=/tmp/ssh-tunnel.pid
rm -f "$TUNNEL_PID_FILE"
nohup ssh -N -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=30 -o ExitOnForwardFailure=yes -L 9042:localhost:9042 ${SERVER_USER}@${SERVER_IP} > /tmp/ssh-tunnel.log 2>&1 &
SSH_TUNNEL_PID=$!
printf '%s\n' "$SSH_TUNNEL_PID" > "$TUNNEL_PID_FILE"
printf 'SSH_TUNNEL_PID=%s\n' "$SSH_TUNNEL_PID" >> "$GITHUB_ENV"

for i in {1..30}; do
  if timeout 1 bash -c "echo > /dev/tcp/localhost/9042" 2>/dev/null; then
    echo "SSH tunnel established"
    break
  elif command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":9042 "; then
    echo "SSH tunnel established"
    break
  elif command -v netstat >/dev/null 2>&1 && netstat -tln | grep -q ":9042 "; then
    echo "SSH tunnel established"
    break
  fi
  if [ $i -eq 30 ]; then
    cat /tmp/ssh-tunnel.log || true
    exit 1
  fi
  sleep 1
done

ps -p "$SSH_TUNNEL_PID" > /dev/null || exit 1
""",
    "test_connection": """
set -euo pipefail
cd fluxer_api
pnpm tsx scripts/CassandraMigrate.tsx \
  --host localhost \
  --port 9042 \
  --username "${CASSANDRA_USERNAME}" \
  --password "${CASSANDRA_PASSWORD}" \
  test
""",
    "run_migrations": """
set -euo pipefail
cd fluxer_api
pnpm tsx scripts/CassandraMigrate.tsx \
  --host localhost \
  --port 9042 \
  --username "${CASSANDRA_USERNAME}" \
  --password "${CASSANDRA_PASSWORD}" \
  up
""",
    "close_tunnel": """
set -euo pipefail
TUNNEL_PID_FILE=/tmp/ssh-tunnel.pid

if [ -n "${SSH_TUNNEL_PID:-}" ]; then
  kill "$SSH_TUNNEL_PID" 2>/dev/null || true
fi

if [ -f "$TUNNEL_PID_FILE" ]; then
  read -r TUNNEL_PID < "$TUNNEL_PID_FILE" || true
  if [ -n "${TUNNEL_PID:-}" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
fi

rm -f "$TUNNEL_PID_FILE" /tmp/ssh-tunnel.log || true
""",
}


def main() -> int:
    args = parse_step_env_args(
        [
            EnvArg("--server-user", "SERVER_USER"),
        ],
        include_server_ip=True,
    )
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
