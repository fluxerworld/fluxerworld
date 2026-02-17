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
import {ActivityPubResolver} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubResolver';
import {MockCacheService, MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {
	MessageEmbedChildResponse,
	MessageEmbedResponse as MessageEmbedResponseSchema,
} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {HttpResponse, http} from 'msw';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('ActivityPubResolver', () => {
	let mediaService: MockMediaService;
	let cacheService: MockCacheService;
	let resolver: ActivityPubResolver;

	beforeEach(() => {
		mediaService = new MockMediaService();
		cacheService = new MockCacheService();
		resolver = new ActivityPubResolver(cacheService, mediaService);
	});

	afterEach(() => {
		mediaService.reset();
		cacheService.reset();
	});

	it('resolves media galleries, reply labels, and quote child embeds from ActivityPub JSON', async () => {
		const postUrl = new URL('https://infosec.exchange/@SwiftOnSecurity/115561371389489150');
		const parentPostUrl = 'https://infosec.exchange/users/SwiftOnSecurity/statuses/115561339842883224';
		const quotePostUrl = 'https://tldr.nettime.org/@tante/116024418338054881';

		server.use(
			http.get('https://infosec.exchange/api/v2/instance', () => {
				return HttpResponse.json({
					domain: 'infosec.exchange',
					title: 'Infosec Exchange',
				});
			}),
			http.get('https://tldr.nettime.org/api/v2/instance', () => {
				return HttpResponse.json({
					domain: 'tldr.nettime.org',
					title: 'TLDR',
				});
			}),
			http.get(postUrl.href, () => {
				return HttpResponse.json({
					id: 'https://infosec.exchange/users/SwiftOnSecurity/statuses/115561371389489150',
					type: 'Note',
					url: postUrl.href,
					published: '2025-11-16T20:56:29Z',
					attributedTo: {
						id: 'https://infosec.exchange/users/SwiftOnSecurity',
						type: 'Person',
						name: 'SwiftOnSecurity',
						preferredUsername: 'SwiftOnSecurity',
						url: 'https://infosec.exchange/@SwiftOnSecurity',
						icon: {
							type: 'Image',
							mediaType: 'image/jpeg',
							url: 'https://media.infosec.exchange/accounts/swiftonsecurity.jpeg',
						},
					},
					inReplyTo: parentPostUrl,
					content: '<p>New computer who dis</p>',
					quote: quotePostUrl,
					attachment: [
						{
							type: 'Document',
							mediaType: 'image/jpeg',
							url: 'https://media.infosec.exchange/1.jpeg',
							name: 'Fractal Pop Air computer case with Noctua cooler and 4090',
							width: 2494,
							height: 3325,
						},
						{
							type: 'Document',
							mediaType: 'image/jpeg',
							url: 'https://media.infosec.exchange/2.jpeg',
							name: null,
							width: 2239,
							height: 3704,
						},
						{
							type: 'Document',
							mediaType: 'image/jpeg',
							url: 'https://media.infosec.exchange/3.jpeg',
							name: null,
							width: 2494,
							height: 3325,
						},
					],
				});
			}),
			http.get(parentPostUrl, () => {
				return HttpResponse.json({
					id: parentPostUrl,
					type: 'Note',
					url: parentPostUrl,
					published: '2025-11-16T20:50:00Z',
					attributedTo: {
						id: 'https://infosec.exchange/users/SwiftOnSecurity',
						type: 'Person',
						name: 'SwiftOnSecurity',
						preferredUsername: 'SwiftOnSecurity',
						url: 'https://infosec.exchange/@SwiftOnSecurity',
					},
					content: '<p>Parent post</p>',
				});
			}),
			http.get(quotePostUrl, () => {
				return HttpResponse.json({
					id: 'https://tldr.nettime.org/users/tante/statuses/116024418338054881',
					type: 'Note',
					url: quotePostUrl,
					published: '2026-02-06T15:50:00Z',
					attributedTo: {
						id: 'https://tldr.nettime.org/users/tante',
						type: 'Person',
						name: 'tante',
						preferredUsername: 'tante',
						url: 'https://tldr.nettime.org/@tante',
					},
					content: '<p>Quoted post body</p>',
				});
			}),
		);

		const embeds = await resolver.resolveActivityPub(postUrl, postUrl.href, '<html></html>');

		expect(embeds).toBeTruthy();
		expect(embeds).toHaveLength(3);
		expect(embeds?.[0]?.description).toContain(
			'-# ↩ [@SwiftOnSecurity@infosec.exchange](https://infosec.exchange/@SwiftOnSecurity)',
		);
		expect(embeds?.[0]?.description).toContain('New computer who dis');
		expect(embeds?.[0]?.image?.description).toBe('Fractal Pop Air computer case with Noctua cooler and 4090');
		expect(embeds?.[1]?.image?.url).toBe('https://media.infosec.exchange/2.jpeg');
		expect(embeds?.[2]?.image?.url).toBe('https://media.infosec.exchange/3.jpeg');

		const childEmbed = embeds?.[0]?.children?.[0];
		expect(childEmbed?.description).toContain('Quoted post body');
		expect(childEmbed?.timestamp).toBeUndefined();
		expect(childEmbed?.footer).toBeUndefined();
		expect(childEmbed?.fields).toBeUndefined();
		for (const embed of embeds ?? []) {
			expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
			for (const child of embed.children ?? []) {
				expect(() => MessageEmbedChildResponse.parse(child)).not.toThrow();
			}
		}
	});

	it('sanitises invalid author and server icon URLs from ActivityPub payloads', async () => {
		const postUrl = new URL('https://infosec.exchange/@alice/1');

		server.use(
			http.get('https://infosec.exchange/api/v2/instance', () => {
				return HttpResponse.json({
					domain: 'infosec.exchange',
					title: 'Remote Example',
					thumbnail: {url: 'not-a-valid-url'},
				});
			}),
			http.get(postUrl.href, () => {
				return HttpResponse.json({
					id: 'https://infosec.exchange/users/alice/statuses/1',
					type: 'Note',
					url: postUrl.href,
					published: '2026-02-16T20:56:29Z',
					attributedTo: {
						id: 'https://infosec.exchange/users/alice',
						type: 'Person',
						name: 'Alice',
						preferredUsername: 'alice',
						url: 'not-a-valid-url',
						icon: {
							type: 'Image',
							mediaType: 'image/jpeg',
							url: 'not-a-valid-url',
						},
					},
					content: '<p>Sanitisation test</p>',
				});
			}),
		);

		const embeds = await resolver.resolveActivityPub(postUrl, postUrl.href, '<html></html>');

		expect(embeds).toHaveLength(1);
		expect(embeds?.[0]?.author).not.toHaveProperty('url');
		expect(embeds?.[0]?.author).not.toHaveProperty('icon_url');
		expect(embeds?.[0]?.footer).toBeDefined();
		expect(embeds?.[0]?.footer).not.toHaveProperty('icon_url');
		expect(() => MessageEmbedResponseSchema.parse(embeds?.[0])).not.toThrow();
	});
});
