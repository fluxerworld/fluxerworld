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

import type {BlueskyApiClient} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyApiClient';
import {BlueskyEmbedProcessor} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyEmbedProcessor';
import {BlueskyTextFormatter} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTextFormatter';
import type {BlueskyPost, Facet} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTypes';
import {MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function createMockApiClient(): BlueskyApiClient {
	return {
		resolveDid: async () => 'did:plc:test',
		getServiceEndpoint: async () => 'https://bsky.social',
		fetchPost: async () => null,
		fetchProfile: async () => null,
	} as unknown as BlueskyApiClient;
}

function createTestPost(overrides: Partial<BlueskyPost> = {}): BlueskyPost {
	return {
		uri: 'at://did:plc:test/app.bsky.feed.post/abc123',
		author: {
			did: 'did:plc:test',
			handle: 'testuser.bsky.social',
			displayName: 'Test User',
			avatar: 'https://cdn.bsky.app/avatar/test.jpg',
		},
		record: {
			text: 'Test post content',
			createdAt: new Date().toISOString(),
		},
		indexedAt: new Date().toISOString(),
		replyCount: 0,
		repostCount: 0,
		likeCount: 0,
		quoteCount: 0,
		...overrides,
	};
}

describe('BlueskyEmbedProcessor', () => {
	let mediaService: MockMediaService;
	let apiClient: BlueskyApiClient;
	let processor: BlueskyEmbedProcessor;

	beforeEach(() => {
		mediaService = new MockMediaService();
		apiClient = createMockApiClient();
		processor = new BlueskyEmbedProcessor(mediaService, apiClient);
	});

	afterEach(() => {
		mediaService.reset();
	});

	describe('processPostEmbed', () => {
		it('processes external embed as structured metadata', async () => {
			const post = createTestPost({
				embed: {
					$type: 'app.bsky.embed.external#view',
					external: {
						uri: 'https://example.com/article',
						title: 'Example Article Title',
						description: 'This is the article description.',
						thumb: 'https://cdn.bsky.app/img/thumb/test.jpg',
					},
				},
			});

			const result = await processor.processPostEmbed(post, false);

			expect(result.external?.uri).toBe('https://example.com/article');
			expect(result.external?.title).toBe('Example Article Title');
			expect(result.external?.description).toBe('This is the article description.');
			expect(result.thumbnail?.url).toBe('https://cdn.bsky.app/img/thumb/test.jpg');
		});

		it('processes multiple images as gallery', async () => {
			const post = createTestPost({
				embed: {
					$type: 'app.bsky.embed.images#view',
					images: [
						{
							thumb: 'https://cdn.bsky.app/img/thumb/img1.jpg',
							fullsize: 'https://cdn.bsky.app/img/full/img1.jpg',
						},
						{
							thumb: 'https://cdn.bsky.app/img/thumb/img2.jpg',
							fullsize: 'https://cdn.bsky.app/img/full/img2.jpg',
						},
						{
							thumb: 'https://cdn.bsky.app/img/thumb/img3.jpg',
							fullsize: 'https://cdn.bsky.app/img/full/img3.jpg',
						},
					],
				},
			});

			const result = await processor.processPostEmbed(post, false);

			expect(result.image?.url).toBe('https://cdn.bsky.app/img/full/img1.jpg');
			expect(result.galleryImages).toHaveLength(2);
			expect(result.galleryImages?.[0]?.url).toBe('https://cdn.bsky.app/img/full/img2.jpg');
			expect(result.galleryImages?.[1]?.url).toBe('https://cdn.bsky.app/img/full/img3.jpg');
		});

		it('returns empty result when post has no embed', async () => {
			const post = createTestPost();
			const result = await processor.processPostEmbed(post, false);

			expect(result.image).toBeUndefined();
			expect(result.thumbnail).toBeUndefined();
			expect(result.video).toBeUndefined();
			expect(result.external).toBeUndefined();
			expect(result.galleryImages).toBeUndefined();
		});
	});

	describe('processEmbeddedPost', () => {
		it('extracts quoted post and embedded media metadata', async () => {
			const post = createTestPost({
				embed: {
					$type: 'app.bsky.embed.recordWithMedia#view',
					record: {
						$type: 'app.bsky.embed.record#view',
						record: {
							$type: 'app.bsky.embed.record#viewRecord',
							uri: 'at://did:plc:quoted/app.bsky.feed.post/quoted123',
							cid: 'quoted-cid',
							author: {
								did: 'did:plc:quoted',
								handle: 'quoteduser.bsky.social',
								displayName: 'Quoted User',
							},
							value: {
								$type: 'app.bsky.feed.post',
								text: 'Original post content here.',
								createdAt: '2026-02-05T10:00:00.000Z',
							},
							replyCount: 2,
							repostCount: 3,
							likeCount: 7,
							quoteCount: 1,
							bookmarkCount: 5,
							embeds: [
								{
									$type: 'app.bsky.embed.external#view',
									external: {
										uri: 'https://example.com/quoted-link',
										title: 'Quoted Link',
										description: 'Extra context from the quoted post.',
										thumb: 'https://cdn.bsky.app/img/thumb/quoted.jpg',
									},
								},
							],
							indexedAt: '2026-02-05T10:00:00.000Z',
						},
					},
				},
			});

			const result = await processor.processEmbeddedPost(post, false);

			expect(result?.uri).toBe('at://did:plc:quoted/app.bsky.feed.post/quoted123');
			expect(result?.author.handle).toBe('quoteduser.bsky.social');
			expect(result?.text).toBe('Original post content here.');
			expect(result?.likeCount).toBe(7);
			expect(result?.embed?.external?.uri).toBe('https://example.com/quoted-link');
			expect(result?.embed?.thumbnail?.url).toBe('https://cdn.bsky.app/img/thumb/quoted.jpg');
		});

		it('returns undefined when there is no quoted post record', async () => {
			const post = createTestPost({
				embed: {
					$type: 'app.bsky.embed.images#view',
					images: [
						{thumb: 'https://cdn.bsky.app/img/thumb/test.jpg', fullsize: 'https://cdn.bsky.app/img/full/test.jpg'},
					],
				},
			});

			const result = await processor.processEmbeddedPost(post, false);
			expect(result).toBeUndefined();
		});
	});

	describe('BlueskyResolver.formatCount', () => {
		let BlueskyResolver: typeof import('@fluxer/api/src/unfurler/resolvers/BlueskyResolver').BlueskyResolver;

		beforeEach(async () => {
			const module = await import('@fluxer/api/src/unfurler/resolvers/BlueskyResolver');
			BlueskyResolver = module.BlueskyResolver;
		});

		it('returns count as-is for values less than 1000', () => {
			expect(BlueskyResolver.formatCount(8)).toBe('8');
			expect(BlueskyResolver.formatCount(999)).toBe('999');
			expect(BlueskyResolver.formatCount(0)).toBe('0');
		});

		it('formats counts between 1000-9999 with one decimal place', () => {
			expect(BlueskyResolver.formatCount(1234)).toBe('1.2K');
			expect(BlueskyResolver.formatCount(5678)).toBe('5.7K');
			expect(BlueskyResolver.formatCount(1000)).toBe('1.0K');
			expect(BlueskyResolver.formatCount(9999)).toBe('10.0K');
		});

		it('formats counts 10000+ as whole number K suffix', () => {
			expect(BlueskyResolver.formatCount(10000)).toBe('10K');
			expect(BlueskyResolver.formatCount(29000)).toBe('29K');
			expect(BlueskyResolver.formatCount(123456)).toBe('123K');
		});
	});

	describe('BlueskyTextFormatter', () => {
		let textFormatter: BlueskyTextFormatter;

		beforeEach(() => {
			textFormatter = new BlueskyTextFormatter();
		});

		it('truncates deep paths in link display text', () => {
			const result = textFormatter.getLinkDisplayText('https://github.com/microsoft/TypeScript/issues/63085');
			expect(result).toBe('github.com/microsoft/Ty...');
		});

		it('replaces link facets with markdown links', () => {
			const text = 'Check this out github.com/microsoft/Ty...';
			const facets: Array<Facet> = [
				{
					features: [
						{$type: 'app.bsky.richtext.facet#link', uri: 'https://github.com/microsoft/TypeScript/issues/63085'},
					],
					index: {byteStart: 15, byteEnd: 41},
				},
			];

			const result = textFormatter.embedLinksInText(text, facets);

			expect(result).toBe(
				'Check this out [github.com/microsoft/Ty...](https://github.com/microsoft/TypeScript/issues/63085)',
			);
		});
	});
});
