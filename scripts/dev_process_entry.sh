#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 2 ]; then
	echo "Usage: $0 <service_name> <command...>" >&2
	exit 1
fi

service_name="$1"
shift

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

runtime_dir="${DEVENV_RUNTIME:-${XDG_RUNTIME_DIR:-/tmp}}"
lock_dir="${runtime_dir}/fluxer_dev_bootstrap.lock"
stamp_file="${runtime_dir}/fluxer_dev_bootstrap.done"

mkdir -p "$repo_root/dev/logs"

if [ "${FLUXER_SKIP_BOOTSTRAP:-0}" != "1" ]; then
	if [ "${FLUXER_FORCE_BOOTSTRAP:-0}" = "1" ] || [ ! -f "$stamp_file" ]; then
		if mkdir "$lock_dir" 2>/dev/null; then
			trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT

			# Keep bootstrap output out of per-service logs.
			rm -f "$stamp_file" 2>/dev/null || true
			"$repo_root/scripts/dev_bootstrap.sh" >"$repo_root/dev/logs/bootstrap.log" 2>"$repo_root/dev/logs/bootstrap.err.log"

			date -Is >"$stamp_file"
			rmdir "$lock_dir" 2>/dev/null || true
			trap - EXIT
		else
			# Another process is bootstrapping – wait for completion.
			wait_started_at="$(date +%s)"
			while [ ! -f "$stamp_file" ]; do
				if [ "$(( $(date +%s) - wait_started_at ))" -gt 120 ]; then
					echo "Timed out waiting for bootstrap to complete (service=$service_name)." >&2
					echo "If this persists, stop the stack and remove ${lock_dir} and ${stamp_file}." >&2
					exit 1
				fi
				sleep 0.2
			done
		fi
	fi
fi

cd "$repo_root"
exec "$@"
