/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {http, passthrough} from 'msw';

// Testcontainers talks to the local Docker Engine API via node http(s) calls.
// MSW intercepts those by default, so we explicitly passthrough Docker API
// requests while keeping strict unhandled-request errors for everything else.
const DOCKER_ENGINE_LOCAL_URL_PATTERN =
	/^http:\/\/localhost\/(v[0-9.]+\/)?(images|containers|networks|volumes|exec|build|auth|events|info|version|_ping)(\/.*)?$/;

export function createDockerEnginePassthroughHandlers() {
	return [http.all(DOCKER_ENGINE_LOCAL_URL_PATTERN, () => passthrough())];
}
