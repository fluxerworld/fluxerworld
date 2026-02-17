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

import {createBlueskyApiHandlers, createBlueskyPost} from '@fluxer/api/src/test/msw/handlers/BlueskyApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {BlueskyResolver} from '@fluxer/api/src/unfurler/resolvers/BlueskyResolver';
import {createMockContent, MockCacheService, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {MessageEmbedResponse as MessageEmbedResponseSchema} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {HttpResponse, http} from 'msw';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const TEST_DID = 'did:plc:testuser123';
const TEST_HANDLE = 'testuser.bsky.social';
const TEST_POST_ID = 'abc123xyz';
const TEST_POST_URI = `at://${TEST_DID}/app.bsky.feed.post/${TEST_POST_ID}`;
const TEST_POST_URL = `https://bsky.app/profile/${TEST_HANDLE}/post/${TEST_POST_ID}`;
const TEST_CREATED_AT = '2025-01-15T12:00:00.000Z';

describe('BlueskyResolver', () => {
	let mediaService: MockMediaService;
	let cacheService: MockCacheService;
	let resolver: BlueskyResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		cacheService = new MockCacheService();
		resolver = new BlueskyResolver(cacheService, mediaService);
	});

	afterEach(() => {
		mediaService.reset();
		cacheService.reset();
	});

	describe('match', () => {
		it('matches bsky.app HTML links', () => {
			const url = new URL('https://bsky.app/profile/handle.bsky.social/post/abc123');
			expect(resolver.match(url, 'text/html', createMockContent(''))).toBe(true);
		});

		it('does not match non-HTML content types', () => {
			const url = new URL('https://bsky.app/profile/handle.bsky.social');
			expect(resolver.match(url, 'application/json', createMockContent(''))).toBe(false);
		});

		it('does not match non-bsky domains', () => {
			const url = new URL('https://twitter.com/user/status/123');
			expect(resolver.match(url, 'text/html', createMockContent(''))).toBe(false);
		});
	});

	describe('resolve posts', () => {
		it('returns empty array for unsupported URLs', async () => {
			server.use(...createBlueskyApiHandlers({profiles: new Map()}));
			const embeds = await resolver.resolve(new URL('https://bsky.app/about'), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(0);
		});

		it('resolves external embeds without blockquote syntax', async () => {
			const handles = new Map([[TEST_HANDLE, TEST_DID]]);
			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						displayName: 'Test User',
						text: 'Check out this article!',
						createdAt: TEST_CREATED_AT,
						embed: {
							$type: 'app.bsky.embed.external#view',
							external: {
								uri: 'https://example.com/article',
								title: 'Amazing Article',
								description: 'This is a great article about testing.',
								thumb: 'https://cdn.bsky.app/img/thumb/external.jpg',
							},
						},
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));

			expect(embeds).toHaveLength(1);
			expect(embeds[0].description).toContain('Check out this article!');
			expect(embeds[0].description).toContain('[Amazing Article](https://example.com/article)');
			expect(embeds[0].description).not.toContain('> -#');
			expect(embeds[0].thumbnail?.url).toContain('cdn.bsky.app');
		});

		it('drops invalid author avatar URLs from embeds', async () => {
			const handles = new Map([[TEST_HANDLE, TEST_DID]]);
			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						displayName: 'Test User',
						avatar: 'not-a-valid-url',
						text: 'Avatar sanitisation test',
						createdAt: TEST_CREATED_AT,
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));

			expect(embeds).toHaveLength(1);
			expect(embeds[0]?.author).not.toHaveProperty('icon_url');
			expect(() => MessageEmbedResponseSchema.parse(embeds[0])).not.toThrow();
		});

		it('moves quoted posts into nested children', async () => {
			const quotedDid = 'did:plc:quoteduser456';
			const quotedHandle = 'quoteduser.bsky.social';
			const handles = new Map([
				[TEST_HANDLE, TEST_DID],
				[quotedHandle, quotedDid],
			]);

			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						displayName: 'Quote User',
						text: 'This is so true!',
						createdAt: TEST_CREATED_AT,
						repostCount: 8,
						quoteCount: 1,
						likeCount: 50,
						bookmarkCount: 7,
						embed: {
							$type: 'app.bsky.embed.recordWithMedia#view',
							record: {
								$type: 'app.bsky.embed.record#view',
								record: {
									$type: 'app.bsky.embed.record#viewRecord',
									uri: `at://${quotedDid}/app.bsky.feed.post/quoted123`,
									cid: 'quoted-cid',
									author: {
										did: quotedDid,
										handle: quotedHandle,
										displayName: 'Original Author',
									},
									value: {
										$type: 'app.bsky.feed.post',
										text: 'My original thought that got quoted.',
										createdAt: '2025-01-14T10:00:00.000Z',
									},
									repostCount: 4,
									quoteCount: 2,
									likeCount: 30,
									bookmarkCount: 3,
									embeds: [
										{
											$type: 'app.bsky.embed.external#view',
											external: {
												uri: 'https://example.com/quoted-link',
												title: 'Quoted link',
												description: 'Nested link preview',
												thumb: 'https://cdn.bsky.app/img/thumb/quoted.jpg',
											},
										},
									],
									indexedAt: '2025-01-14T10:00:00.000Z',
								},
							},
						},
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));

			expect(embeds).toHaveLength(1);
			const root = embeds[0];
			expect(root.description).toContain('This is so true!');
			expect(root.description).not.toContain('My original thought that got quoted.');
			expect(root.children).toBeDefined();
			expect(root.children).toHaveLength(1);

			const child = root.children?.[0];
			expect(child?.type).toBe('bluesky');
			expect(child?.author?.name).toBe('Original Author (@quoteduser.bsky.social)');
			expect(child?.description).toContain('My original thought that got quoted.');
			expect(child?.description).toContain('[Quoted link](https://example.com/quoted-link)');
			expect(child?.thumbnail?.url).toContain('cdn.bsky.app');
			expect(child?.title).toBeUndefined();
			expect(child?.fields).toBeUndefined();
			expect(child?.timestamp).toBeUndefined();
			expect(child?.footer).toBeUndefined();
		});

		it('resolves image galleries as root + additional gallery embeds', async () => {
			const handles = new Map([[TEST_HANDLE, TEST_DID]]);
			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						text: 'Photo gallery!',
						createdAt: TEST_CREATED_AT,
						embed: {
							$type: 'app.bsky.embed.images#view',
							images: [
								{
									thumb: 'https://cdn.bsky.app/img/1.jpg',
									fullsize: 'https://cdn.bsky.app/img/1.jpg',
									alt: 'First image',
								},
								{
									thumb: 'https://cdn.bsky.app/img/2.jpg',
									fullsize: 'https://cdn.bsky.app/img/2.jpg',
									alt: 'Second image',
								},
								{
									thumb: 'https://cdn.bsky.app/img/3.jpg',
									fullsize: 'https://cdn.bsky.app/img/3.jpg',
									alt: 'Third image',
								},
							],
						},
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(3);
			expect(embeds[0].image?.description).toBe('First image');
			expect(embeds[1].type).toBe('rich');
			expect(embeds[2].type).toBe('rich');
		});

		it('adds reply context to root post descriptions', async () => {
			const parentDid = 'did:plc:parentuser';
			const parentHandle = 'parentuser.bsky.social';
			const parentPostId = 'parent123';
			const parentUri = `at://${parentDid}/app.bsky.feed.post/${parentPostId}`;

			const handles = new Map([
				[TEST_HANDLE, TEST_DID],
				[parentHandle, parentDid],
			]);

			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						displayName: 'Reply User',
						text: 'I agree with this take!',
						createdAt: TEST_CREATED_AT,
						parent: {
							did: parentDid,
							handle: parentHandle,
							displayName: 'Parent Author',
							uri: parentUri,
							text: 'This is the parent post content.',
						},
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(1);
			expect(embeds[0].description).toContain('-#');
			expect(embeds[0].description).toContain('Parent Author');
			expect(embeds[0].description).toContain('@parentuser.bsky.social');
		});

		it('adds engagement fields for non-zero counts', async () => {
			const handles = new Map([[TEST_HANDLE, TEST_DID]]);
			const posts = new Map([
				[
					TEST_POST_URI,
					createBlueskyPost({
						uri: TEST_POST_URI,
						did: TEST_DID,
						handle: TEST_HANDLE,
						text: 'Popular post!',
						createdAt: TEST_CREATED_AT,
						repostCount: 500,
						likeCount: 1500,
						quoteCount: 150,
						bookmarkCount: 1199,
					}),
				],
			]);

			server.use(...createBlueskyApiHandlers({handles, posts}));

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(1);
			expect(embeds[0].fields).toHaveLength(4);
			expect(embeds[0].fields?.find((field) => field.name === 'likeCount')?.value).toBe('1.5K');
			expect(embeds[0].fields?.find((field) => field.name === 'bookmarkCount')?.value).toBe('1.2K');
		});
	});

	describe('resolve profile URLs', () => {
		it('resolves profile links', async () => {
			const profiles = new Map([
				[
					TEST_HANDLE,
					{
						did: TEST_DID,
						handle: TEST_HANDLE,
						displayName: 'Test User',
						description: 'A test account',
						indexedAt: TEST_CREATED_AT,
					},
				],
			]);
			server.use(...createBlueskyApiHandlers({profiles}));

			const embeds = await resolver.resolve(
				new URL(`https://bsky.app/profile/${TEST_HANDLE}`),
				createMockContent('<html></html>'),
			);
			expect(embeds).toHaveLength(1);
			expect(embeds[0].title).toBe('Test User (@testuser.bsky.social)');
		});
	});

	describe('error handling', () => {
		it('returns empty array when handle resolution fails', async () => {
			server.use(
				http.get('https://api.bsky.app/xrpc/com.atproto.identity.resolveHandle', () => {
					return HttpResponse.json({error: 'Handle not found'}, {status: 404});
				}),
			);

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(0);
		});

		it('returns empty array when post fetch fails', async () => {
			const handles = new Map([[TEST_HANDLE, TEST_DID]]);
			server.use(
				...createBlueskyApiHandlers({handles, posts: new Map()}),
				http.get('https://api.bsky.app/xrpc/app.bsky.feed.getPostThread', () => {
					return HttpResponse.json({error: 'Post not found'}, {status: 404});
				}),
			);

			const embeds = await resolver.resolve(new URL(TEST_POST_URL), createMockContent('<html></html>'));
			expect(embeds).toHaveLength(0);
		});
	});
});
