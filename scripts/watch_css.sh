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

if [ "$#" -eq 0 ]; then
  targets="admin marketing"
else
  targets="$*"
fi

pids=""

start_watch() {
  target="$1"
  case "$target" in
    admin)
      if [ ! -f "packages/admin/src/styles/app.css" ]; then
        echo "Admin css input missing, skipping: packages/admin/src/styles/app.css" >&2
        return
      fi
      pnpm --filter fluxer_admin build:css:watch &
      ;;
    marketing)
      if [ ! -f "packages/marketing/src/styles/app.css" ]; then
        echo "Marketing css input missing, skipping: packages/marketing/src/styles/app.css" >&2
        return
      fi
      pnpm --filter @fluxer/marketing build:css:watch &
      ;;
    *)
      echo "Unknown css watch target: $target" >&2
      exit 1
      ;;
  esac
  pids="${pids} $!"
}

for target in $targets; do
  start_watch "$target"
done

if [ -z "$pids" ]; then
  echo "No css watchers started." >&2
  exit 1
fi

cleanup() {
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT INT TERM

wait
