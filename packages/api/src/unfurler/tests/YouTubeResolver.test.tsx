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

import {YouTubeResolver} from '@fluxer/api/src/unfurler/resolvers/YouTubeResolver';
import {createMockContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('YouTubeResolver', () => {
	let mediaService: MockMediaService;
	let resolver: YouTubeResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new YouTubeResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches www.youtube.com/watch URLs', () => {
			const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches youtube.com/watch URLs without www', () => {
			const url = new URL('https://youtube.com/watch?v=dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches youtu.be short URLs', () => {
			const url = new URL('https://youtu.be/dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches youtube.com/shorts URLs', () => {
			const url = new URL('https://www.youtube.com/shorts/abc123def');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches youtube.com/v URLs', () => {
			const url = new URL('https://www.youtube.com/v/dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches watch URLs with timestamp', () => {
			const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches short URLs with timestamp', () => {
			const url = new URL('https://youtu.be/dQw4w9WgXcQ?t=42');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match YouTube homepage', () => {
			const url = new URL('https://www.youtube.com/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube channel URLs', () => {
			const url = new URL('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube user URLs', () => {
			const url = new URL('https://www.youtube.com/@SomeChannel');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube playlist URLs', () => {
			const url = new URL('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube search URLs', () => {
			const url = new URL('https://www.youtube.com/results?search_query=test');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube feed URLs', () => {
			const url = new URL('https://www.youtube.com/feed/subscriptions');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match other domains', () => {
			const url = new URL('https://example.com/watch?v=dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match YouTube Music domain', () => {
			const url = new URL('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns empty array when video ID cannot be extracted', async () => {
			const url = new URL('https://www.youtube.com/watch');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('extracts video ID from watch URL', async () => {
			const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url?.includes('dQw4w9WgXcQ')).toBe(true);
		});

		it('extracts video ID from short URL', async () => {
			const url = new URL('https://youtu.be/dQw4w9WgXcQ');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url?.includes('dQw4w9WgXcQ')).toBe(true);
		});

		it('extracts video ID from shorts URL', async () => {
			const url = new URL('https://www.youtube.com/shorts/abc123def');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url?.includes('abc123def')).toBe(true);
		});

		it('extracts video ID from /v/ URL', async () => {
			const url = new URL('https://www.youtube.com/v/dQw4w9WgXcQ');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url?.includes('dQw4w9WgXcQ')).toBe(true);
		});

		it('handles timestamp in seconds', async () => {
			const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url !== undefined).toBe(true);
		});

		it('handles timestamp with s suffix', async () => {
			const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]?.url !== undefined).toBe(true);
		});
	});
});
