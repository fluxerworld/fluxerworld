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

import {KlipyResolver} from '@fluxer/api/src/unfurler/resolvers/KlipyResolver';
import {createMockContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

interface KlipyMediaData {
	uuid?: string;
	slug?: string;
	description?: string;
	title?: string;
	file?: {
		hd?: {
			webp?: {url?: string; width?: number; height?: number};
			mp4?: {url?: string; width?: number; height?: number};
			gif?: {url?: string; width?: number; height?: number};
		};
		md?: {
			webp?: {url?: string; width?: number; height?: number};
			mp4?: {url?: string; width?: number; height?: number};
		};
	};
	type?: string;
}

function createKlipyPlayerContent(media: KlipyMediaData): Uint8Array {
	const mediaJson = JSON.stringify(media);
	const flightData = `10:["$","$L26",null,{"media":${mediaJson}}]`;
	const escapedFlightData = JSON.stringify(flightData).slice(1, -1);

	const html = `<!DOCTYPE html>
<html>
<head>
<script>self.__next_f.push([1,"${escapedFlightData}"])</script>
</head>
<body></body>
</html>`;
	return new TextEncoder().encode(html);
}

describe('KlipyResolver', () => {
	let mediaService: MockMediaService;
	let resolver: KlipyResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new KlipyResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('transformUrl', () => {
		it('transforms klipy.com gifs URLs to player URLs', () => {
			const url = new URL('https://klipy.com/gifs/love-ghost-1');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/gifs/love-ghost-1/player');
		});

		it('transforms klipy.com clips URLs to player URLs', () => {
			const url = new URL('https://klipy.com/clips/some-clip');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/clips/some-clip/player');
		});

		it('transforms legacy klipy.com gif URLs to player URLs', () => {
			const url = new URL('https://klipy.com/gif/9054268440156284');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/gifs/9054268440156284/player');
		});

		it('transforms legacy klipy.com clip URLs to player URLs', () => {
			const url = new URL('https://klipy.com/clip/some-clip');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/clips/some-clip/player');
		});

		it('handles URLs with query parameters', () => {
			const url = new URL('https://klipy.com/gifs/love-ghost-1?v=2');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/gifs/love-ghost-1/player');
		});

		it('handles URLs with trailing slash', () => {
			const url = new URL('https://klipy.com/gifs/love-ghost-1/');
			const result = resolver.transformUrl(url);
			expect(result?.href).toBe('https://klipy.com/gifs/love-ghost-1/player');
		});

		it('returns null for non-klipy domains', () => {
			const url = new URL('https://giphy.com/gifs/cat-12345');
			const result = resolver.transformUrl(url);
			expect(result).toBeNull();
		});

		it('returns null for non-gifs/clips paths', () => {
			const url = new URL('https://klipy.com/about');
			const result = resolver.transformUrl(url);
			expect(result).toBeNull();
		});

		it('returns null for klipy subdomains', () => {
			const url = new URL('https://static.klipy.com/image.gif');
			const result = resolver.transformUrl(url);
			expect(result).toBeNull();
		});
	});

	describe('match', () => {
		it('matches klipy.com URLs with text/html', () => {
			const url = new URL('https://klipy.com/gifs/love-ghost-1');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches klipy.com clips URLs', () => {
			const url = new URL('https://klipy.com/clips/some-clip-slug');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(true);
		});

		it('matches klipy.com with text/html charset', () => {
			const url = new URL('https://klipy.com/gifs/test');
			const result = resolver.match(url, 'text/html; charset=utf-8', createMockContent(''));
			expect(result).toBe(true);
		});

		it('does not match non-klipy domains', () => {
			const url = new URL('https://giphy.com/gifs/cat-12345');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match klipy.com with non-HTML content type', () => {
			const url = new URL('https://klipy.com/gifs/love-ghost-1');
			const result = resolver.match(url, 'application/json', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match klipy subdomains', () => {
			const url = new URL('https://static.klipy.com/image.gif');
			const result = resolver.match(url, 'text/html', createMockContent(''));
			expect(result).toBe(false);
		});

		it('does not match image mime types even on klipy domain', () => {
			const url = new URL('https://klipy.com/image.gif');
			const result = resolver.match(url, 'image/gif', createMockContent(''));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns gifv embed with thumbnail and video from player content', async () => {
			const media: KlipyMediaData = {
				uuid: 'c0db9951-4c03-4008-97fc-2a8986782c1b',
				slug: 'love-ghost-1',
				title: 'Cute Ghosts Sending Extra Love',
				description: 'Two cute cartoon ghosts send extra love with a pink heart.',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/test/kIsgEOKn.webp', width: 498, height: 498},
						mp4: {url: 'https://static.klipy.com/ii/test/nyOtbnCFc6GfLxMBzd.mp4', width: 640, height: 640},
					},
				},
				type: 'gif',
			};

			const url = new URL('https://klipy.com/gifs/love-ghost-1');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].type).toBe('gifv');
			expect(embeds[0].url).toBe('https://klipy.com/gifs/love-ghost-1');
			expect(embeds[0].provider).toEqual({name: 'KLIPY', url: 'https://klipy.com'});
			expect(embeds[0].thumbnail).toBeDefined();
			expect(embeds[0].video).toBeDefined();
		});

		it('extracts webp URL for thumbnail', async () => {
			const media: KlipyMediaData = {
				slug: 'test-gif',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/abc/thumbnail.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/abc/video.mp4', width: 400, height: 400},
					},
				},
			};

			const url = new URL('https://klipy.com/gifs/test-gif');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].thumbnail?.url).toContain('thumbnail.webp');
		});

		it('extracts mp4 URL for video', async () => {
			const media: KlipyMediaData = {
				slug: 'test-gif',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/abc/thumbnail.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/abc/video.mp4', width: 640, height: 640},
					},
				},
			};

			const url = new URL('https://klipy.com/gifs/test-gif');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].video?.url).toContain('video.mp4');
		});

		it('handles clips URLs', async () => {
			const media: KlipyMediaData = {
				slug: 'funny-clip',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/clip/thumb.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/clip/video.mp4', width: 640, height: 640},
					},
				},
				type: 'clip',
			};

			const url = new URL('https://klipy.com/clips/funny-clip');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].type).toBe('gifv');
			expect(embeds[0].url).toBe('https://klipy.com/clips/funny-clip');
		});

		it('handles media with only thumbnail (no video)', async () => {
			const media: KlipyMediaData = {
				slug: 'image-only',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/test/image.webp', width: 400, height: 400},
					},
				},
			};

			const url = new URL('https://klipy.com/gifs/image-only');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].thumbnail).toBeDefined();
			expect(embeds[0].video).toBeUndefined();
		});

		it('handles media with only video (no thumbnail)', async () => {
			const media: KlipyMediaData = {
				slug: 'video-only',
				file: {
					hd: {
						mp4: {url: 'https://static.klipy.com/ii/test/video.mp4', width: 640, height: 640},
					},
				},
			};

			const url = new URL('https://klipy.com/gifs/video-only');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].thumbnail).toBeUndefined();
			expect(embeds[0].video).toBeDefined();
		});

		it('returns empty array when content has no media data', async () => {
			const content = createMockContent('<!DOCTYPE html><html><body>No media</body></html>');

			const url = new URL('https://klipy.com/gifs/no-media');
			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('returns empty array when media has no file property', async () => {
			const flightData = `10:["$","$L26",null,{"media":{"uuid":"test","slug":"no-file"}}]`;
			const escaped = JSON.stringify(flightData).slice(1, -1);
			const html = `<!DOCTYPE html><html><head><script>self.__next_f.push([1,"${escaped}"])</script></head></html>`;
			const content = new TextEncoder().encode(html);

			const url = new URL('https://klipy.com/gifs/no-file');
			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(0);
		});

		it('handles NSFW flag when allowed', async () => {
			const media: KlipyMediaData = {
				slug: 'nsfw-gif',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/nsfw/thumb.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/nsfw/video.mp4', width: 640, height: 640},
					},
				},
			};

			mediaService.markAsNsfw('https://static.klipy.com/ii/nsfw/thumb.webp');
			mediaService.markAsNsfw('https://static.klipy.com/ii/nsfw/video.mp4');

			const url = new URL('https://klipy.com/gifs/nsfw-gif');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media), true);

			expect(embeds).toHaveLength(1);
		});

		it('preserves original URL in embed output', async () => {
			const media: KlipyMediaData = {
				slug: 'special%20chars',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/test/thumb.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/test/video.mp4', width: 640, height: 640},
					},
				},
			};

			const url = new URL('https://klipy.com/gifs/special%20chars');
			const embeds = await resolver.resolve(url, createKlipyPlayerContent(media));

			expect(embeds[0].url).toBe('https://klipy.com/gifs/special%20chars');
		});

		it('handles multiple next_f.push calls and finds media in any', async () => {
			const media: KlipyMediaData = {
				slug: 'multi-push',
				file: {
					hd: {
						webp: {url: 'https://static.klipy.com/ii/test/thumb.webp', width: 400, height: 400},
						mp4: {url: 'https://static.klipy.com/ii/test/video.mp4', width: 640, height: 640},
					},
				},
			};

			const mediaJson = JSON.stringify(media);
			const flightData = `10:["$","$L26",null,{"media":${mediaJson}}]`;
			const escaped = JSON.stringify(flightData).slice(1, -1);

			const html = `<!DOCTYPE html>
<html>
<head>
<script>self.__next_f.push([1,"0:something-else"])</script>
<script>self.__next_f.push([1,"${escaped}"])</script>
</head>
</html>`;
			const content = new TextEncoder().encode(html);

			const url = new URL('https://klipy.com/gifs/multi-push');
			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0].thumbnail).toBeDefined();
		});
	});
});
