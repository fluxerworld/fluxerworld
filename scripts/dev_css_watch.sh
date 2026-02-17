#!/usr/bin/env bash

# Copyright (C) 2026 Fluxer Contributors
#
# This file is part of Fluxer.
#
# Fluxer is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Fluxer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

admin_dir="$repo_root/packages/admin"
marketing_dir="$repo_root/packages/marketing"

shutting_down=0

shutdown() {
	shutting_down=1
	kill -TERM "$P1" "$P2" 2>/dev/null || true
	wait "$P1" "$P2" 2>/dev/null || true
	exit 0
}

(
	cd "$admin_dir"
	./node_modules/.bin/tailwindcss -i ./src/styles/app.css -o ./public/static/app.css --watch=always
) &
P1=$!

(
	cd "$marketing_dir"
	./node_modules/.bin/tailwindcss -i ./src/styles/app.css -o ./public/static/app.css --watch=always
) &
P2=$!

trap shutdown INT TERM

wait -n "$P1" "$P2"
status=$?

if [ "$shutting_down" -eq 1 ]; then
	exit 0
fi

shutdown
exit "$status"
