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

import {XkcdResolver} from '@fluxer/api/src/unfurler/resolvers/XkcdResolver';
import {createMockContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function createXkcdHtml(options: {title?: string; imageUrl?: string; imageAlt?: string; footerText?: string}): string {
	const metaTags: Array<string> = [];

	if (options.title) {
		metaTags.push(`<meta property="og:title" content="${options.title}" />`);
	}
	if (options.imageUrl) {
		metaTags.push(`<meta property="og:image" content="${options.imageUrl}" />`);
	}

	const comicImg = options.imageUrl
		? `<div id="comic"><img src="${options.imageUrl}" title="${options.imageAlt || ''}" alt="Comic" /></div>`
		: '';

	return `<!DOCTYPE html>
<html>
<head>
${options.title ? `<title>${options.title}</title>` : ''}
${metaTags.join('\n')}
</head>
<body>
${comicImg}
</body>
</html>`;
}

describe('XkcdResolver', () => {
	let mediaService: MockMediaService;
	let resolver: XkcdResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new XkcdResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches xkcd.com URLs with text/html', () => {
			const url = new URL('https://xkcd.com/1234/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches xkcd.com root URL', () => {
			const url = new URL('https://xkcd.com/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches xkcd.com comic URLs without trailing slash', () => {
			const url = new URL('https://xkcd.com/1234');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match non-xkcd domains', () => {
			const url = new URL('https://example.com/1234/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match xkcd.com with non-HTML content type', () => {
			const url = new URL('https://xkcd.com/1234/');
			const result = resolver.match(url, 'application/json', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match xkcd subdomains', () => {
			const url = new URL('https://what-if.xkcd.com/');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match image mime types on xkcd domain', () => {
			const url = new URL('https://xkcd.com/comics/something.png');
			const result = resolver.match(url, 'image/png', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns rich embed with comic title', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test Comic',
				imageUrl: 'https://imgs.xkcd.com/comics/test_comic.png',
				imageAlt: 'This is the alt text hover joke',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('rich');
			expect(embeds[0]!.title).toBe('xkcd: Test Comic');
			expect(embeds[0]!.url).toBe('https://xkcd.com/1234/');
		});

		it('includes comic image in embed', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test Comic',
				imageUrl: 'https://imgs.xkcd.com/comics/test_comic.png',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.image).toBeDefined();
		});

		it('includes alt text as image description', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test Comic',
				imageUrl: 'https://imgs.xkcd.com/comics/test_comic.png',
				imageAlt: 'This is the alt text hover joke that explains the punchline',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.image?.description).toBe('This is the alt text hover joke that explains the punchline');
		});

		it('includes footer text from comic', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test Comic',
				imageUrl: 'https://imgs.xkcd.com/comics/test_comic.png',
				imageAlt: 'Footer joke text',
				footerText: 'Footer joke text',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.footer?.text).toBe('Footer joke text');
		});

		it('sets xkcd black color for embed', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test Comic',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.color).toBe(0x000000);
		});

		it('handles comic without og:title by using HTML title', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = `<!DOCTYPE html>
<html>
<head>
<title>xkcd: Fallback Title</title>
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.title).toBe('xkcd: Fallback Title');
		});

		it('handles missing image gracefully', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: No Image Comic',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.title).toBe('xkcd: No Image Comic');
		});

		it('handles missing title gracefully', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				imageUrl: 'https://imgs.xkcd.com/comics/test.png',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.title).toBeUndefined();
		});

		it('handles NSFW content flag', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({
				title: 'xkcd: Test',
				imageUrl: 'https://imgs.xkcd.com/comics/test.png',
			});

			mediaService.markAsNsfw('https://imgs.xkcd.com/comics/test.png');

			const embeds = await resolver.resolve(url, createMockContent(html), false);

			expect(embeds).toHaveLength(1);
		});

		it('preserves original URL in embed', async () => {
			const url = new URL('https://xkcd.com/1234/');
			const html = createXkcdHtml({title: 'Test'});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.url).toBe('https://xkcd.com/1234/');
		});
	});
});
