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

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
STACK=${STACK:-fluxer-signoz}
SIGNOZ_IMAGE_TAG=${SIGNOZ_IMAGE_TAG:-v0.105.1}

if ! docker network inspect fluxer-shared >/dev/null 2>&1; then
  docker network create -d overlay fluxer-shared
fi

if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]; then
  echo "Docker swarm must be active for stack deployment. Run 'docker swarm init' and try again."
  exit 1
fi

export STACK
export SIGNOZ_IMAGE_TAG

docker stack deploy --with-registry-auth -c "$SCRIPT_DIR/compose.yaml" "$STACK"
