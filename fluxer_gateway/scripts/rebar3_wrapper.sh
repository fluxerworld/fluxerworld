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

if [ "$#" -eq 0 ]; then
	echo "Usage: $0 <rebar3 args...>" >&2
	exit 64
fi

ASDF_SHIMS_PATH="${ASDF_DATA_DIR:-$HOME/.asdf}/shims"
if [ -d "$ASDF_SHIMS_PATH" ]; then
	export PATH="$ASDF_SHIMS_PATH:$PATH"
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
if [ -f "$SCRIPT_DIR/../rebar.config" ]; then
	GATEWAY_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
	REPO_ROOT=$(cd "$GATEWAY_DIR/.." && pwd)
else
	REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
	GATEWAY_DIR="$REPO_ROOT/fluxer_gateway"
fi

if [ -z "${FLUXER_CONFIG:-}" ] && [ -f "$REPO_ROOT/config/config.test.json" ]; then
	export FLUXER_CONFIG="$REPO_ROOT/config/config.test.json"
fi

should_skip_plugins=true
for arg in "$@"; do
	case "$arg" in
	fmt | plugins)
		should_skip_plugins=false
		break
		;;
	esac
done

if [ "$should_skip_plugins" = true ]; then
	export REBAR_SKIP_PROJECT_PLUGINS=1
fi

cd "$GATEWAY_DIR"

exec rebar3 "$@"
