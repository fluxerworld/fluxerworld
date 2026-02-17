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

import {GenericContainer, type StartedTestContainer, Wait} from 'testcontainers';

const MEILISEARCH_DOCKER_IMAGE = 'getmeili/meilisearch:v1.16.0';
const MEILISEARCH_PORT = 7700;

const TEST_MEILISEARCH_MASTER_KEY = 'test-meilisearch-master-key';

let startedContainer: StartedTestContainer | null = null;
let referenceCount = 0;

export interface MeilisearchTestServer {
	url: string;
	apiKey: string;
	release: () => Promise<void>;
}

export async function acquireMeilisearchTestServer(): Promise<MeilisearchTestServer> {
	referenceCount += 1;

	if (!startedContainer) {
		const container = new GenericContainer(MEILISEARCH_DOCKER_IMAGE)
			.withExposedPorts(MEILISEARCH_PORT)
			.withEnvironment({
				MEILI_ENV: 'development',
				MEILI_NO_ANALYTICS: 'true',
				MEILI_MASTER_KEY: TEST_MEILISEARCH_MASTER_KEY,
			})
			.withWaitStrategy(Wait.forHttp('/health', MEILISEARCH_PORT));

		startedContainer = await container.start();
	}

	const url = `http://${startedContainer.getHost()}:${startedContainer.getMappedPort(MEILISEARCH_PORT)}`;

	return {
		url,
		apiKey: TEST_MEILISEARCH_MASTER_KEY,
		release: async () => {
			referenceCount -= 1;
			if (referenceCount <= 0 && startedContainer) {
				const containerToStop = startedContainer;
				startedContainer = null;
				referenceCount = 0;
				await containerToStop.stop();
			}
		},
	};
}
