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

import {createHttpClient, type HttpError} from '@fluxer/media_proxy/src/utils/FetchUtils';
import {describe, expect, test} from 'vitest';

describe('media proxy request URL policy', () => {
	test('blocks localhost metadata target', async () => {
		const client = createHttpClient('fluxer-media-proxy-test');
		const expectedError: Partial<HttpError> = {
			isExpected: true,
		};

		await expect(client.sendRequest({url: 'http://localhost/_metadata'})).rejects.toMatchObject(expectedError);
	});

	test('blocks private IP metadata target', async () => {
		const client = createHttpClient('fluxer-media-proxy-test');
		const expectedError: Partial<HttpError> = {
			isExpected: true,
		};

		await expect(client.sendRequest({url: 'http://127.0.0.1:8080/path'})).rejects.toMatchObject(expectedError);
	});
});
