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

import {server} from '@fluxer/api/src/test/msw/server';
import {DefaultResolver} from '@fluxer/api/src/unfurler/resolvers/DefaultResolver';
import {
	createMinimalHtml,
	createMockContent,
	MockCacheService,
	MockMediaService,
} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {MessageEmbedResponse as MessageEmbedResponseSchema} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {HttpResponse, http} from 'msw';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('DefaultResolver', () => {
	let mediaService: MockMediaService;
	let cacheService: MockCacheService;
	let resolver: DefaultResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		cacheService = new MockCacheService();
		resolver = new DefaultResolver(cacheService, mediaService);
	});

	afterEach(() => {
		mediaService.reset();
		cacheService.reset();
	});

	describe('match', () => {
		it('matches text/html content type', () => {
			const url = new URL('https://example.com/page');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches text/html with charset', () => {
			const url = new URL('https://example.com/page');
			const result = resolver.match(url, 'text/html; charset=utf-8', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match image types', () => {
			const url = new URL('https://example.com/image.png');
			const result = resolver.match(url, 'image/png', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match video types', () => {
			const url = new URL('https://example.com/video.mp4');
			const result = resolver.match(url, 'video/mp4', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match audio types', () => {
			const url = new URL('https://example.com/audio.mp3');
			const result = resolver.match(url, 'audio/mpeg', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match application/json', () => {
			const url = new URL('https://example.com/api/data');
			const result = resolver.match(url, 'application/json', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match text/plain', () => {
			const url = new URL('https://example.com/readme.txt');
			const result = resolver.match(url, 'text/plain', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match text/xml', () => {
			const url = new URL('https://example.com/feed.xml');
			const result = resolver.match(url, 'text/xml', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('extracts og:title from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({title: 'Test Article Title'});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.title).toBe('Test Article Title');
		});

		it('extracts og:description from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				description: 'This is a test article description',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.description).toBe('This is a test article description');
		});

		it('extracts og:image from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				image: 'https://example.com/image.jpg',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.thumbnail).toBeDefined();
			expect(embeds[0]!.thumbnail!.url).toBe('https://example.com/image.jpg');
		});

		it('extracts og:site_name from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				siteName: 'Example Site',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.provider?.name).toBe('Example Site');
		});

		it('extracts theme-color from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				themeColor: '#FF5500',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.color).toBe(0xff5500);
		});

		it('handles 3-character hex color', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				themeColor: '#F50',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.color).toBe(0xf50);
		});

		it('ignores invalid color formats', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				themeColor: 'not-a-color',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.color).toBeUndefined();
		});

		it('extracts og:video from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				video: 'https://example.com/video.mp4',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.video).toBeDefined();
		});

		it('extracts og:audio from HTML', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test Article',
				audio: 'https://example.com/audio.mp3',
			});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.audio).toBeDefined();
		});

		it('returns link type embed', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({title: 'Test Article'});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.type).toBe('link');
		});

		it('includes URL in embed', async () => {
			const url = new URL('https://example.com/article?ref=test');
			const html = createMinimalHtml({title: 'Test Article'});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.url).toBe('https://example.com/article?ref=test');
		});

		it('handles empty HTML document', async () => {
			const url = new URL('https://example.com/empty');
			const html = '<!DOCTYPE html><html><head></head><body></body></html>';

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('link');
		});

		it('handles malformed HTML gracefully', async () => {
			const url = new URL('https://example.com/malformed');
			const html = '<html><head><title>Test</title><body>Unclosed tags';

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
		});

		it('truncates long titles', async () => {
			const url = new URL('https://example.com/article');
			const longTitle = 'A'.repeat(200);
			const html = createMinimalHtml({title: longTitle});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.title!.length).toBeLessThanOrEqual(70);
		});

		it('truncates long descriptions', async () => {
			const url = new URL('https://example.com/article');
			const longDesc = 'B'.repeat(500);
			const html = createMinimalHtml({title: 'Test', description: longDesc});

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.description!.length).toBeLessThanOrEqual(350);
		});

		it('drops invalid oEmbed author URLs and falls back provider URL to origin', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:title" content="oEmbed test" />
<link rel="alternate" type="application/json+oembed" href="/oembed.json" />
</head>
<body></body>
</html>`;

			server.use(
				http.get('https://example.com/oembed.json', () => {
					return HttpResponse.json({
						provider_name: 'Example provider',
						provider_url: 'not-a-valid-url',
						author_name: 'Example author',
						author_url: 'not-a-valid-url',
					});
				}),
			);

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]?.author?.name).toBe('Example author');
			expect(embeds[0]?.author).not.toHaveProperty('url');
			expect(embeds[0]?.provider?.name).toBe('Example provider');
			expect(embeds[0]?.provider?.url).toBe('https://example.com');
			expect(() => MessageEmbedResponseSchema.parse(embeds[0])).not.toThrow();
		});

		it('filters out relative image URLs that cannot be normalized', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="/images/photo.jpg" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.thumbnail).toBeUndefined();
		});

		it('filters out protocol-relative image URLs that cannot be normalized', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="//cdn.example.com/image.jpg" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.thumbnail).toBeUndefined();
		});

		it('handles NSFW images when allowed', async () => {
			const url = new URL('https://example.com/article');
			const html = createMinimalHtml({
				title: 'Test',
				image: 'https://example.com/nsfw-image.jpg',
			});

			mediaService.markAsNsfw('https://example.com/nsfw-image.jpg');

			const embeds = await resolver.resolve(url, createMockContent(html), true);

			expect(embeds[0]!.thumbnail).toBeDefined();
		});

		it('extracts multiple images for gallery', async () => {
			const url = new URL('https://example.com/gallery');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="https://example.com/image1.jpg" />
<meta property="og:image" content="https://example.com/image2.jpg" />
<meta property="og:image" content="https://example.com/image3.jpg" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds.length).toBeGreaterThanOrEqual(1);
		});

		it('limits gallery images to maximum', async () => {
			const url = new URL('https://example.com/gallery');
			const imagesMeta = Array.from(
				{length: 15},
				(_, i) => `<meta property="og:image" content="https://example.com/image${i}.jpg" />`,
			).join('\n');

			const html = `<!DOCTYPE html>
<html>
<head>
${imagesMeta}
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds.length).toBeLessThanOrEqual(11);
		});

		it('deduplicates identical image URLs', async () => {
			const url = new URL('https://example.com/gallery');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="https://example.com/image.jpg" />
<meta property="og:image" content="https://example.com/image.jpg" />
<meta name="twitter:image" content="https://example.com/image.jpg" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds).toHaveLength(1);
		});

		it('falls back to HTML title when og:title missing', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<title>Fallback Title</title>
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.title).toBe('Fallback Title');
		});

		it('prefers og:title over HTML title', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<title>HTML Title</title>
<meta property="og:title" content="OG Title" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.title).toBe('OG Title');
		});

		it('falls back to twitter:title when og:title missing', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta name="twitter:title" content="Twitter Title" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.title).toBe('Twitter Title');
		});

		it('extracts image alt text', async () => {
			const url = new URL('https://example.com/article');
			const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:image" content="https://example.com/image.jpg" />
<meta property="og:image:alt" content="Description of the image" />
</head>
<body></body>
</html>`;

			const embeds = await resolver.resolve(url, createMockContent(html));

			expect(embeds[0]!.thumbnail?.description).toBe('Description of the image');
		});

		it('resolves ActivityPub via canonical URL when the page was reached through redirects', async () => {
			const redirectPageUrl = new URL('https://mastodon.social/redirect/statuses/12345');
			const canonicalUrl = 'https://example.com/@alice/12345';
			const html = `<!DOCTYPE html>
<html>
<head>
<link href="${canonicalUrl}" rel="canonical" />
</head>
<body></body>
</html>`;
			const activityPubAcceptHeaders: Array<string | null> = [];

			server.use(
				http.get('https://example.com/api/v2/instance', () => {
					return HttpResponse.json({
						domain: 'example.com',
						title: 'Example Social',
					});
				}),
				http.get(canonicalUrl, ({request}) => {
					activityPubAcceptHeaders.push(request.headers.get('accept'));
					return HttpResponse.json({
						id: 'https://example.social/users/alice/statuses/12345',
						type: 'Note',
						url: canonicalUrl,
						published: '2026-02-06T15:46:18Z',
						attributedTo: {
							id: 'https://example.com/users/alice',
							type: 'Person',
							name: 'Alice',
							preferredUsername: 'alice',
							url: 'https://example.com/@alice',
							icon: {
								type: 'Image',
								mediaType: 'image/png',
								url: 'https://example.com/media/avatar.png',
							},
						},
						content: '<p>Canonical ActivityPub fallback works</p>',
						attachment: [
							{
								type: 'Document',
								mediaType: 'image/jpeg',
								url: 'https://example.com/media/1.jpg',
								name: 'Primary alt text',
								width: 640,
								height: 480,
							},
							{
								type: 'Document',
								mediaType: 'image/jpeg',
								url: 'https://example.com/media/2.jpg',
								name: 'Secondary alt text',
								width: 640,
								height: 480,
							},
						],
					});
				}),
			);

			const embeds = await resolver.resolve(redirectPageUrl, createMockContent(html), false, {
				requestUrl: new URL('https://mastodon.social/@alice@example.social/12345'),
				finalUrl: redirectPageUrl,
				wasRedirected: true,
			});

			expect(activityPubAcceptHeaders[0]).toContain('application/json');
			expect(embeds).toHaveLength(2);
			expect(embeds[0]!.url).toBe(canonicalUrl);
			expect(embeds[0]!.image?.description).toBe('Primary alt text');
			expect(embeds[1]!.image?.url).toBe('https://example.com/media/2.jpg');
		});

		it('stops canonical ActivityPub resolution when a second redirect is required', async () => {
			const redirectPageUrl = new URL('https://mastodon.social/redirect/statuses/777');
			const canonicalUrl = 'https://example.com/@alice/777';
			const html = `<!DOCTYPE html>
<html>
<head>
<link href="${canonicalUrl}" rel="canonical" />
</head>
<body></body>
</html>`;

			server.use(
				http.get('https://example.com/api/v2/instance', () => {
					return HttpResponse.json({
						domain: 'example.com',
						title: 'Example Social',
					});
				}),
				http.get(canonicalUrl, () => {
					return HttpResponse.redirect('https://example.com/step-1', 302);
				}),
				http.get('https://example.com/step-1', () => {
					return HttpResponse.redirect('https://example.com/step-2', 302);
				}),
			);

			const embeds = await resolver.resolve(redirectPageUrl, createMockContent(html), false, {
				requestUrl: new URL('https://mastodon.social/@alice@example.social/777'),
				finalUrl: redirectPageUrl,
				wasRedirected: true,
			});

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('link');
			expect(embeds[0]!.url).toBe(redirectPageUrl.href);
		});
	});
});
