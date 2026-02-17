#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
app_dir="$repo_root/fluxer_app"

shutting_down=0
child_pid=""

shutdown() {
	shutting_down=1
	if [ -n "$child_pid" ] && kill -0 "$child_pid" 2>/dev/null; then
		kill -TERM "$child_pid" 2>/dev/null || true
		wait "$child_pid" 2>/dev/null || true
	fi
	exit 0
}

trap shutdown INT TERM

(
	cd "$app_dir"
	./node_modules/.bin/tsx scripts/DevServer.tsx
) &
child_pid=$!

wait "$child_pid"
status=$?

if [ "$shutting_down" -eq 1 ]; then
	exit 0
fi

exit "$status"
