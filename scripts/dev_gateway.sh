#!/usr/bin/env sh

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

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
export FLUXER_CONFIG="${FLUXER_CONFIG:-$REPO_ROOT/config/config.json}"

cd fluxer_gateway

# Ensure asdf shims are available for Erlang/OTP selection in non-interactive shells.
ASDF_SHIMS_PATH="${ASDF_DATA_DIR:-$HOME/.asdf}/shims"
if [ -d "$ASDF_SHIMS_PATH" ]; then
  export PATH="$ASDF_SHIMS_PATH:$PATH"
fi

# Render config templates.
export FLUXER_GATEWAY_NODE_FLAG="${FLUXER_GATEWAY_NODE_FLAG:--name}"
export FLUXER_GATEWAY_NODE_NAME="${FLUXER_GATEWAY_NODE_NAME:-fluxer_gateway@127.0.0.1}"
export LOGGER_LEVEL="${LOGGER_LEVEL:-debug}"
envsubst < config/sys.config.template > config/sys.config

echo "Building release (node=${FLUXER_GATEWAY_NODE_NAME})..."
./scripts/rebar3_wrapper.sh as dev release

echo "Starting gateway release..."

if [ "${FLUXER_GATEWAY_NO_SHELL:-0}" = "1" ]; then
  export ERL_FLAGS="${ERL_FLAGS:-} -noshell -noinput"
fi

exec _build/dev/rel/fluxer_gateway/bin/fluxer_gateway foreground
