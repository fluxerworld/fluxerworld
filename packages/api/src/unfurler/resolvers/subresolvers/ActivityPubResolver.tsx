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

import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {Logger} from '@fluxer/api/src/Logger';
import {ActivityPubFetcher} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubFetcher';
import {ActivityPubFormatter} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubFormatter';
import type {
	ActivityPubContext,
	ActivityPubPost,
	MastodonPost,
} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubTypes';
import {extractAppleTouchIcon, extractPostId} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubUtils';
import * as DOMUtils from '@fluxer/api/src/utils/DOMUtils';
import * as FetchUtils from '@fluxer/api/src/utils/FetchUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {ms} from 'itty-time';

interface ResolveActivityPubOptions {
	maxActivityPubRedirects?: number;
	preferActivityPubJson?: boolean;
	skipMastodonFallback?: boolean;
}

export class ActivityPubResolver {
	private fetcher: ActivityPubFetcher;
	private formatter: ActivityPubFormatter;

	constructor(cacheService: ICacheService, mediaService: IMediaService) {
		this.fetcher = new ActivityPubFetcher(cacheService);
		this.formatter = new ActivityPubFormatter(mediaService);
	}

	private async buildContext(url: URL, html?: string): Promise<ActivityPubContext> {
		const instanceInfo = await this.fetcher.fetchInstanceInfo(url.origin);
		const appleTouchIcon = html ? extractAppleTouchIcon(html, url) : undefined;
		const instanceThumbnail = instanceInfo?.thumbnail?.url;
		const cleanedHostname = url.hostname.replace(/^(?:www\.|social\.|mstdn\.)/, '');

		return {
			serverDomain: instanceInfo?.domain || cleanedHostname,
			serverName: instanceInfo?.domain || cleanedHostname,
			serverTitle: instanceInfo?.title || `${cleanedHostname} Mastodon`,
			serverIcon: instanceThumbnail || appleTouchIcon,
		};
	}

	private extractUsernameFromActorUrl(actorUrl: string): string | undefined {
		try {
			const url = new URL(actorUrl);
			const parts = url.pathname.split('/').filter(Boolean);
			if (parts.length === 0) {
				return;
			}

			if (parts[0] === 'users' && parts[1]) {
				return parts[1];
			}

			if (parts[0]?.startsWith('@')) {
				return parts[0].slice(1);
			}

			return parts[parts.length - 1];
		} catch (error) {
			Logger.debug({error, actorUrl}, 'Failed to extract username from actor URL');
			return;
		}
	}

	private buildActorProfileUrl(actorUrl: string, preferredUsername?: string): string {
		try {
			const url = new URL(actorUrl);
			const username = (preferredUsername || this.extractUsernameFromActorUrl(actorUrl) || '').replace(/^@/, '');
			if (!username) {
				return actorUrl;
			}

			return `${url.origin}/@${username}`;
		} catch (error) {
			Logger.debug({error, actorUrl}, 'Failed to build actor profile URL');
			return actorUrl;
		}
	}

	private buildActivityPubHandle(username: string, host: string): string {
		const normalizedUsername = username.replace(/^@/, '');
		if (!normalizedUsername) {
			return '';
		}

		return `@${normalizedUsername}@${host}`;
	}

	private extractHostname(url: string): string | undefined {
		try {
			return new URL(url).hostname;
		} catch (error) {
			Logger.debug({error, url}, 'Failed to extract hostname');
			return;
		}
	}

	private isActivityPubPost(post: ActivityPubPost | null): post is ActivityPubPost {
		return (
			post != null &&
			typeof post.url === 'string' &&
			typeof post.published === 'string' &&
			typeof post.attributedTo !== 'undefined'
		);
	}

	private resolvePostUrl(fallbackUrl: URL, postUrl?: string): URL {
		if (!postUrl) {
			return fallbackUrl;
		}

		try {
			return new URL(postUrl);
		} catch (error) {
			Logger.debug({error, postUrl}, 'Failed to parse post URL, using fallback URL');
			return fallbackUrl;
		}
	}

	private getQuoteUrl(post: ActivityPubPost): string | undefined {
		return post.quote || post.quoteUri || post._misskey_quote;
	}

	private async tryFetchParentPost(inReplyToUrl: string): Promise<ActivityPubContext['inReplyTo'] | undefined> {
		try {
			const parentPost = await this.fetcher.tryFetchActivityPubData(inReplyToUrl);
			if (!this.isActivityPubPost(parentPost)) return;

			let authorName = '';
			let authorUrl = parentPost.url;
			if (typeof parentPost.attributedTo === 'string') {
				const actorHostname = this.extractHostname(parentPost.attributedTo);
				const username = this.extractUsernameFromActorUrl(parentPost.attributedTo) || '';
				authorName = actorHostname ? this.buildActivityPubHandle(username, actorHostname) : username;
				authorUrl = this.buildActorProfileUrl(parentPost.attributedTo, username);
			} else if (parentPost.attributedTo) {
				const attributedTo = parentPost.attributedTo;
				const actorHostname = attributedTo.url ? this.extractHostname(attributedTo.url) : undefined;
				const username =
					attributedTo.preferredUsername ||
					(attributedTo.url ? this.extractUsernameFromActorUrl(attributedTo.url) : '') ||
					attributedTo.name ||
					'';
				authorName = actorHostname ? this.buildActivityPubHandle(username, actorHostname) : username;
				if (attributedTo.url) {
					authorUrl = this.buildActorProfileUrl(attributedTo.url, attributedTo.preferredUsername);
				}
			}

			const content = parentPost.content ? DOMUtils.htmlToMarkdown(parentPost.content) : '';
			const urlObj = new URL(parentPost.url);
			const idMatch = extractPostId(urlObj);

			return {author: authorName, content, url: authorUrl, id: idMatch || undefined};
		} catch (error) {
			Logger.error({error, inReplyToUrl}, 'Failed to fetch parent post');
			return;
		}
	}

	private formatMastodonParentAuthor(parentPost: MastodonPost): string {
		const accountHost = this.extractHostname(parentPost.account.url) || '';
		const accountHandle =
			parentPost.account.acct.includes('@') || !accountHost
				? parentPost.account.acct
				: `${parentPost.account.acct}@${accountHost}`;
		return `@${accountHandle}`.replace(/^@@/, '@');
	}

	private async tryResolveFromActivityPubData(
		url: URL,
		activityPubUrl: string,
		context: ActivityPubContext,
		maxActivityPubRedirects?: number,
	): Promise<Array<MessageEmbedResponse> | null> {
		const activityPubPost = maxActivityPubRedirects
			? await this.fetcher.tryFetchActivityPubDataWithRedirectLimit(activityPubUrl, maxActivityPubRedirects)
			: await this.fetcher.tryFetchActivityPubData(activityPubUrl);

		if (!this.isActivityPubPost(activityPubPost)) {
			return null;
		}

		Logger.debug({url: url.toString(), activityPubUrl}, 'Successfully fetched ActivityPub data');
		if (activityPubPost.inReplyTo) {
			const parentUrl = typeof activityPubPost.inReplyTo === 'string' ? activityPubPost.inReplyTo : null;
			if (parentUrl) {
				context.inReplyTo = await this.tryFetchParentPost(parentUrl);
			}
		}

		const embedUrl = this.resolvePostUrl(url, activityPubPost.url);
		const embeds = await this.formatter.buildActivityPubEmbeds(
			activityPubPost,
			embedUrl,
			context,
			this.fetcher.tryFetchActivityPubData.bind(this.fetcher),
		);

		await this.attachQuoteChildEmbed(activityPubPost, embeds);
		return embeds;
	}

	private async attachQuoteChildEmbed(post: ActivityPubPost, embeds: Array<MessageEmbedResponse>): Promise<void> {
		const rootEmbed = embeds[0];
		if (!rootEmbed) {
			return;
		}

		const quoteUrl = this.getQuoteUrl(post);
		if (!quoteUrl) {
			return;
		}

		const quotePost = await this.fetcher.tryFetchActivityPubData(quoteUrl);
		if (!this.isActivityPubPost(quotePost)) {
			return;
		}

		let fallbackQuoteUrl: URL;
		try {
			fallbackQuoteUrl = new URL(quoteUrl);
		} catch (error) {
			Logger.debug({error, quoteUrl}, 'Skipping quote embed with invalid quote URL');
			return;
		}
		const quoteEmbedUrl = this.resolvePostUrl(fallbackQuoteUrl, quotePost.url);
		const quoteContext = await this.buildContext(quoteEmbedUrl);
		if (quotePost.inReplyTo && typeof quotePost.inReplyTo === 'string') {
			quoteContext.inReplyTo = await this.tryFetchParentPost(quotePost.inReplyTo);
		}
		const quoteChildEmbed = await this.formatter.buildActivityPubEmbed(
			quotePost,
			quoteEmbedUrl,
			quoteContext,
			this.fetcher.tryFetchActivityPubData.bind(this.fetcher),
			undefined,
			true,
		);
		rootEmbed.children = [quoteChildEmbed];
	}

	async resolveActivityPub(
		url: URL,
		activityPubUrl: string | null,
		html: string,
		options: ResolveActivityPubOptions = {},
	): Promise<Array<MessageEmbedResponse> | null> {
		try {
			Logger.debug({url: url.toString()}, 'Resolving ActivityPub URL');
			const context = await this.buildContext(url, html);
			const preferActivityPubJson = options.preferActivityPubJson ?? true;
			if (activityPubUrl && preferActivityPubJson) {
				const activityPubEmbeds = await this.tryResolveFromActivityPubData(
					url,
					activityPubUrl,
					context,
					options.maxActivityPubRedirects,
				);
				if (activityPubEmbeds) {
					return activityPubEmbeds;
				}

				if (options.skipMastodonFallback) {
					Logger.debug({url: url.toString(), activityPubUrl}, 'Skipping Mastodon API fallback');
					return null;
				}
			}

			const postId = extractPostId(url);
			if (!postId) {
				Logger.debug({url: url.toString()}, 'No post ID found in URL');
				return null;
			}

			const mastodonPost = await this.fetcher.tryFetchMastodonApi(url.origin, postId);
			if (mastodonPost) {
				Logger.debug({url: url.toString(), postId}, 'Successfully fetched Mastodon API data');
				if (mastodonPost.in_reply_to_id && mastodonPost.in_reply_to_account_id) {
					try {
						const parentPostUrl = `${url.origin}/api/v1/statuses/${mastodonPost.in_reply_to_id}`;
						const response = await FetchUtils.sendRequest({
							url: parentPostUrl,
							method: 'GET',
							timeout: ms('5 seconds'),
							headers: {Accept: 'application/json'},
						});
						if (response.status === 200) {
							const data = await FetchUtils.streamToString(response.stream);
							const parentPost = JSON.parse(data) as MastodonPost;
							context.inReplyTo = {
								author: this.formatMastodonParentAuthor(parentPost),
								content: DOMUtils.htmlToMarkdown(parentPost.content),
								url: parentPost.account.url || parentPost.url,
								id: mastodonPost.in_reply_to_id,
							};
						}
					} catch (error) {
						Logger.error({error, inReplyToId: mastodonPost.in_reply_to_id}, 'Failed to fetch parent post for Mastodon');
					}
				}
				return await this.formatter.buildMastodonEmbeds(mastodonPost, url, context);
			}

			if (activityPubUrl && !preferActivityPubJson) {
				const activityPubEmbeds = await this.tryResolveFromActivityPubData(
					url,
					activityPubUrl,
					context,
					options.maxActivityPubRedirects,
				);
				if (activityPubEmbeds) {
					return activityPubEmbeds;
				}
			}

			if (url.pathname.includes('/notice/')) {
				const noticeId = url.pathname.split('/notice/')[1]?.split('/')[0];
				if (noticeId) {
					const pleromaApiUrl = `${url.origin}/api/v1/statuses/${noticeId}`;
					Logger.debug({pleromaApiUrl}, 'Trying Pleroma-compatible API endpoint');
					const pleromaPost = await this.fetcher.tryFetchMastodonApi(url.origin, noticeId);
					if (pleromaPost) {
						Logger.debug({url: url.toString(), noticeId}, 'Successfully fetched Pleroma API data');
						return await this.formatter.buildMastodonEmbeds(pleromaPost, url, context);
					}
				}
			}
			Logger.debug({url: url.toString()}, 'Could not resolve as ActivityPub');
			return null;
		} catch (error) {
			Logger.error({error, url: url.toString()}, 'Failed to resolve ActivityPub URL');
			return null;
		}
	}
}
