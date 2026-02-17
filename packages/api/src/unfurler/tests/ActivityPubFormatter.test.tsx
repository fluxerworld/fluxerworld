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

import {ActivityPubFormatter} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubFormatter';
import type {
	ActivityPubAuthor,
	ActivityPubContext,
	ActivityPubPost,
} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubTypes';
import {MockMediaService} from '@fluxer/api/src/unfurler/tests/ResolverTestUtils';
import {MessageEmbedResponse as MessageEmbedResponseSchema} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {describe, expect, it} from 'vitest';

function createContext(overrides: Partial<ActivityPubContext> = {}): ActivityPubContext {
	return {
		serverDomain: 'example.com',
		serverName: 'example',
		serverTitle: 'Example Server',
		...overrides,
	};
}

function createPost(overrides: Partial<ActivityPubPost> = {}): ActivityPubPost {
	return {
		id: 'https://remote.example/users/alice/statuses/1',
		type: 'Note',
		url: 'https://remote.example/@alice/1',
		published: '2026-02-16T09:00:00.000Z',
		attributedTo: 'https://remote.example/users/alice',
		content: '<p>Hello world</p>',
		...overrides,
	};
}

function createFetchedAuthorData(
	options: {iconUrl?: string; authorName?: string; preferredUsername?: string; authorUrl?: string} = {},
): ActivityPubPost & ActivityPubAuthor {
	const authorUrl = options.authorUrl ?? 'https://remote.example/@alice';
	return {
		id: 'https://remote.example/users/alice',
		type: 'Person',
		url: authorUrl,
		published: '2026-02-16T09:00:00.000Z',
		attributedTo: authorUrl,
		content: '',
		name: options.authorName ?? 'Alice',
		preferredUsername: options.preferredUsername ?? 'alice',
		...(options.iconUrl !== undefined
			? {
					icon: {
						type: 'Image',
						mediaType: 'image/png',
						url: options.iconUrl,
					},
				}
			: {}),
	};
}

describe('ActivityPubFormatter', () => {
	it('omits empty icon URLs when author and server icons are missing', async () => {
		const formatter = new ActivityPubFormatter(new MockMediaService());
		const post = createPost();
		const context = createContext({serverIcon: ''});

		const embed = await formatter.buildActivityPubEmbed(post, new URL(post.url), context, async () => null);

		expect(embed.author).toBeDefined();
		expect(embed.author?.url).toBe('https://remote.example/users/alice');
		expect(embed.author).not.toHaveProperty('icon_url');
		expect(embed.footer).toBeDefined();
		expect(embed.footer).not.toHaveProperty('icon_url');
		expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
	});

	it('omits invalid icon URLs from author and footer', async () => {
		const formatter = new ActivityPubFormatter(new MockMediaService());
		const post = createPost();
		const context = createContext({serverIcon: 'not-a-url'});
		const fetchedAuthorData = createFetchedAuthorData({iconUrl: 'not-a-url', authorUrl: 'not-a-url'});

		const embed = await formatter.buildActivityPubEmbed(
			post,
			new URL(post.url),
			context,
			async () => fetchedAuthorData,
		);

		expect(embed.author).toBeDefined();
		expect(embed.author).not.toHaveProperty('url');
		expect(embed.author).not.toHaveProperty('icon_url');
		expect(embed.footer).toBeDefined();
		expect(embed.footer).not.toHaveProperty('icon_url');
		expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
	});

	it('omits an empty author icon URL from object attributedTo payloads', async () => {
		const formatter = new ActivityPubFormatter(new MockMediaService());
		const post = createPost({
			attributedTo: {
				id: 'https://remote.example/users/alice',
				type: 'Person',
				name: 'Alice',
				preferredUsername: 'alice',
				url: 'https://remote.example/@alice',
				icon: {
					type: 'Image',
					mediaType: 'image/png',
					url: '',
				},
			},
		});
		const context = createContext();

		const embed = await formatter.buildActivityPubEmbed(post, new URL(post.url), context, async () => null);

		expect(embed.author).toBeDefined();
		expect(embed.author).not.toHaveProperty('icon_url');
		expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
	});

	it('omits an invalid author url from object attributedTo payloads', async () => {
		const formatter = new ActivityPubFormatter(new MockMediaService());
		const post = createPost({
			attributedTo: {
				id: 'https://remote.example/users/alice',
				type: 'Person',
				name: 'Alice',
				preferredUsername: 'alice',
				url: 'not-a-url',
			},
		});
		const context = createContext();

		const embed = await formatter.buildActivityPubEmbed(post, new URL(post.url), context, async () => null);

		expect(embed.author).toBeDefined();
		expect(embed.author).not.toHaveProperty('url');
		expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
	});

	it('keeps valid icon URLs for author and footer', async () => {
		const formatter = new ActivityPubFormatter(new MockMediaService());
		const post = createPost();
		const context = createContext({serverIcon: 'https://remote.example/server-icon.png'});
		const fetchedAuthorData = createFetchedAuthorData({iconUrl: 'https://remote.example/avatar.png'});

		const embed = await formatter.buildActivityPubEmbed(
			post,
			new URL(post.url),
			context,
			async () => fetchedAuthorData,
		);

		expect(embed.author?.url).toBe('https://remote.example/@alice');
		expect(embed.author?.icon_url).toBe('https://remote.example/avatar.png');
		expect(embed.footer?.icon_url).toBe('https://remote.example/server-icon.png');
		expect(() => MessageEmbedResponseSchema.parse(embed)).not.toThrow();
	});
});
