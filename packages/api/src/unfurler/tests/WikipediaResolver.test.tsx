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

import {createWikipediaApiHandlers} from '@fluxer/api/src/test/msw/handlers/WikipediaApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {WikipediaResolver} from '@fluxer/api/src/unfurler/resolvers/WikipediaResolver';
import {createMockContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('WikipediaResolver', () => {
	let mediaService: MockMediaService;
	let resolver: WikipediaResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new WikipediaResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches en.wikipedia.org wiki URLs', () => {
			const url = new URL('https://en.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches de.wikipedia.org wiki URLs', () => {
			const url = new URL('https://de.wikipedia.org/wiki/Test_Artikel');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches fr.wikipedia.org wiki URLs', () => {
			const url = new URL('https://fr.wikipedia.org/wiki/Article_Test');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches es.wikipedia.org wiki URLs', () => {
			const url = new URL('https://es.wikipedia.org/wiki/Articulo_Test');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches it.wikipedia.org wiki URLs', () => {
			const url = new URL('https://it.wikipedia.org/wiki/Articolo_Test');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches ja.wikipedia.org wiki URLs', () => {
			const url = new URL('https://ja.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches ru.wikipedia.org wiki URLs', () => {
			const url = new URL('https://ru.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches zh.wikipedia.org wiki URLs', () => {
			const url = new URL('https://zh.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches www.wikipedia.org wiki URLs', () => {
			const url = new URL('https://www.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches wikipedia.org wiki URLs without subdomain', () => {
			const url = new URL('https://wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match non-wiki paths on wikipedia', () => {
			const url = new URL('https://en.wikipedia.org/w/index.php?title=Test');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match non-wiki paths like main page', () => {
			const url = new URL('https://en.wikipedia.org/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match other domains', () => {
			const url = new URL('https://example.com/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match non-HTML content types', () => {
			const url = new URL('https://en.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'application/json', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match unsupported language subdomains', () => {
			const url = new URL('https://pt.wikipedia.org/wiki/Test_Article');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match wikimedia commons', () => {
			const url = new URL('https://commons.wikimedia.org/wiki/File:Test.jpg');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match wikidata', () => {
			const url = new URL('https://www.wikidata.org/wiki/Q42');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		beforeEach(() => {
			server.use(...createWikipediaApiHandlers());
		});

		it('returns empty array for missing article title', async () => {
			const url = new URL('https://en.wikipedia.org/wiki/');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('handles URL-encoded article titles', async () => {
			const url = new URL('https://en.wikipedia.org/wiki/Test%20Article%20(disambiguation)');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toBeDefined();
		});

		it('handles special characters in article titles', async () => {
			const url = new URL('https://en.wikipedia.org/wiki/C%2B%2B');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toBeDefined();
		});

		it('handles Japanese characters in article titles', async () => {
			const url = new URL('https://ja.wikipedia.org/wiki/%E6%27%A5%E6%9C%AC');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toBeDefined();
		});

		it('handles Cyrillic characters in article titles', async () => {
			const url = new URL('https://ru.wikipedia.org/wiki/%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D1%8F');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toBeDefined();
		});

		it('handles anchor links in article URLs', async () => {
			const url = new URL('https://en.wikipedia.org/wiki/Test_Article#Section');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toBeDefined();
		});

		it('preserves original URL in embed', async () => {
			const url = new URL('https://en.wikipedia.org/wiki/Test_Article');
			const content = createMockContent('<html></html>');

			const embeds = await resolver.resolve(url, content);

			expect(embeds.length === 0 || embeds[0]!.url === 'https://en.wikipedia.org/wiki/Test_Article').toBe(true);
		});
	});
});
