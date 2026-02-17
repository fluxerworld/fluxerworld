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
import {BaseResolver} from '@fluxer/api/src/unfurler/resolvers/BaseResolver';
import {BlueskyApiClient} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyApiClient';
import {BlueskyEmbedProcessor} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyEmbedProcessor';
import {BlueskyTextFormatter} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTextFormatter';
import type {
	BlueskyAuthor,
	BlueskyProcessedEmbeddedPost,
	BlueskyProcessedExternalEmbed,
	BlueskyProcessedPostEmbed,
} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTypes';
import {sanitizeOptionalAbsoluteUrl} from '@fluxer/api/src/utils/UrlSanitizer';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {MessageEmbedTypes} from '@fluxer/constants/src/ChannelConstants';
import type {EmbedFieldResponse, MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';

interface BlueskyEmbedBuildInput {
	postUrl: string;
	postDescription: string;
	createdAt: string;
	author: BlueskyAuthor;
	processedEmbed?: BlueskyProcessedPostEmbed;
	fields?: Array<EmbedFieldResponse>;
	children?: Array<MessageEmbedResponse>;
	isNested?: boolean;
}

export class BlueskyResolver extends BaseResolver {
	private static readonly BLUESKY_COLOR = 0x1185fe;
	private static readonly BLUESKY_ICON = 'https://bsky.app/static/apple-touch-icon.png';
	private static readonly PATH_SEPARATOR = '/';

	private apiClient: BlueskyApiClient;
	private textFormatter: BlueskyTextFormatter;
	private embedProcessor: BlueskyEmbedProcessor;

	constructor(cacheService: ICacheService, mediaService: IMediaService) {
		super(mediaService);
		this.apiClient = new BlueskyApiClient(cacheService);
		this.textFormatter = new BlueskyTextFormatter();
		this.embedProcessor = new BlueskyEmbedProcessor(mediaService, this.apiClient);
	}

	static formatCount(count: number): string {
		if (count < 1000) {
			return count.toString();
		}
		if (count < 10000) {
			const thousands = count / 1000;
			return `${thousands.toFixed(1)}K`;
		}
		const thousands = Math.floor(count / 1000);
		return `${thousands}K`;
	}

	match(url: URL, mimeType: string, _content: Uint8Array): boolean {
		const isMatch = url.hostname === 'bsky.app' && mimeType.startsWith('text/html');
		Logger.debug({url: url.toString(), mimeType, isMatch}, 'BlueskyResolver match check');
		return isMatch;
	}

	async resolve(url: URL, _content: Uint8Array, isNSFWAllowed: boolean = false): Promise<Array<MessageEmbedResponse>> {
		try {
			Logger.debug({url: url.toString()}, 'Starting URL resolution');

			if (this.isPostUrl(url)) {
				return await this.resolvePost(url, isNSFWAllowed);
			}

			if (this.isProfileUrl(url)) {
				Logger.debug({url: url.toString()}, 'Resolving profile URL');
				const handle = this.parsePathParts(url)[1];
				const profile = await this.apiClient.fetchProfile(handle);
				if (!profile) return [];

				const embed: MessageEmbedResponse = {
					type: 'rich',
					url: url.href,
					title: profile.displayName ? `${profile.displayName} (@${profile.handle})` : `@${profile.handle}`,
					description: profile.description,
					color: BlueskyResolver.BLUESKY_COLOR,
					footer: {text: 'Bluesky', icon_url: BlueskyResolver.BLUESKY_ICON},
				};
				return [embed];
			}

			Logger.debug({url: url.toString()}, 'URL does not match any supported patterns');
			return [];
		} catch (error) {
			Logger.error({error, url: url.toString()}, 'Failed to resolve URL');
			return [];
		}
	}

	private async resolvePost(url: URL, isNSFWAllowed: boolean): Promise<Array<MessageEmbedResponse>> {
		Logger.debug({url: url.toString()}, 'Resolving post URL');
		const atUri = await this.getAtUri(url);
		if (!atUri) return [];

		const thread = await this.apiClient.fetchPost(atUri);
		if (!thread) return [];

		const {post} = thread.thread;
		const [processedEmbed, processedEmbeddedPost] = await Promise.all([
			this.embedProcessor.processPostEmbed(post, isNSFWAllowed),
			this.embedProcessor.processEmbeddedPost(post, isNSFWAllowed),
		]);

		const rootDescription = this.textFormatter.formatPostContent(post, thread);
		const childEmbed = this.buildEmbeddedPostEmbed(processedEmbeddedPost);
		const rootEmbed = this.buildBlueskyEmbed({
			postUrl: url.href,
			postDescription: rootDescription,
			createdAt: post.record.createdAt,
			author: post.author,
			processedEmbed,
			fields: this.buildEngagementFields(post),
			children: childEmbed ? [childEmbed] : undefined,
		});

		Logger.debug(
			{
				url: url.toString(),
				embedType: post.embed?.$type,
				hasImage: !!processedEmbed.image,
				hasThumbnail: !!processedEmbed.thumbnail,
				hasVideo: !!processedEmbed.video,
				hasImageAltText: !!processedEmbed.image?.description,
				hasNestedEmbed: !!childEmbed,
				isReply: !!post.record.reply,
				replyCount: post.replyCount,
				repostCount: post.repostCount,
				likeCount: post.likeCount,
				quoteCount: post.quoteCount,
				bookmarkCount: post.bookmarkCount ?? 0,
			},
			'Processed post embeds',
		);

		const galleryEmbeds =
			processedEmbed.galleryImages?.map((galleryImage) => ({
				type: 'rich',
				url: url.href,
				image: galleryImage,
			})) ?? [];

		return [rootEmbed, ...galleryEmbeds];
	}

	private buildEmbeddedPostEmbed(
		processedEmbeddedPost?: BlueskyProcessedEmbeddedPost,
	): MessageEmbedResponse | undefined {
		if (!processedEmbeddedPost) {
			return;
		}

		const postUrl = this.atUriToPostUrl(processedEmbeddedPost.uri, processedEmbeddedPost.author.handle);
		const formattedText = this.textFormatter.embedLinksInText(processedEmbeddedPost.text, processedEmbeddedPost.facets);

		return this.buildBlueskyEmbed({
			postUrl,
			postDescription: formattedText,
			createdAt: processedEmbeddedPost.createdAt,
			author: processedEmbeddedPost.author,
			processedEmbed: processedEmbeddedPost.embed,
			isNested: true,
		});
	}

	private buildBlueskyEmbed(input: BlueskyEmbedBuildInput): MessageEmbedResponse {
		const externalSummary = this.buildExternalSummary(input.processedEmbed?.external);
		const description = externalSummary
			? this.appendSection(input.postDescription, externalSummary)
			: input.postDescription;
		const embed: MessageEmbedResponse = {
			type: MessageEmbedTypes.BLUESKY,
			url: input.postUrl,
			description,
			color: BlueskyResolver.BLUESKY_COLOR,
			author: {
				name: `${input.author.displayName || input.author.handle} (@${input.author.handle})`,
				url: input.postUrl,
				...this.buildOptionalIconUrl(input.author.avatar),
			},
			...(input.processedEmbed?.image ? {image: input.processedEmbed.image} : {}),
			...(input.processedEmbed?.video
				? {
						thumbnail: input.processedEmbed.thumbnail,
						video: input.processedEmbed.video,
					}
				: {}),
			...(!input.processedEmbed?.video && !input.processedEmbed?.image && input.processedEmbed?.thumbnail
				? {thumbnail: input.processedEmbed.thumbnail}
				: {}),
			children: input.children,
		};

		if (input.isNested) {
			return embed;
		}

		embed.title = input.processedEmbed?.external?.title;
		embed.timestamp = new Date(input.createdAt).toISOString();
		embed.fields = input.fields ?? [];
		embed.footer = {text: 'Bluesky', icon_url: BlueskyResolver.BLUESKY_ICON};

		return embed;
	}

	private buildOptionalIconUrl(iconUrl: string | undefined): {icon_url?: string} {
		const sanitizedIconUrl = sanitizeOptionalAbsoluteUrl(iconUrl);
		if (!sanitizedIconUrl) {
			return {};
		}

		return {icon_url: sanitizedIconUrl};
	}

	private buildEngagementFields(post: {
		repostCount?: number;
		quoteCount?: number;
		likeCount?: number;
		bookmarkCount?: number;
	}): Array<EmbedFieldResponse> {
		const engagementFields: Array<{name: string; count?: number}> = [
			{name: 'repostCount', count: post.repostCount},
			{name: 'quoteCount', count: post.quoteCount},
			{name: 'likeCount', count: post.likeCount},
			{name: 'bookmarkCount', count: post.bookmarkCount},
		];

		return engagementFields
			.filter((field): field is {name: string; count: number} => typeof field.count === 'number' && field.count > 0)
			.map((field) => ({name: field.name, value: BlueskyResolver.formatCount(field.count), inline: true}));
	}

	private buildExternalSummary(external?: BlueskyProcessedExternalEmbed): string | undefined {
		if (!external) {
			return;
		}

		const title = external.title || external.uri;
		const titleLine = `[${title}](${external.uri})`;
		if (external.description) {
			return `${titleLine}\n${external.description}`;
		}

		return titleLine;
	}

	private appendSection(base: string, section: string): string {
		if (!base) {
			return section;
		}

		return `${base}\n\n${section}`;
	}

	private atUriToPostUrl(atUri: string, fallbackHandle: string): string {
		const parts = atUri.replace('at://', '').split('/');
		const postId = parts[2];

		if (!postId) {
			return `https://bsky.app/profile/${fallbackHandle}`;
		}

		return `https://bsky.app/profile/${fallbackHandle}/post/${postId}`;
	}

	private parsePathParts(url: URL): Array<string> {
		return url.pathname.replace(/^\/+|\/+$/g, '').split(BlueskyResolver.PATH_SEPARATOR);
	}

	private isProfileUrl(url: URL): boolean {
		const parts = this.parsePathParts(url);
		const isProfile = parts.length === 2 && parts[0] === 'profile';
		Logger.debug({url: url.toString(), parts, isProfile}, 'Profile URL check');
		return isProfile;
	}

	private isPostUrl(url: URL): boolean {
		const parts = this.parsePathParts(url);
		const isPost = parts.length === 4 && parts[0] === 'profile' && parts[2] === 'post' && parts[3].length > 0;
		Logger.debug({url: url.toString(), parts, isPost}, 'Post URL check');
		return isPost;
	}

	private async getAtUri(url: URL): Promise<string | null> {
		const parts = this.parsePathParts(url);
		if (parts.length !== 4) throw new Error('Invalid URL format for AT URI conversion');

		const handle = parts[1];
		const postId = parts[3];
		const did = await this.apiClient.resolveDid(handle);
		if (!did) return null;

		const atUri = `at://${did}/app.bsky.feed.post/${postId}`;
		Logger.debug({url: url.toString(), handle, did, postId, atUri}, 'Generated AT URI');
		return atUri;
	}
}
