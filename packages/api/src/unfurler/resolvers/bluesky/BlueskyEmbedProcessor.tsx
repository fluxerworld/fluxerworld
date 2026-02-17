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
import type {BlueskyApiClient} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyApiClient';
import type {
	BlueskyAspectRatio,
	BlueskyExternalEmbed,
	BlueskyMediaEmbedView,
	BlueskyPost,
	BlueskyPostEmbed,
	BlueskyProcessedEmbeddedPost,
	BlueskyProcessedExternalEmbed,
	BlueskyProcessedPostEmbed,
	BlueskyRecordViewRecord,
	BlueskyVideoEmbedView,
	ProcessedMedia,
	ProcessedVideoResult,
} from '@fluxer/api/src/unfurler/resolvers/bluesky/BlueskyTypes';
import {buildEmbedMediaPayload} from '@fluxer/api/src/unfurler/resolvers/media/MediaMetadataHelpers';
import {parseString} from '@fluxer/api/src/utils/StringUtils';

export class BlueskyEmbedProcessor {
	private static readonly MAX_ALT_TEXT_LENGTH = 4096;
	private static readonly MAX_GALLERY_IMAGES = 10;

	constructor(
		private mediaService: IMediaService,
		private apiClient: BlueskyApiClient,
	) {}

	async processImage(
		imageUrl?: string,
		aspectRatio?: BlueskyAspectRatio,
		altText?: string,
		isNSFWAllowed: boolean = false,
	): Promise<ProcessedMedia | undefined> {
		if (!imageUrl) {
			Logger.debug('No image URL provided to process');
			return;
		}

		try {
			Logger.debug({imageUrl, aspectRatio, hasAltText: !!altText}, 'Processing image');
			const metadata = await this.mediaService.getMetadata({type: 'external', url: imageUrl, isNSFWAllowed});
			let description: string | undefined;
			if (altText) {
				description = parseString(altText, BlueskyEmbedProcessor.MAX_ALT_TEXT_LENGTH);
				Logger.debug(
					{imageUrl, altTextLength: altText.length, processedLength: description.length},
					'Added alt text as description to image',
				);
			}

			const result = buildEmbedMediaPayload(imageUrl, metadata, {
				width: aspectRatio?.width,
				height: aspectRatio?.height,
				description,
			}) as ProcessedMedia;

			Logger.debug({imageUrl, metadata: result}, 'Image processed successfully');
			return result;
		} catch (error) {
			Logger.error({error, imageUrl}, 'Failed to process image');
			return;
		}
	}

	async processPostEmbed(post: BlueskyPost, isNSFWAllowed: boolean): Promise<BlueskyProcessedPostEmbed> {
		if (!post.embed) {
			return {};
		}

		return this.processEmbed(post.embed, post.author.did, isNSFWAllowed);
	}

	async processEmbeddedPost(
		post: BlueskyPost,
		isNSFWAllowed: boolean,
	): Promise<BlueskyProcessedEmbeddedPost | undefined> {
		const embeddedRecord = this.extractEmbeddedRecord(post.embed);
		if (!embeddedRecord) {
			return;
		}

		const nestedEmbedView = this.extractEmbeddedRecordMedia(embeddedRecord);
		const embed = nestedEmbedView
			? await this.processEmbed(nestedEmbedView, embeddedRecord.author.did, isNSFWAllowed)
			: undefined;

		return {
			uri: embeddedRecord.uri,
			author: embeddedRecord.author,
			text: embeddedRecord.value.text,
			createdAt: embeddedRecord.value.createdAt,
			facets: embeddedRecord.value.facets,
			replyCount: embeddedRecord.replyCount,
			repostCount: embeddedRecord.repostCount,
			likeCount: embeddedRecord.likeCount,
			quoteCount: embeddedRecord.quoteCount,
			bookmarkCount: embeddedRecord.bookmarkCount,
			embed,
		};
	}

	private async processEmbed(
		embed: BlueskyPostEmbed,
		authorDid: string,
		isNSFWAllowed: boolean,
	): Promise<BlueskyProcessedPostEmbed> {
		let image: ProcessedMedia | undefined;
		let thumbnail: ProcessedMedia | undefined;
		let video: ProcessedMedia | undefined;
		let external: BlueskyProcessedExternalEmbed | undefined;

		Logger.debug({embedType: embed.$type, hasEmbed: true, authorDid}, 'Processing Bluesky embed payload');

		const processedImages = await this.processEmbedImages(embed, isNSFWAllowed);
		if (processedImages.length > 0) {
			image = processedImages[0];
		}

		if (embed.$type === 'app.bsky.embed.video#view') {
			const processed = await this.processVideoEmbed(embed, authorDid, isNSFWAllowed);
			thumbnail = processed.thumbnail;
			video = processed.video;
		}

		if (embed.$type === 'app.bsky.embed.external#view') {
			const processed = await this.processExternalEmbed(embed.external, isNSFWAllowed);
			external = processed.external;
			thumbnail = processed.thumbnail;
		}

		if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media) {
			if (embed.media.$type === 'app.bsky.embed.video#view') {
				const processed = await this.processVideoEmbed(embed.media, authorDid, isNSFWAllowed);
				thumbnail = processed.thumbnail;
				video = processed.video;
			}

			if (embed.media.$type === 'app.bsky.embed.external#view') {
				const processed = await this.processExternalEmbed(embed.media.external, isNSFWAllowed);
				external = processed.external;
				if (!thumbnail) {
					thumbnail = processed.thumbnail;
				}
			}
		}

		const galleryImages = processedImages.length > 1 ? processedImages.slice(1) : undefined;
		return {image, thumbnail, video, galleryImages, external};
	}

	private async processVideoEmbed(
		embed: BlueskyVideoEmbedView,
		did: string,
		isNSFWAllowed: boolean,
	): Promise<ProcessedVideoResult> {
		Logger.debug(
			{embedType: embed.$type, hasThumbnail: !!embed.thumbnail, cid: embed.cid, aspectRatio: embed.aspectRatio},
			'Processing video embed',
		);

		try {
			const thumbnail = await this.processImage(embed.thumbnail, embed.aspectRatio, undefined, isNSFWAllowed);
			if (!thumbnail || !embed.cid) {
				Logger.debug(
					{embedType: embed.$type, hasThumbnail: !!thumbnail, hasCid: !!embed.cid},
					'Missing required video data',
				);
				return {};
			}

			const serviceEndpoint = await this.apiClient.getServiceEndpoint(did);
			const directUrl = `${serviceEndpoint}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${embed.cid}`;
			const videoMetadata = await this.mediaService.getMetadata({type: 'external', url: directUrl, isNSFWAllowed});
			const video = buildEmbedMediaPayload(directUrl, videoMetadata, {
				width: videoMetadata?.width ?? thumbnail.width,
				height: videoMetadata?.height ?? thumbnail.height,
			}) as ProcessedMedia;

			Logger.debug(
				{thumbnailProcessed: !!thumbnail, videoMetadata, aspectRatio: embed.aspectRatio, serviceEndpoint},
				'Successfully processed video embed',
			);
			return {thumbnail, video};
		} catch (error) {
			Logger.error({error, embedType: embed.$type}, 'Failed to process video embed');
			return {};
		}
	}

	private async processExternalEmbed(
		external: BlueskyExternalEmbed,
		isNSFWAllowed: boolean,
	): Promise<{external: BlueskyProcessedExternalEmbed; thumbnail?: ProcessedMedia}> {
		Logger.debug({uri: external.uri, title: external.title, hasThumb: !!external.thumb}, 'Processing external embed');

		let thumbnail: ProcessedMedia | undefined;
		if (external.thumb) {
			thumbnail = await this.processImage(external.thumb, undefined, undefined, isNSFWAllowed);
		}

		const formattedExternal: BlueskyProcessedExternalEmbed = {
			uri: external.uri,
			title: external.title || external.uri,
			description: external.description || undefined,
			thumbnail,
		};
		return {external: formattedExternal, thumbnail};
	}

	private async processEmbedImages(embed: BlueskyPostEmbed, isNSFWAllowed: boolean): Promise<Array<ProcessedMedia>> {
		const imageEntries = this.collectImageEntries(embed);
		if (imageEntries.length === 0) return [];

		const processedImages: Array<ProcessedMedia> = [];
		const seenUrls = new Set<string>();

		for (const entry of imageEntries) {
			const normalizedUrl = this.normalizeUrl(entry.url);
			if (!normalizedUrl) continue;
			if (seenUrls.has(normalizedUrl)) continue;
			seenUrls.add(normalizedUrl);

			const processedImage = await this.processImage(entry.url, entry.aspectRatio, entry.alt, isNSFWAllowed);
			if (processedImage) {
				processedImages.push(processedImage);
				if (processedImages.length >= BlueskyEmbedProcessor.MAX_GALLERY_IMAGES) break;
			}
		}

		return processedImages;
	}

	private collectImageEntries(
		embed: BlueskyPostEmbed,
	): Array<{url: string; aspectRatio?: BlueskyAspectRatio; alt?: string}> {
		const entries: Array<{url: string; aspectRatio?: BlueskyAspectRatio; alt?: string}> = [];

		const addImages = (
			images?: Array<{thumb: string; fullsize?: string; alt?: string; aspectRatio?: BlueskyAspectRatio}>,
		) => {
			if (!images) return;
			for (const image of images) {
				const resolvedUrl = image.fullsize ?? image.thumb;
				if (!resolvedUrl) continue;
				entries.push({url: resolvedUrl, aspectRatio: image.aspectRatio, alt: image.alt});
			}
		};

		if (embed.$type === 'app.bsky.embed.images#view') {
			addImages(embed.images);
		}

		if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media?.$type === 'app.bsky.embed.images#view') {
			addImages(embed.media.images);
		}

		return entries;
	}

	private extractEmbeddedRecord(embed?: BlueskyPostEmbed): BlueskyRecordViewRecord | undefined {
		if (!embed) return;

		if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
			return embed.record?.record;
		}

		if (embed.$type === 'app.bsky.embed.record#view') {
			return embed.record;
		}

		return;
	}

	private extractEmbeddedRecordMedia(record: BlueskyRecordViewRecord): BlueskyMediaEmbedView | undefined {
		for (const candidate of record.embeds ?? []) {
			if (!candidate || typeof candidate !== 'object') {
				continue;
			}

			if (
				candidate.$type === 'app.bsky.embed.images#view' ||
				candidate.$type === 'app.bsky.embed.video#view' ||
				candidate.$type === 'app.bsky.embed.external#view'
			) {
				return candidate;
			}
		}

		return;
	}

	private normalizeUrl(url: string): string | null {
		try {
			return new URL(url).href.replace(/\/$/, '');
		} catch (error) {
			Logger.error({error, url}, 'Failed to normalize image URL');
			return null;
		}
	}
}
