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

import {type ChannelID, createChannelID, type MessageID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {MessageRequest, MessageUpdateRequest} from '@fluxer/api/src/channel/MessageTypes';
import {MESSAGE_NONCE_TTL} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import type {User} from '@fluxer/api/src/models/User';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {
	isMessageTypeDeletable,
	MessageFlags,
	MessageTypes,
	Permissions,
	SENDABLE_MESSAGE_FLAGS,
	TEXT_BASED_CHANNEL_TYPES,
} from '@fluxer/constants/src/ChannelConstants';
import {
	ATTACHMENT_MAX_SIZE_NON_PREMIUM,
	MAX_ATTACHMENTS_PER_MESSAGE,
	MAX_EMBEDS_PER_MESSAGE,
	MAX_MESSAGE_LENGTH_NON_PREMIUM,
	MAX_VOICE_MESSAGE_DURATION,
} from '@fluxer/constants/src/LimitConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {CannotEditSystemMessageError} from '@fluxer/errors/src/domains/channel/CannotEditSystemMessageError';
import {CannotSendEmptyMessageError} from '@fluxer/errors/src/domains/channel/CannotSendEmptyMessageError';
import {CannotSendMessageToNonTextChannelError} from '@fluxer/errors/src/domains/channel/CannotSendMessageToNonTextChannelError';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {FileSizeTooLargeError} from '@fluxer/errors/src/domains/core/FileSizeTooLargeError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

export class MessageValidationService {
	constructor(
		private cacheService: ICacheService,
		private limitConfigService: LimitConfigService,
	) {}

	ensureTextChannel(channel: Channel): void {
		if (!TEXT_BASED_CHANNEL_TYPES.has(channel.type)) {
			throw new CannotSendMessageToNonTextChannelError();
		}
	}

	validateMessageContent(
		data: MessageRequest | MessageUpdateRequest,
		user: User | null,
		options?: {isUpdate?: boolean; guildFeatures?: Iterable<string> | null},
	): void {
		const isUpdate = options?.isUpdate ?? false;
		const hasContent = data.content != null && data.content.trim().length > 0;
		const hasEmbeds = Boolean(data.embeds && data.embeds.length > 0);
		const hasAttachments = Boolean(data.attachments && data.attachments.length > 0);
		const hasFavoriteMeme = Boolean('favorite_meme_id' in data && data.favorite_meme_id != null);
		const hasStickers = Boolean('sticker_ids' in data && data.sticker_ids != null && data.sticker_ids.length > 0);
		const hasFlags = data.flags !== undefined && data.flags !== null;
		const guildFeatures = options?.guildFeatures ?? null;

		const hasVoiceMessageFlag = !!(data.flags && data.flags & MessageFlags.VOICE_MESSAGE);
		if (hasVoiceMessageFlag) {
			this.validateVoiceMessageConstraints(
				data,
				hasContent,
				hasEmbeds,
				hasStickers,
				hasFavoriteMeme,
				user,
				guildFeatures,
			);
		}

		if (!hasContent && !hasEmbeds && !hasAttachments && !hasFavoriteMeme && !hasStickers && (!isUpdate || !hasFlags)) {
			throw new CannotSendEmptyMessageError();
		}

		this.validateContentLength(data.content, user, guildFeatures);

		const ctx = createLimitMatchContext({user, guildFeatures});
		const evaluationContext = guildFeatures ? 'guild' : 'user';

		const snapshot = this.limitConfigService.getConfigSnapshot();
		const maxEmbeds = Math.floor(
			resolveLimitSafe(snapshot, ctx, 'max_embeds_per_message', MAX_EMBEDS_PER_MESSAGE, evaluationContext),
		);
		const maxAttachments = Math.floor(
			resolveLimitSafe(snapshot, ctx, 'max_attachments_per_message', MAX_ATTACHMENTS_PER_MESSAGE, evaluationContext),
		);

		const totalEmbeds = data.embeds?.length ?? 0;
		if (totalEmbeds > maxEmbeds) {
			throw InputValidationError.fromCode('embeds', ValidationErrorCodes.TOO_MANY_EMBEDS, {maxEmbeds});
		}

		const totalAttachments = data.attachments?.length ?? 0;
		if (totalAttachments > maxAttachments) {
			throw InputValidationError.fromCode('attachments', ValidationErrorCodes.TOO_MANY_FILES, {
				maxFiles: maxAttachments,
			});
		}
	}

	validateContentLength(
		content: string | null | undefined,
		user: User | null,
		guildFeatures?: Iterable<string> | null,
	): void {
		if (content == null) return;

		const ctx = createLimitMatchContext({user, guildFeatures});
		const evaluationContext = guildFeatures ? 'guild' : 'user';
		const maxLength = Math.floor(
			resolveLimitSafe(
				this.limitConfigService.getConfigSnapshot(),
				ctx,
				'max_message_length',
				MAX_MESSAGE_LENGTH_NON_PREMIUM,
				evaluationContext,
			),
		);
		if (content.length > maxLength) {
			throw InputValidationError.fromCode('content', ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH, {
				maxLength,
			});
		}
	}

	validateMessageEditable(message: Message): void {
		const editableTypes: ReadonlySet<Message['type']> = new Set([MessageTypes.DEFAULT, MessageTypes.REPLY]);
		if (!editableTypes.has(message.type)) {
			throw new CannotEditSystemMessageError();
		}
	}

	calculateMessageFlags(data: {flags?: number; favorite_meme_id?: bigint | null}): number {
		let flags = data.flags ? data.flags & SENDABLE_MESSAGE_FLAGS : 0;

		if (data.favorite_meme_id) {
			flags |= MessageFlags.COMPACT_ATTACHMENTS;
		}

		return flags;
	}

	validateTotalAttachmentSize(
		attachments: Array<{size: number | bigint}>,
		user: User,
		guildFeatures?: Iterable<string> | null,
	): void {
		const ctx = createLimitMatchContext({user, guildFeatures});
		const evaluationContext = guildFeatures ? 'guild' : 'user';
		const fallbackMaxSize = ATTACHMENT_MAX_SIZE_NON_PREMIUM;
		const maxFileSize = Math.floor(
			resolveLimitSafe(
				this.limitConfigService.getConfigSnapshot(),
				ctx,
				'max_attachment_file_size',
				fallbackMaxSize,
				evaluationContext,
			),
		);

		const hasFileExceedingLimit = attachments.some((attachment) => Number(attachment.size) > maxFileSize);
		if (hasFileExceedingLimit) {
			throw new FileSizeTooLargeError(maxFileSize);
		}
	}

	async findExistingMessage({
		userId,
		nonce,
		expectedChannelId,
	}: {
		userId: UserID;
		nonce?: string;
		expectedChannelId: ChannelID;
	}): Promise<Message | null> {
		if (!nonce) return null;

		const existingNonce = await this.cacheService.get<{channel_id: string; message_id: string}>(
			`message-nonce:${userId}:${nonce}`,
		);

		if (!existingNonce) return null;

		const cachedChannelId = createChannelID(BigInt(existingNonce.channel_id));
		if (cachedChannelId !== expectedChannelId) {
			throw new UnknownMessageError();
		}

		return null;
	}

	async cacheMessageNonce({
		userId,
		nonce,
		channelId,
		messageId,
	}: {
		userId: UserID;
		nonce: string;
		channelId: ChannelID;
		messageId: MessageID;
	}): Promise<void> {
		await this.cacheService.set(
			`message-nonce:${userId}:${nonce}`,
			{
				channel_id: channelId.toString(),
				message_id: messageId.toString(),
			},
			MESSAGE_NONCE_TTL,
		);
	}

	async canDeleteMessage({
		message,
		userId,
		guild,
		hasPermission,
	}: {
		message: Message;
		userId: UserID;
		guild: GuildResponse | null;
		hasPermission: (permission: bigint) => Promise<boolean>;
	}): Promise<boolean> {
		if (!isMessageTypeDeletable(message.type)) {
			return false;
		}

		const isAuthor = message.authorId === userId;
		if (!guild) return isAuthor;

		const canManageMessages =
			(await hasPermission(Permissions.SEND_MESSAGES)) && (await hasPermission(Permissions.MANAGE_MESSAGES));
		return isAuthor || canManageMessages;
	}

	private validateVoiceMessageConstraints(
		data: MessageRequest,
		hasContent: boolean,
		hasEmbeds: boolean,
		hasStickers: boolean,
		hasFavoriteMeme: boolean,
		user: User | null,
		guildFeatures: Iterable<string> | null | undefined,
	): void {
		if (hasContent) {
			throw InputValidationError.fromCode('content', ValidationErrorCodes.VOICE_MESSAGES_CANNOT_HAVE_CONTENT);
		}

		if (hasEmbeds) {
			throw InputValidationError.fromCode('embeds', ValidationErrorCodes.VOICE_MESSAGES_CANNOT_HAVE_EMBEDS);
		}

		if (hasFavoriteMeme) {
			throw InputValidationError.fromCode(
				'favorite_meme_id',
				ValidationErrorCodes.VOICE_MESSAGES_CANNOT_HAVE_FAVORITE_MEMES,
			);
		}

		if (hasStickers) {
			throw InputValidationError.fromCode('sticker_ids', ValidationErrorCodes.VOICE_MESSAGES_CANNOT_HAVE_STICKERS);
		}

		const attachments = data.attachments ?? [];
		if (attachments.length !== 1) {
			throw InputValidationError.fromCode('attachments', ValidationErrorCodes.VOICE_MESSAGES_REQUIRE_SINGLE_ATTACHMENT);
		}

		const attachment = attachments[0];
		if (!('waveform' in attachment) || !attachment.waveform) {
			throw InputValidationError.fromCode(
				'attachments.0.waveform',
				ValidationErrorCodes.VOICE_MESSAGES_ATTACHMENT_WAVEFORM_REQUIRED,
			);
		}
		if (!('duration' in attachment) || attachment.duration == null) {
			throw InputValidationError.fromCode(
				'attachments.0.duration',
				ValidationErrorCodes.VOICE_MESSAGES_ATTACHMENT_DURATION_REQUIRED,
			);
		}

		const duration = attachment.duration;
		const ctx = createLimitMatchContext({user, guildFeatures});
		const evaluationContext = guildFeatures ? 'guild' : 'user';
		const maxDuration = Math.floor(
			resolveLimitSafe(
				this.limitConfigService.getConfigSnapshot(),
				ctx,
				'max_voice_message_duration',
				MAX_VOICE_MESSAGE_DURATION,
				evaluationContext,
			),
		);
		if (duration > maxDuration) {
			throw InputValidationError.fromCode(
				'attachments.0.duration',
				ValidationErrorCodes.VOICE_MESSAGES_DURATION_EXCEEDS_LIMIT,
				{maxDuration},
			);
		}
	}
}
