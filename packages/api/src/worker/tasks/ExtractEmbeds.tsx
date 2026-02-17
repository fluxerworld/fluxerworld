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

import type {ChannelID, GuildID, MessageID} from '@fluxer/api/src/BrandedTypes';
import {createChannelID, createGuildID, createMessageID} from '@fluxer/api/src/BrandedTypes';
import type {ChannelRepository} from '@fluxer/api/src/channel/ChannelRepository';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {MessageEmbed, MessageEmbedChild} from '@fluxer/api/src/database/types/MessageTypes';
import type {EmbedService} from '@fluxer/api/src/infrastructure/EmbedService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import {createRequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import {Embed} from '@fluxer/api/src/models/Embed';
import {Message} from '@fluxer/api/src/models/Message';
import * as UnfurlerUtils from '@fluxer/api/src/utils/UnfurlerUtils';
import {ChannelEventDispatcher} from '@fluxer/api/src/worker/services/ChannelEventDispatcher';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {MessageFlags} from '@fluxer/constants/src/ChannelConstants';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	channelId: z.string(),
	messageId: z.string(),
	guildId: z.string().nullable().optional(),
	isNSFWAllowed: z.boolean().optional(),
});

interface NormalizedEmbedAuthor {
	name: string | null;
	url: string | null;
	icon_url: string | null;
}

interface NormalizedEmbedField {
	name: string | null;
	value: string | null;
	inline: boolean;
}

interface NormalizedEmbedMedia {
	url: string | null;
	content_type: string | null;
	content_hash: string | null;
	width: number | null;
	height: number | null;
	description: string | null;
	placeholder: string | null;
	duration: number | null;
	flags: number;
}

interface NormalizedEmbedChild {
	type: string | null;
	title: string | null;
	description: string | null;
	url: string | null;
	timestamp: string | null;
	color: number | null;
	author: NormalizedEmbedAuthor | null;
	provider: NormalizedEmbedAuthor | null;
	thumbnail: NormalizedEmbedMedia | null;
	image: NormalizedEmbedMedia | null;
	video: NormalizedEmbedMedia | null;
	footer: {text: string | null; icon_url: string | null} | null;
	fields: Array<NormalizedEmbedField>;
	nsfw: boolean | null;
}

interface NormalizedEmbed extends NormalizedEmbedChild {
	children: Array<NormalizedEmbedChild>;
}

function normalizeEmbedAuthor(
	author?: MessageEmbed['author'] | MessageEmbed['provider'],
): NormalizedEmbedAuthor | null {
	if (!author) {
		return null;
	}

	const iconUrl = 'icon_url' in author ? (author.icon_url ?? null) : null;

	return {
		name: author.name ?? null,
		url: author.url ?? null,
		icon_url: iconUrl,
	};
}

function normalizeEmbedMedia(media?: MessageEmbed['image']): NormalizedEmbedMedia | null {
	if (!media) {
		return null;
	}

	return {
		url: media.url ?? null,
		content_type: media.content_type ?? null,
		content_hash: media.content_hash ?? null,
		width: media.width ?? null,
		height: media.height ?? null,
		description: media.description ?? null,
		placeholder: media.placeholder ?? null,
		duration: media.duration ?? null,
		flags: media.flags ?? 0,
	};
}

function normalizeEmbedChildForComparison(embed: MessageEmbed | MessageEmbedChild): NormalizedEmbedChild {
	return {
		type: embed.type ?? null,
		title: embed.title ?? null,
		description: embed.description ?? null,
		url: embed.url ?? null,
		timestamp: embed.timestamp ? new Date(embed.timestamp).toISOString() : null,
		color: embed.color ?? null,
		author: normalizeEmbedAuthor(embed.author),
		provider: normalizeEmbedAuthor(embed.provider),
		thumbnail: normalizeEmbedMedia(embed.thumbnail ?? undefined),
		image: normalizeEmbedMedia(embed.image ?? undefined),
		video: normalizeEmbedMedia(embed.video ?? undefined),
		footer: embed.footer
			? {
					text: embed.footer.text ?? null,
					icon_url: embed.footer.icon_url ?? null,
				}
			: null,
		fields: (embed.fields ?? []).map((field) => ({
			name: field.name ?? null,
			value: field.value ?? null,
			inline: field.inline ?? false,
		})),
		nsfw: embed.nsfw ?? null,
	};
}

function normalizeEmbedForComparison(embed: MessageEmbed): NormalizedEmbed {
	return {
		...normalizeEmbedChildForComparison(embed),
		children: (embed.children ?? []).map((child) => normalizeEmbedChildForComparison(child)),
	};
}

function areEmbedsEquivalent(existingEmbeds: Array<MessageEmbed>, newEmbeds: Array<MessageEmbed>): boolean {
	if (existingEmbeds.length !== newEmbeds.length) {
		return false;
	}

	const normalizedExistingEmbeds = existingEmbeds.map((embed) => normalizeEmbedForComparison(embed));
	const normalizedNewEmbeds = newEmbeds.map((embed) => normalizeEmbedForComparison(embed));

	return JSON.stringify(normalizedExistingEmbeds) === JSON.stringify(normalizedNewEmbeds);
}

async function partitionUrlsByCache(
	urls: Array<string>,
	cacheService: ICacheService,
): Promise<{cachedEmbedsByUrl: Map<string, Array<MessageEmbed>>; urlsToUnfurl: Array<string>}> {
	const cachedEmbedsByUrl = new Map<string, Array<MessageEmbed>>();
	const urlsToUnfurl: Array<string> = [];

	for (const url of urls) {
		const cacheKey = `url-embed:${url}`;
		const cached = await cacheService.get<Array<MessageEmbed>>(cacheKey);
		if (cached && cached.length > 0) {
			cachedEmbedsByUrl.set(url, cached);
			Logger.debug({url, embedCount: cached.length}, 'Using cached embed(s) for URL');
		} else {
			urlsToUnfurl.push(url);
		}
	}

	return {cachedEmbedsByUrl, urlsToUnfurl};
}

async function unfurlUrls(
	urlsToUnfurl: Array<string>,
	embedService: EmbedService,
	isNSFWAllowed: boolean,
): Promise<Map<string, Array<MessageEmbed>>> {
	const unfurledEmbedsByUrl = new Map<string, Array<MessageEmbed>>();

	await Promise.all(
		urlsToUnfurl.map(async (url) => {
			try {
				const embeds = await embedService.processUrl(url, isNSFWAllowed);
				if (embeds.length > 0) {
					unfurledEmbedsByUrl.set(
						url,
						embeds.map((e) => e.toMessageEmbed()),
					);
					await embedService.cacheEmbeds(url, embeds);
				}
			} catch (error) {
				Logger.error({error, url}, 'Failed to unfurl URL');
			}
		}),
	);

	return unfurledEmbedsByUrl;
}

function buildOrderedEmbeds(
	urls: Array<string>,
	cachedEmbedsByUrl: Map<string, Array<MessageEmbed>>,
	unfurledEmbedsByUrl: Map<string, Array<MessageEmbed>>,
): Array<MessageEmbed> {
	const allEmbedsByUrl = new Map([...cachedEmbedsByUrl, ...unfurledEmbedsByUrl]);
	const orderedEmbeds: Array<MessageEmbed> = [];

	for (const url of urls) {
		const embeds = allEmbedsByUrl.get(url);
		if (embeds) {
			orderedEmbeds.push(...embeds);
		}
	}

	return orderedEmbeds;
}

async function updateMessageEmbeds(
	channelRepository: ChannelRepository,
	channelId: ChannelID,
	messageId: MessageID,
	orderedEmbeds: Array<MessageEmbed>,
): Promise<Message | null> {
	const freshMessage = await channelRepository.getMessage(channelId, messageId);
	if (!freshMessage) {
		Logger.debug({messageId}, 'Message no longer exists, skipping embed update');
		return null;
	}

	const existingEmbeds = (freshMessage.embeds ?? []).map((embed) => embed.toMessageEmbed());
	if (areEmbedsEquivalent(existingEmbeds, orderedEmbeds)) {
		Logger.debug({messageId}, 'Embeds unchanged, skipping update');
		return null;
	}

	const messageWithEmbeds = new Message({
		...freshMessage.toRow(),
		embeds: orderedEmbeds.length > 0 ? orderedEmbeds : null,
	});

	await channelRepository.updateEmbeds(messageWithEmbeds);
	return channelRepository.getMessage(channelId, messageId);
}

interface DispatchEmbedUpdateParams {
	latestMessage: Message;
	orderedEmbeds: Array<MessageEmbed>;
	channel: Channel;
	guildId: GuildID | null;
	userCacheService: UserCacheService;
	mediaService: IMediaService;
	gatewayService: IGatewayService;
}

async function dispatchEmbedUpdate({
	latestMessage,
	orderedEmbeds,
	channel,
	guildId,
	userCacheService,
	mediaService,
	gatewayService,
}: DispatchEmbedUpdateParams): Promise<void> {
	const requestCache = createRequestCache();
	const embedObjects = orderedEmbeds.length > 0 ? orderedEmbeds.map((e) => new Embed(e)) : latestMessage.embeds;
	const messageWithUpdatedEmbeds = new Message({
		...latestMessage.toRow(),
		embeds: embedObjects.map((e) => e.toMessageEmbed()),
	});

	const messageData = await mapMessageToResponse({
		message: messageWithUpdatedEmbeds,
		userCacheService,
		requestCache,
		mediaService,
	});

	const eventDispatcher = new ChannelEventDispatcher({gatewayService});

	if (guildId && !channel.guildId) {
		await gatewayService.dispatchGuild({
			guildId,
			event: 'MESSAGE_UPDATE',
			data: messageData,
		});
	} else {
		await eventDispatcher.dispatchMessageUpdate(channel, messageData);
	}

	Logger.debug({messageId: latestMessage.id.toString()}, 'Dispatched MESSAGE_UPDATE after embed processing');
}

const extractEmbeds: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing extractEmbeds task');

	const {channelRepository, userCacheService, mediaService, gatewayService, embedService, cacheService} =
		getWorkerDependencies();

	const messageId = createMessageID(BigInt(validated.messageId));
	const channelId = createChannelID(BigInt(validated.channelId));

	const message = await channelRepository.getMessage(channelId, messageId);
	if (!message || !message.content) {
		Logger.debug({messageId}, 'Skipping extractEmbeds: message not found or no content');
		return;
	}

	const channel = await channelRepository.findUnique(channelId);
	if (!channel) {
		Logger.debug({channelId}, 'Skipping extractEmbeds: channel not found');
		return;
	}

	const guildId =
		validated.guildId && validated.guildId !== 'null' ? createGuildID(BigInt(validated.guildId)) : channel.guildId;

	const urls = UnfurlerUtils.extractURLs(message.content);
	if (urls.length === 0) {
		Logger.debug({messageId}, 'Skipping extractEmbeds: no URLs found');
		return;
	}

	const {cachedEmbedsByUrl, urlsToUnfurl} = await partitionUrlsByCache(urls, cacheService);
	if (urlsToUnfurl.length === 0) {
		Logger.debug({messageId}, 'Skipping extractEmbeds: all URLs already cached');
		return;
	}

	try {
		const isNSFWAllowed = validated.isNSFWAllowed ?? false;
		const unfurledEmbedsByUrl = await unfurlUrls(urlsToUnfurl, embedService, isNSFWAllowed);

		if (unfurledEmbedsByUrl.size === 0) {
			Logger.debug({messageId: messageId.toString()}, 'No URLs were successfully unfurled');
			return;
		}

		const orderedEmbeds = buildOrderedEmbeds(urls, cachedEmbedsByUrl, unfurledEmbedsByUrl);
		const latestMessage = await updateMessageEmbeds(channelRepository, channelId, messageId, orderedEmbeds);
		if (!latestMessage) {
			return;
		}

		if (!(message.flags & MessageFlags.SUPPRESS_EMBEDS)) {
			await dispatchEmbedUpdate({
				latestMessage,
				orderedEmbeds,
				channel,
				guildId,
				userCacheService,
				mediaService,
				gatewayService,
			});
		} else {
			Logger.debug({messageId: messageId.toString()}, 'Skipping MESSAGE_UPDATE dispatch due to SUPPRESS_EMBEDS flag');
		}

		Logger.debug(
			{messageId: messageId.toString(), embedCount: unfurledEmbedsByUrl.size},
			'Handled extractEmbeds successfully',
		);
	} catch (error) {
		Logger.error({error, messageId: messageId.toString()}, 'Failed to process embeds');
		throw error;
	}
};

export default extractEmbeds;
