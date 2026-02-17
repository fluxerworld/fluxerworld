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

import type {
	BlueskyPostEmbed,
	BlueskyPostThread,
	BlueskyProfile,
} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTypes';
import {HttpResponse, http} from 'msw';

const API_BASES = ['https://api.bsky.app/xrpc', 'https://public.api.bsky.app/xrpc'];

export interface BlueskyApiMockConfig {
	handles?: Map<string, string>;
	posts?: Map<string, BlueskyPostThread>;
	profiles?: Map<string, BlueskyProfile>;
	profileDescriptions?: Map<string, string>;
	error404Handles?: Set<string>;
	error404Profiles?: Set<string>;
	error500?: boolean;
}

export function createBlueskyApiHandlers(config: BlueskyApiMockConfig = {}) {
	const handles = config.handles ?? new Map();
	const posts = config.posts ?? new Map();
	const profiles = config.profiles ?? new Map();
	const profileDescriptions = config.profileDescriptions ?? new Map();
	const error404Handles = config.error404Handles ?? new Set();
	const error404Profiles = config.error404Profiles ?? new Set();
	const error500 = config.error500 ?? false;

	const handlers = [];

	for (const API_BASE of API_BASES) {
		handlers.push(
			http.get(`${API_BASE}/com.atproto.identity.resolveHandle`, ({request}) => {
				if (error500) {
					return HttpResponse.json({error: 'Internal server error'}, {status: 500});
				}

				const url = new URL(request.url);
				const handle = url.searchParams.get('handle');

				if (!handle) {
					return HttpResponse.json({error: 'Missing handle parameter'}, {status: 400});
				}

				if (error404Handles.has(handle)) {
					return HttpResponse.json({error: 'Handle not found'}, {status: 404});
				}

				const did = handles.get(handle);
				if (!did) {
					return HttpResponse.json({error: 'Handle not found'}, {status: 404});
				}

				return HttpResponse.json({did});
			}),
		);

		handlers.push(
			http.get(`${API_BASE}/app.bsky.feed.getPostThread`, ({request}) => {
				const url = new URL(request.url);
				const uri = url.searchParams.get('uri');

				if (!uri) {
					return HttpResponse.json({error: 'Missing uri parameter'}, {status: 400});
				}

				const thread = posts.get(uri);
				if (!thread) {
					return HttpResponse.json({error: 'Post not found'}, {status: 404});
				}

				return HttpResponse.json(thread);
			}),
		);

		handlers.push(
			http.get(`${API_BASE}/app.bsky.actor.getProfile`, ({request}) => {
				if (error500) {
					return HttpResponse.json({error: 'Internal server error'}, {status: 500});
				}

				const url = new URL(request.url);
				const actor = url.searchParams.get('actor');

				if (!actor) {
					return HttpResponse.json({error: 'Missing actor parameter'}, {status: 400});
				}

				if (error404Profiles.has(actor)) {
					return HttpResponse.json({error: 'Profile not found'}, {status: 404});
				}

				let profile = profiles.get(actor);
				if (!profile) {
					const description = profileDescriptions.get(actor);
					if (description) {
						profile = {
							did: actor,
							handle: actor,
							description,
						};
					} else {
						return HttpResponse.json({error: 'Profile not found'}, {status: 404});
					}
				}

				return HttpResponse.json(profile);
			}),
		);
	}

	handlers.push(
		http.get('https://plc.directory/*', () => {
			return HttpResponse.json({
				service: [{type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://bsky.social'}],
			});
		}),
	);

	return handlers;
}

export function createBlueskyPost(options: {
	uri: string;
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
	text: string;
	createdAt?: string;
	embed?: BlueskyPostEmbed;
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
	quoteCount?: number;
	bookmarkCount?: number;
	parent?: {
		did: string;
		handle: string;
		displayName?: string;
		uri: string;
		text: string;
	};
}): BlueskyPostThread {
	const post: BlueskyPostThread['thread']['post'] = {
		uri: options.uri,
		author: {
			did: options.did,
			handle: options.handle,
			displayName: options.displayName,
			avatar: options.avatar,
		},
		record: {
			text: options.text,
			createdAt: options.createdAt ?? new Date().toISOString(),
			reply: options.parent
				? {
						parent: {uri: options.parent.uri, cid: 'parent-cid'},
						root: {uri: options.parent.uri, cid: 'root-cid'},
					}
				: undefined,
		},
		embed: options.embed,
		indexedAt: options.createdAt ?? new Date().toISOString(),
		replyCount: options.replyCount ?? 0,
		repostCount: options.repostCount ?? 0,
		likeCount: options.likeCount ?? 0,
		quoteCount: options.quoteCount ?? 0,
		bookmarkCount: options.bookmarkCount ?? 0,
	};

	const thread: BlueskyPostThread = {
		thread: {
			post,
			parent: options.parent
				? {
						post: {
							uri: options.parent.uri,
							author: {
								did: options.parent.did,
								handle: options.parent.handle,
								displayName: options.parent.displayName,
							},
							record: {
								text: options.parent.text,
								createdAt: new Date().toISOString(),
							},
							indexedAt: new Date().toISOString(),
							replyCount: 0,
							repostCount: 0,
							likeCount: 0,
							quoteCount: 0,
							bookmarkCount: 0,
						},
					}
				: undefined,
		},
	};

	return thread;
}
