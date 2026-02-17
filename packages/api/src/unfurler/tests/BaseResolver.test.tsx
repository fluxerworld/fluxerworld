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

import {BaseResolver} from '@fluxer/api/src/unfurler/resolvers/BaseResolver';
import {MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

class TestableResolver extends BaseResolver {
	match(_url: URL, _mimeType: string, _content: Uint8Array): boolean {
		return true;
	}

	async resolve(_url: URL, _content: Uint8Array, _isNSFWAllowed?: boolean): Promise<Array<MessageEmbedResponse>> {
		return [];
	}

	testResolveRelativeURL(baseUrl: string, relativeUrl?: string): string | null {
		return this.resolveRelativeURL(baseUrl, relativeUrl);
	}

	async testResolveMediaURL(
		url: URL,
		mediaUrl?: string | null,
		isNSFWAllowed: boolean = false,
	): Promise<MessageEmbedResponse['image']> {
		return this.resolveMediaURL(url, mediaUrl, isNSFWAllowed);
	}
}

describe('BaseResolver', () => {
	let mediaService: MockMediaService;
	let resolver: TestableResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		resolver = new TestableResolver(mediaService);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('resolveRelativeURL', () => {
		it('resolves relative paths correctly', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', '../image.jpg');
			expect(result).toBe('https://example.com/image.jpg');
		});

		it('resolves absolute paths correctly', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', '/images/photo.jpg');
			expect(result).toBe('https://example.com/images/photo.jpg');
		});

		it('preserves full URLs', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', 'https://cdn.example.com/image.jpg');
			expect(result).toBe('https://cdn.example.com/image.jpg');
		});

		it('handles protocol-relative URLs', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', '//cdn.example.com/image.jpg');
			expect(result).toBe('https://cdn.example.com/image.jpg');
		});

		it('returns null for undefined input', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/', undefined);
			expect(result).toBeNull();
		});

		it('returns null for empty string input', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/', '');
			expect(result).toBeNull();
		});

		it('handles URLs with query parameters', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', 'image.jpg?v=123');
			expect(result).toBe('https://example.com/page/image.jpg?v=123');
		});

		it('handles URLs with fragments', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page/', 'image.jpg#section');
			expect(result).toBe('https://example.com/page/image.jpg#section');
		});

		it('handles complex relative paths', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/a/b/c/', '../../d/image.jpg');
			expect(result).toBe('https://example.com/a/d/image.jpg');
		});

		it('handles base URL without trailing slash', () => {
			const result = resolver.testResolveRelativeURL('https://example.com/page', 'image.jpg');
			expect(result).toBe('https://example.com/image.jpg');
		});

		it('handles data URLs by returning as-is', () => {
			const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
			const result = resolver.testResolveRelativeURL('https://example.com/', dataUrl);
			expect(result).toBe(dataUrl);
		});

		it('returns original URL for invalid base URLs', () => {
			const result = resolver.testResolveRelativeURL('not-a-url', 'image.jpg');
			expect(result).toBe('image.jpg');
		});
	});

	describe('resolveMediaURL', () => {
		it('returns null for null media URL', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, null);
			expect(result).toBeNull();
		});

		it('returns null for undefined media URL', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, undefined);
			expect(result).toBeNull();
		});

		it('returns null for empty string media URL', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, '');
			expect(result).toBeNull();
		});

		it('resolves valid external media URL', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg');
			expect(result).not.toBeNull();
			expect(result!.url).toBe('https://example.com/image.jpg');
		});

		it('resolves relative media URL', async () => {
			const url = new URL('https://example.com/page/');
			const result = await resolver.testResolveMediaURL(url, 'image.jpg');
			expect(result).not.toBeNull();
			expect(result!.url).toBe('https://example.com/page/image.jpg');
		});

		it('includes width and height in result', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/image.jpg', {
				width: 800,
				height: 600,
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg');
			expect(result).not.toBeNull();
			expect(result!.width).toBe(800);
			expect(result!.height).toBe(600);
		});

		it('includes content_type in result', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/image.jpg', {
				content_type: 'image/jpeg',
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg');
			expect(result).not.toBeNull();
			expect(result!.content_type).toBe('image/jpeg');
		});

		it('includes content_hash in result', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg');
			expect(result).not.toBeNull();
			expect(result!.content_hash).toBeDefined();
		});

		it('includes placeholder in result when available', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/image.jpg', {
				placeholder: 'data:image/jpeg;base64,/9j/4AAQ...',
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg');
			expect(result).not.toBeNull();
			expect(result!.placeholder).toBe('data:image/jpeg;base64,/9j/4AAQ...');
		});

		it('passes NSFW flag to media service', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image.jpg', true);
			expect(result).not.toBeNull();
		});

		it('returns null when media service fails', async () => {
			const url = new URL('https://example.com/page');
			mediaService.markAsFailing('https://example.com/broken.jpg');

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/broken.jpg');
			expect(result).toBeNull();
		});

		it('handles URL-like strings that get resolved as relative paths', async () => {
			const url = new URL('https://example.com/page/');
			const result = await resolver.testResolveMediaURL(url, 'not a valid url at all');
			expect(result).not.toBeNull();
			expect(result!.url).toBe('https://example.com/page/not%20a%20valid%20url%20at%20all');
		});

		it('handles URLs with special characters', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, 'https://example.com/image%20name.jpg');
			expect(result).not.toBeNull();
			expect(result!.url).toBe('https://example.com/image%20name.jpg');
		});

		it('handles URLs with unicode characters', async () => {
			const url = new URL('https://example.com/page');
			const result = await resolver.testResolveMediaURL(url, 'https://example.com/%E7%94%BB%E5%83%8F.jpg');
			expect(result).not.toBeNull();
		});

		it('handles duration in result for video/audio', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/video.mp4', {
				duration: 120.5,
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/video.mp4');
			expect(result).not.toBeNull();
			expect(result!.duration).toBe(120.5);
		});

		it('sets animated flag in result', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/animation.gif', {
				animated: true,
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/animation.gif');
			expect(result).not.toBeNull();
			expect((result!.flags ?? 0) & 32).toBe(32);
		});

		it('sets NSFW flag in result when content is NSFW', async () => {
			const url = new URL('https://example.com/page');
			mediaService.setMetadata('https://example.com/nsfw.jpg', {
				nsfw: true,
			});

			const result = await resolver.testResolveMediaURL(url, 'https://example.com/nsfw.jpg', true);
			expect(result).not.toBeNull();
			expect((result!.flags ?? 0) & 16).toBe(16);
		});
	});
});
