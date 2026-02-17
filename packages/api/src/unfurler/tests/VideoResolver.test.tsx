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

import {VideoResolver} from '@fluxer/api/src/unfurler/resolvers/VideoResolver';
import {createTestVideoContent, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('VideoResolver', () => {
	let mediaService: MockMediaService;
	let resolver: VideoResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new VideoResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('match', () => {
		it('matches video/mp4 mime type', () => {
			const url = new URL('https://example.com/video.mp4');
			const result = resolver.match(url, 'video/mp4', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches video/webm mime type', () => {
			const url = new URL('https://example.com/video.webm');
			const result = resolver.match(url, 'video/webm', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches video/ogg mime type', () => {
			const url = new URL('https://example.com/video.ogv');
			const result = resolver.match(url, 'video/ogg', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches video/quicktime mime type', () => {
			const url = new URL('https://example.com/video.mov');
			const result = resolver.match(url, 'video/quicktime', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('matches video/x-msvideo mime type', () => {
			const url = new URL('https://example.com/video.avi');
			const result = resolver.match(url, 'video/x-msvideo', new Uint8Array(0));
			expect(result).toBe(true);
		});

		it('does not match audio mime types', () => {
			const url = new URL('https://example.com/audio.mp3');
			const result = resolver.match(url, 'audio/mpeg', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match image mime types', () => {
			const url = new URL('https://example.com/image.png');
			const result = resolver.match(url, 'image/png', new Uint8Array(0));
			expect(result).toBe(false);
		});

		it('does not match text/html mime types', () => {
			const url = new URL('https://example.com/page.html');
			const result = resolver.match(url, 'text/html', new Uint8Array(0));
			expect(result).toBe(false);
		});
	});

	describe('resolve', () => {
		it('returns a video embed with correct structure', async () => {
			const url = new URL('https://example.com/video.mp4');
			const content = createTestVideoContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.type).toBe('video');
			expect(embeds[0]!.url).toBe('https://example.com/video.mp4');
			expect(embeds[0]!.video).toBeDefined();
		});

		it('includes video metadata in embed', async () => {
			const url = new URL('https://example.com/clip.mp4');
			const content = createTestVideoContent();

			mediaService.setMetadata('base64', {
				format: 'mp4',
				content_type: 'video/mp4',
				width: 1920,
				height: 1080,
				duration: 120,
			});

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.video).toBeDefined();
			expect(embeds[0]!.video!.url).toBe('https://example.com/clip.mp4');
		});

		it('handles NSFW content when allowed', async () => {
			const url = new URL('https://example.com/video.mp4');
			const content = createTestVideoContent();

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, true);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.video).toBeDefined();
		});

		it('handles NSFW content when not allowed', async () => {
			const url = new URL('https://example.com/video.mp4');
			const content = createTestVideoContent();

			mediaService.setMetadata('base64', {nsfw: true});

			const embeds = await resolver.resolve(url, content, false);

			expect(embeds).toHaveLength(1);
		});

		it('handles animated video content', async () => {
			const url = new URL('https://example.com/animation.webm');
			const content = createTestVideoContent();

			mediaService.setMetadata('base64', {animated: true});

			const embeds = await resolver.resolve(url, content);

			expect(embeds).toHaveLength(1);
			expect(embeds[0]!.video).toBeDefined();
		});

		it('handles URLs with query parameters', async () => {
			const url = new URL('https://cdn.example.com/video.mp4?sig=abc123&exp=1234567890');
			const content = createTestVideoContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toBe('https://cdn.example.com/video.mp4?sig=abc123&exp=1234567890');
		});

		it('handles URLs with special characters', async () => {
			const url = new URL('https://example.com/my%20video%20(1).mp4');
			const content = createTestVideoContent();

			const embeds = await resolver.resolve(url, content);

			expect(embeds[0]!.url).toContain('my%20video');
		});
	});
});
