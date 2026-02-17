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

import {ActivityPubFetcher} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubFetcher';
import {MockCacheService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {describe, expect, it} from 'vitest';

describe('ActivityPubFetcher', () => {
	it('returns null for ActivityPub actor fetches to internal IPv4 literals', async () => {
		const fetcher = new ActivityPubFetcher(new MockCacheService());

		const result = await fetcher.tryFetchActivityPubData('http://127.0.0.1/users/alice');

		expect(result).toBeNull();
	});

	it('returns null for ActivityPub actor fetches to localhost hostnames', async () => {
		const fetcher = new ActivityPubFetcher(new MockCacheService());

		const result = await fetcher.tryFetchActivityPubData('https://localhost/users/alice');

		expect(result).toBeNull();
	});

	it('returns null for ActivityPub actor fetches to internal IPv6 literals', async () => {
		const fetcher = new ActivityPubFetcher(new MockCacheService());

		const result = await fetcher.tryFetchActivityPubData('http://[::1]/users/alice');

		expect(result).toBeNull();
	});

	it('returns null for instance metadata fetches to internal addresses', async () => {
		const fetcher = new ActivityPubFetcher(new MockCacheService());

		const result = await fetcher.fetchInstanceInfo('http://127.0.0.1');

		expect(result).toBeNull();
	});
});
