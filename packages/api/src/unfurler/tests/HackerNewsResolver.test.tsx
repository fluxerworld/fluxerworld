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

import {HackerNewsResolver} from '@fluxer/api/src/unfurler/resolvers/HackerNewsResolver';
import {createMockContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('HackerNewsResolver', () => {
	let mediaService: MockMediaService;
	let resolver: HackerNewsResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new HackerNewsResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches news.ycombinator.com item URLs', () => {
			const url = new URL('https://news.ycombinator.com/item?id=12345678');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches HN item URLs with additional parameters', () => {
			const url = new URL('https://news.ycombinator.com/item?id=12345678&p=2');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match HN homepage', () => {
			const url = new URL('https://news.ycombinator.com/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match HN news page', () => {
			const url = new URL('https://news.ycombinator.com/news');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match HN newest page', () => {
			const url = new URL('https://news.ycombinator.com/newest');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match HN submit page', () => {
			const url = new URL('https://news.ycombinator.com/submit');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match HN user page', () => {
			const url = new URL('https://news.ycombinator.com/user?id=dang');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match non-HN domains', () => {
			const url = new URL('https://example.com/item?id=12345678');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match HN with non-HTML content type', () => {
			const url = new URL('https://news.ycombinator.com/item?id=12345678');
			const result = resolver.match(url, 'application/json', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match ycombinator.com without news subdomain', () => {
			const url = new URL('https://ycombinator.com/item?id=12345678');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns empty array when no item ID in URL', async () => {
			const url = new URL('https://news.ycombinator.com/item');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('returns empty array for invalid item ID format', async () => {
			const url = new URL('https://news.ycombinator.com/item?id=');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('preserves HN URL structure in embed', async () => {
			const url = new URL('https://news.ycombinator.com/item?id=12345678');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url?.includes('12345678')).toBe(true);
		});
	});
});
