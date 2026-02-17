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
import {buildEmbedMediaPayload} from '@fluxer/api/src/unfurler/resolvers/media/MediaMetadataHelpers';
import type {
	ActivityPubAttachment,
	ActivityPubAuthor,
	ActivityPubContext,
	ActivityPubPost,
	MastodonMediaAttachment,
	MastodonPost,
	ProcessedMedia,
} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubTypes';
import {escapeMarkdownChars} from '@fluxer/api/src/unfurler/resolvers/subresolvers/ActivityPubUtils';
import * as DOMUtils from '@fluxer/api/src/utils/DOMUtils';
import {parseString} from '@fluxer/api/src/utils/StringUtils';
import {sanitizeOptionalAbsoluteUrl} from '@fluxer/api/src/utils/UrlSanitizer';
import type {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';

export class ActivityPubFormatter {
	private static readonly DEFAULT_COLOR = 0x6364ff;
	private static readonly FAVORITE_THRESHOLD = 100;
	private static readonly MAX_ALT_TEXT_LENGTH = 4096;

	constructor(private mediaService: IMediaService) {}

	async processMedia(attachment: MastodonMediaAttachment | ActivityPubAttachment): Promise<ProcessedMedia | undefined> {
		try {
			if (!('url' in attachment) || attachment.url == null) return;
			const url = attachment.url;
			let altText: string | null = null;
			if ('description' in attachment) {
				altText = attachment.description;
				Logger.debug({url, hasAltText: !!altText}, 'Found Mastodon alt text');
			} else if ('name' in attachment) {
				altText = attachment.name || null;
				Logger.debug({url, hasAltText: !!altText}, 'Found ActivityPub alt text');
			}
			const metadata = await this.mediaService.getMetadata({type: 'external', url: url, isNSFWAllowed: false});
			if (!metadata) {
				Logger.debug({url}, 'Failed to get media metadata');
				return;
			}

			let description: string | undefined;
			if (altText) {
				description = parseString(altText, ActivityPubFormatter.MAX_ALT_TEXT_LENGTH);
				Logger.debug(
					{url, originalAltLength: altText.length, processedAltLength: description.length},
					'Added sanitized alt text as description',
				);
			}

			const widthOverride = this.getAttachmentDimension(attachment, 'width') ?? metadata.width;
			const heightOverride = this.getAttachmentDimension(attachment, 'height') ?? metadata.height;

			return buildEmbedMediaPayload(url, metadata, {
				width: widthOverride,
				height: heightOverride,
				description,
			}) as ProcessedMedia;
		} catch (error) {
			Logger.error({error}, 'Failed to process media');
			return;
		}
	}

	formatMastodonContent(post: MastodonPost, context?: ActivityPubContext): string {
		let text = DOMUtils.htmlToMarkdown(post.content);

		if (post.spoiler_text) {
			text = `**${post.spoiler_text}**\n\n${text}`;
		}

		if (post.reblog) {
			const reblogAuthor = post.reblog.account.display_name || post.reblog.account.username;
			const reblogText = DOMUtils.htmlToMarkdown(post.reblog.content);
			text = `**Boosted from ${reblogAuthor}**\n\n${reblogText}`;
		}

		if (context?.inReplyTo) {
			text = `-# ↩ [${context.inReplyTo.author}](${context.inReplyTo.url})\n${text}`;
		}

		return escapeMarkdownChars(text);
	}

	formatActivityPubContent(post: ActivityPubPost, context?: ActivityPubContext): string {
		let text = post.content ? DOMUtils.htmlToMarkdown(post.content) : '';

		if (post.summary) {
			text = `**${post.summary}**\n\n${text}`;
		}

		if (context?.inReplyTo) {
			text = `-# ↩ [${context.inReplyTo.author}](${context.inReplyTo.url})\n${text}`;
		}

		return escapeMarkdownChars(text);
	}

	async buildMastodonEmbeds(
		post: MastodonPost,
		url: URL,
		context: ActivityPubContext,
	): Promise<Array<MessageEmbedResponse>> {
		const authorName = post.account.display_name || post.account.username;
		const authorFullName = `${authorName} (@${post.account.username}@${context.serverDomain})`;
		const authorUrl = post.account.url;
		const content = this.formatMastodonContent(post, context);
		const {image, video, thumbnail, galleryEmbeds} = await this.resolveMastodonMediaEmbeds(post, url);
		const fields = [];
		if (post.favourites_count >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Favorites', value: post.favourites_count.toString(), inline: true});
		if (post.reblogs_count >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Boosts', value: post.reblogs_count.toString(), inline: true});
		if (post.replies_count >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Replies', value: post.replies_count.toString(), inline: true});
		if (post.poll) {
			const pollOptions = post.poll.options
				.map((option) => {
					const votes = option.votes_count != null ? `: ${option.votes_count}` : '';
					return `• ${option.title}${votes}`;
				})
				.join('\n');
			fields.push({name: `Poll (${post.poll.votes_count} votes)`, value: pollOptions, inline: false});
		}
		const embed: MessageEmbedResponse = {
			type: 'rich',
			url: url.toString(),
			description: content,
			color: ActivityPubFormatter.DEFAULT_COLOR,
			timestamp: new Date(post.created_at).toISOString(),
			author: {
				name: authorFullName,
				...this.buildOptionalAuthorUrl(authorUrl),
				...this.buildOptionalIconUrl(post.account.avatar),
			},
			footer: {text: context.serverTitle, ...this.buildOptionalIconUrl(context.serverIcon)},
			fields: fields.length > 0 ? fields : undefined,
		};

		if (image) {
			embed.image = image;
		}

		if (video) {
			embed.video = video;
			if (thumbnail) {
				embed.thumbnail = thumbnail;
			}
		}

		return [embed, ...galleryEmbeds];
	}

	async buildActivityPubEmbeds(
		post: ActivityPubPost,
		url: URL,
		context: ActivityPubContext,
		fetchAuthorData: (url: string) => Promise<ActivityPubPost | null>,
	): Promise<Array<MessageEmbedResponse>> {
		const {image, video, thumbnail, galleryEmbeds} = await this.resolveActivityPubMediaEmbeds(post, url);
		const rootEmbed = await this.buildActivityPubEmbed(post, url, context, fetchAuthorData, {image, video, thumbnail});
		return [rootEmbed, ...galleryEmbeds];
	}

	async buildActivityPubEmbed(
		post: ActivityPubPost,
		url: URL,
		context: ActivityPubContext,
		fetchAuthorData: (url: string) => Promise<ActivityPubPost | null>,
		mediaOverrides?: {image?: ProcessedMedia; video?: ProcessedMedia; thumbnail?: ProcessedMedia},
		isNested: boolean = false,
	): Promise<MessageEmbedResponse> {
		const isActivityPubAuthor = (data: unknown): data is ActivityPubAuthor =>
			typeof data === 'object' &&
			data !== null &&
			('name' in data || 'preferredUsername' in data || 'url' in data || 'icon' in data);

		let authorName = '';
		let authorPreferredUsername = '';
		let authorUrl = '';
		let authorIcon = '';
		if (typeof post.attributedTo === 'string') {
			const authorData = (await fetchAuthorData(post.attributedTo)) as unknown;
			if (authorData) {
				if (isActivityPubAuthor(authorData)) {
					authorName = authorData.name || authorData.preferredUsername || '';
					authorPreferredUsername = authorData.preferredUsername || '';
					authorUrl = authorData.url || post.attributedTo;
					authorIcon = authorData.icon?.url || '';
				} else {
					authorName = this.getActivityPubUsernameFromUrl(post.attributedTo) || '';
					authorUrl = post.attributedTo;
				}
			} else {
				authorName = this.getActivityPubUsernameFromUrl(post.attributedTo) || '';
				authorUrl = post.attributedTo;
			}
		} else if (post.attributedTo && typeof post.attributedTo === 'object') {
			const author = post.attributedTo as ActivityPubAuthor;
			authorName = author.name || author.preferredUsername || '';
			authorPreferredUsername = author.preferredUsername || '';
			authorUrl = author.url || '';
			authorIcon = author.icon?.url || '';
		}
		const authorFullName = this.buildActivityPubAuthorLabel(
			authorName,
			authorPreferredUsername,
			authorUrl,
			context.serverDomain,
		);
		const content = this.formatActivityPubContent(post, context);
		const fields = [];
		const likesCount = this.getCollectionTotalItems(post.likes);
		const sharesCount = this.getCollectionTotalItems(post.shares);
		const repliesCount = post.replies?.totalItems || 0;
		if (likesCount >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Likes', value: likesCount.toString(), inline: true});
		if (sharesCount >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Shares', value: sharesCount.toString(), inline: true});
		if (repliesCount >= ActivityPubFormatter.FAVORITE_THRESHOLD)
			fields.push({name: 'Replies', value: repliesCount.toString(), inline: true});
		const embed: MessageEmbedResponse = {
			type: 'rich',
			url: url.toString(),
			description: content,
			color: ActivityPubFormatter.DEFAULT_COLOR,
			author: {
				name: authorFullName,
				...this.buildOptionalAuthorUrl(authorUrl),
				...this.buildOptionalIconUrl(authorIcon),
			},
		};

		if (!isNested) {
			embed.timestamp = new Date(post.published).toISOString();
			embed.footer = {text: context.serverTitle, ...this.buildOptionalIconUrl(context.serverIcon)};
			embed.fields = fields.length > 0 ? fields : undefined;
		}

		if (mediaOverrides?.image) embed.image = mediaOverrides.image;
		if (mediaOverrides?.video) {
			embed.video = mediaOverrides.video;
			if (mediaOverrides.thumbnail) embed.thumbnail = mediaOverrides.thumbnail;
		}

		return embed;
	}

	private async resolveMastodonMediaEmbeds(
		post: MastodonPost,
		url: URL,
	): Promise<{
		image?: ProcessedMedia;
		video?: ProcessedMedia;
		thumbnail?: ProcessedMedia;
		galleryEmbeds: Array<MessageEmbedResponse>;
	}> {
		let image: ProcessedMedia | undefined;
		let video: ProcessedMedia | undefined;
		let thumbnail: ProcessedMedia | undefined;
		let primaryMediaClaimed = false;
		const galleryEmbeds: Array<MessageEmbedResponse> = [];

		for (const attachment of post.media_attachments || []) {
			if (attachment.type === 'image' || attachment.type === 'gifv') {
				const processedImage = await this.processMedia(attachment);
				if (!processedImage) continue;
				Logger.debug(
					{
						mediaType: attachment.type,
						url: attachment.url,
						hasAltText: !!attachment.description,
						hasProcessedDescription: !!processedImage.description,
					},
					'Processed image media attachment',
				);

				if (!primaryMediaClaimed) {
					image = processedImage;
					primaryMediaClaimed = true;
				} else {
					galleryEmbeds.push(this.createRichImageEmbed(url, processedImage));
				}
				continue;
			}

			if (attachment.type === 'video') {
				const processedVideo = await this.processMedia(attachment);
				if (!processedVideo) continue;
				let processedThumbnail: ProcessedMedia | undefined;
				if (attachment.preview_url) {
					const previewAttachment = {...attachment, url: attachment.preview_url};
					processedThumbnail = await this.processMedia(previewAttachment);
				}
				Logger.debug(
					{
						mediaType: attachment.type,
						url: attachment.url,
						hasAltText: !!attachment.description,
						hasVideoDescription: !!processedVideo.description,
						hasThumbnailDescription: !!processedThumbnail?.description,
					},
					'Processed video media attachment',
				);

				if (!primaryMediaClaimed) {
					video = processedVideo;
					thumbnail = processedThumbnail;
					primaryMediaClaimed = true;
				} else {
					galleryEmbeds.push(this.createRichVideoEmbed(url, processedVideo, processedThumbnail));
				}
			}
		}

		return {image, video, thumbnail, galleryEmbeds};
	}

	private async resolveActivityPubMediaEmbeds(
		post: ActivityPubPost,
		url: URL,
	): Promise<{
		image?: ProcessedMedia;
		video?: ProcessedMedia;
		thumbnail?: ProcessedMedia;
		galleryEmbeds: Array<MessageEmbedResponse>;
	}> {
		let image: ProcessedMedia | undefined;
		let video: ProcessedMedia | undefined;
		let thumbnail: ProcessedMedia | undefined;
		let primaryMediaClaimed = false;
		const galleryEmbeds: Array<MessageEmbedResponse> = [];

		for (const attachment of post.attachment || []) {
			if (attachment.mediaType.startsWith('image/')) {
				const processedImage = await this.processMedia(attachment);
				if (!processedImage) continue;
				Logger.debug(
					{
						mediaType: attachment.mediaType,
						url: attachment.url,
						hasAltText: !!attachment.name,
						hasProcessedDescription: !!processedImage.description,
					},
					'Processed ActivityPub image attachment',
				);

				if (!primaryMediaClaimed) {
					image = processedImage;
					primaryMediaClaimed = true;
				} else {
					galleryEmbeds.push(this.createRichImageEmbed(url, processedImage));
				}
				continue;
			}

			if (attachment.mediaType.startsWith('video/')) {
				const processedVideo = await this.processMedia(attachment);
				if (!processedVideo) continue;
				const thumbnailAttachment = post.attachment?.find(
					(candidate) => candidate.mediaType.startsWith('image/') && candidate.url !== attachment.url,
				);
				const processedThumbnail = thumbnailAttachment ? await this.processMedia(thumbnailAttachment) : undefined;
				Logger.debug(
					{
						mediaType: attachment.mediaType,
						url: attachment.url,
						hasAltText: !!attachment.name,
						hasVideoDescription: !!processedVideo.description,
						hasThumbnailDescription: !!processedThumbnail?.description,
					},
					'Processed ActivityPub video attachment',
				);

				if (!primaryMediaClaimed) {
					video = processedVideo;
					thumbnail = processedThumbnail;
					primaryMediaClaimed = true;
				} else {
					galleryEmbeds.push(this.createRichVideoEmbed(url, processedVideo, processedThumbnail));
				}
			}
		}

		return {image, video, thumbnail, galleryEmbeds};
	}

	private createRichImageEmbed(url: URL, image: ProcessedMedia): MessageEmbedResponse {
		return {
			type: 'rich',
			url: url.toString(),
			image,
		};
	}

	private createRichVideoEmbed(url: URL, video: ProcessedMedia, thumbnail?: ProcessedMedia): MessageEmbedResponse {
		return {
			type: 'rich',
			url: url.toString(),
			video,
			thumbnail,
		};
	}

	private getCollectionTotalItems(collection: number | {totalItems?: number} | undefined): number {
		if (typeof collection === 'number') {
			return collection;
		}

		if (collection && typeof collection.totalItems === 'number') {
			return collection.totalItems;
		}

		return 0;
	}

	private buildOptionalIconUrl(iconUrl: string | undefined): {icon_url?: string} {
		const sanitizedIconUrl = sanitizeOptionalAbsoluteUrl(iconUrl);
		if (!sanitizedIconUrl) {
			return {};
		}

		return {icon_url: sanitizedIconUrl};
	}

	private buildOptionalAuthorUrl(authorUrl: string | undefined): {url?: string} {
		const sanitizedAuthorUrl = sanitizeOptionalAbsoluteUrl(authorUrl);
		if (!sanitizedAuthorUrl) {
			return {};
		}

		return {url: sanitizedAuthorUrl};
	}

	private buildActivityPubAuthorLabel(
		authorName: string,
		preferredUsername: string,
		authorUrl: string,
		serverDomain: string,
	): string {
		const usernameFromUrl = this.getActivityPubUsernameFromUrl(authorUrl);
		const username = (preferredUsername || usernameFromUrl || authorName).replace(/^@/, '');
		const displayName = authorName || username;

		if (!username) {
			return displayName;
		}

		return `${displayName} (@${username}@${serverDomain})`;
	}

	private getActivityPubUsernameFromUrl(url: string): string | undefined {
		if (!url) {
			return;
		}

		try {
			const parsedUrl = new URL(url);
			const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
			if (pathSegments.length === 0) {
				return;
			}

			if (pathSegments[0] === '@' && pathSegments[1]) {
				return pathSegments[1];
			}

			if (pathSegments[0]?.startsWith('@')) {
				return pathSegments[0].slice(1);
			}

			const usersIndex = pathSegments.indexOf('users');
			if (usersIndex >= 0 && pathSegments[usersIndex + 1]) {
				return pathSegments[usersIndex + 1];
			}

			return pathSegments[pathSegments.length - 1];
		} catch (error) {
			Logger.debug({error, url}, 'Failed to parse ActivityPub author URL');
			return;
		}
	}

	private getAttachmentDimension(
		attachment: MastodonMediaAttachment | ActivityPubAttachment,
		dimension: 'width' | 'height',
	): number | undefined {
		if (dimension === 'width' && 'width' in attachment && typeof attachment.width === 'number') {
			return attachment.width;
		}

		if (dimension === 'height' && 'height' in attachment && typeof attachment.height === 'number') {
			return attachment.height;
		}

		if (this.isMastodonMediaAttachment(attachment)) {
			return attachment.meta.original?.[dimension] ?? attachment.meta.small?.[dimension];
		}

		return undefined;
	}

	private isMastodonMediaAttachment(
		attachment: MastodonMediaAttachment | ActivityPubAttachment,
	): attachment is MastodonMediaAttachment {
		return 'meta' in attachment;
	}
}
