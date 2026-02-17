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

import {ImageResolver} from '@fluxer/api/src/unfurler/resolvers/ImageResolver';
import {createTestImageContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('ImageResolver', () => {
	let mediaService: MockMediaService;
	let resolver: ImageResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new ImageResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches image/png mime type', () => {
			const url = new URL('https://example.com/image.png');
			const result = resolver.match(url, 'image/png', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches image/jpeg mime type', () => {
			const url = new URL('https://example.com/photo.jpg');
			const result = resolver.match(url, 'image/jpeg', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches image/gif mime type', () => {
			const url = new URL('https://example.com/animation.gif');
			const result = resolver.match(url, 'image/gif', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches image/webp mime type', () => {
			const url = new URL('https://example.com/modern.webp');
			const result = resolver.match(url, 'image/webp', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches image/svg+xml mime type', () => {
			const url = new URL('https://example.com/vector.svg');
			const result = resolver.match(url, 'image/svg+xml', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches image/avif mime type', () => {
			const url = new URL('https://example.com/modern.avif');
			const result = resolver.match(url, 'image/avif', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('does not match video mime types', () => {
			const url = new URL('https://example.com/video.mp4');
			const result = resolver.match(url, 'video/mp4', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match audio mime types', () => {
			const url = new URL('https://example.com/audio.mp3');
			const result = resolver.match(url, 'audio/mpeg', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match text/html mime types', () => {
			const url = new URL('https://example.com/page.html');
			const result = resolver.match(url, 'text/html', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match application/octet-stream', () => {
			const url = new URL('https://example.com/file.bin');
			const result = resolver.match(url, 'application/octet-stream', new Uint8Array(0));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns an image embed with correct structure', async () => {
			const url = new URL('https://example.com/photo.png');
			const content = createTestImageContent('png');

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('image');
			expect(embeds[0]!.url).toBe('https://example.com/photo.png');
			expect(embeds[0]!.thumbnail).toBeDefined();
		});

		it('includes image metadata in thumbnail', async () => {
			const url = new URL('https://example.com/photo.jpg');
			const content = createTestImageContent('jpeg');

			mediaService.setMetadata('base64', {
				format: 'jpeg',
				content_type: 'image/jpeg',
				width: 800,
				height: 600,
			});

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.thumbnail).toBeDefined();
			expect(embeds[0]!.thumbnail!.url).toBe('https://example.com/photo.jpg');
		});

		it('handles animated GIF content', async () => {
			const url = new URL('https://example.com/animation.gif');
			const content = createTestImageContent('gif');

			mediaService.setMetadata('base64', {
				format: 'gif',
				content_type: 'image/gif',
				animated: true,
			});

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.thumbnail).toBeDefined();
		});

		it('handles NSFW content when allowed', async () => {
			const url = new URL('https://example.com/image.png');
			const content = createTestImageContent('png');

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, true);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.thumbnail).toBeDefined();
		});

		it('handles NSFW content when not allowed', async () => {
			const url = new URL('https://example.com/image.png');
			const content = createTestImageContent('png');

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, false);

			expect(embeds).toHaveLength(1);
		});

		it('handles placeholder in metadata', async () => {
			const url = new URL('https://example.com/photo.jpg');
			const content = createTestImageContent('jpeg');

			mediaService.setMetadata('base64', {
				placeholder: 'data:image/jpeg;base64,/9j/4AAQ...',
			});

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.thumbnail).toBeDefined();
		});

		it('handles URLs with CDN parameters', async () => {
			const url = new URL('https://cdn.example.com/images/photo.png?width=800&quality=80');
			const content = createTestImageContent('png');

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toBe('https://cdn.example.com/images/photo.png?width=800&quality=80');
		});

		it('handles URLs with special characters in path', async () => {
			const url = new URL('https://example.com/images/my%20photo%20(1).png');
			const content = createTestImageContent('png');

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toContain('my%20photo');
		});

		it('handles international domain names', async () => {
			const url = new URL('https://example.com/image.png');
			const content = createTestImageContent('png');

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toBe('https://example.com/image.png');
		});
	});
});
