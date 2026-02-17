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

// When integration tests spin up a real Meilisearch instance (Testcontainers),
// we want those requests to hit the network while still treating all other
// unhandled requests as errors.
const MEILISEARCH_LOCAL_URL_PATTERN =
	/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/(health|info|indexes|tasks|keys|stats|version)(\/.*)?$/;

export function createMeilisearchPassthroughHandlers() {
	return [http.all(MEILISEARCH_LOCAL_URL_PATTERN, () => passthrough())];
}
