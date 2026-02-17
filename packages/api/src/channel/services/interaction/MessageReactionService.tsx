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

import {type ChannelID, createEmojiID, type MessageID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {AuthenticatedChannel} from '@fluxer/api/src/channel/services/AuthenticatedChannel';
import {
	MessageInteractionBase,
	type ParsedEmoji,
} from '@fluxer/api/src/channel/services/interaction/MessageInteractionBase';
import {isGuildMemberTimedOut} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import type {MessageReaction} from '@fluxer/api/src/models/MessageReaction';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserToPartialResponse} from '@fluxer/api/src/user/UserMappers';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {MAX_REACTIONS_PER_MESSAGE, MAX_USERS_PER_MESSAGE_REACTION} from '@fluxer/constants/src/LimitConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {MaxReactionsPerMessageError} from '@fluxer/errors/src/domains/channel/MaxReactionsPerMessageError';
import {MaxUsersPerMessageReactionError} from '@fluxer/errors/src/domains/channel/MaxUsersPerMessageReactionError';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {CommunicationDisabledError} from '@fluxer/errors/src/domains/moderation/CommunicationDisabledError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {isValidSingleUnicodeEmoji} from '@fluxer/schema/src/primitives/EmojiValidators';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

const REACTION_CUSTOM_EMOJI_REGEX = /^(.+):(\d+)$/;

export class MessageReactionService extends MessageInteractionBase {
	constructor(
		gatewayService: IGatewayService,
		private channelRepository: IChannelRepositoryAggregate,
		private userRepository: IUserRepository,
		private guildRepository: IGuildRepositoryAggregate,
		private limitConfigService: LimitConfigService,
	) {
		super(gatewayService);
	}

	private resolveLimitForUser(params: {
		user: User | null;
		guildFeatures?: Iterable<string> | null;
		key: LimitKey;
		fallback: number;
	}): number {
		const ctx = createLimitMatchContext({user: params.user, guildFeatures: params.guildFeatures});
		const limitValue = resolveLimit(this.limitConfigService.getConfigSnapshot(), ctx, params.key);
		if (!Number.isFinite(limitValue) || limitValue < 0) {
			return Math.max(0, Math.floor(params.fallback));
		}
		return Math.floor(limitValue);
	}

	private async assertMessageHistoryAccess({
		authChannel,
		messageId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
	}): Promise<void> {
		const {guild, hasPermission} = authChannel;
		if (!guild) {
			return;
		}

		if (await hasPermission(Permissions.READ_MESSAGE_HISTORY)) {
			return;
		}

		const cutoff = guild.message_history_cutoff;
		if (!cutoff || snowflakeToDate(messageId).getTime() < new Date(cutoff).getTime()) {
			throw new UnknownMessageError();
		}
	}

	async getUsersForReaction({
		authChannel,
		messageId,
		emoji,
		limit,
		after,
		userId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		emoji: string;
		limit?: number;
		after?: UserID;
		userId: UserID;
	}): Promise<Array<UserPartialResponse>> {
		const {channel, guild} = authChannel;
		this.ensureTextChannel(channel);
		await this.assertMessageHistoryAccess({authChannel, messageId});

		const requestingUser = await this.userRepository.findUnique(userId);
		const guildFeatures = guild?.features ?? null;
		const runtimeMaxUsers = this.resolveLimitForUser({
			user: requestingUser ?? null,
			guildFeatures,
			key: 'max_users_per_message_reaction',
			fallback: MAX_USERS_PER_MESSAGE_REACTION,
		});
		const limitCap = runtimeMaxUsers > 0 ? runtimeMaxUsers : Number.MAX_SAFE_INTEGER;
		const defaultLimit = Math.min(limitCap, 25);
		const requestedLimit = limit !== undefined && Number.isFinite(limit) ? Math.floor(limit) : defaultLimit;
		const validatedLimit = Math.min(Math.max(requestedLimit, 1), limitCap);

		const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) throw new UnknownMessageError();

		const parsedEmoji = this.parseEmojiWithoutValidation(emoji);
		const afterUserId = after;

		const reactions = await this.channelRepository.messageInteractions.listReactionUsers(
			channel.id,
			messageId,
			parsedEmoji.name,
			validatedLimit,
			afterUserId,
			parsedEmoji.id ? createEmojiID(BigInt(parsedEmoji.id)) : undefined,
		);

		if (!reactions.length) return [];

		const userIds = reactions.map((reaction: MessageReaction) => reaction.userId);
		const users = await this.userRepository.listUsers(userIds);

		getMetricsService().counter({name: 'fluxer.reactions.users_fetched'});

		return users.map((user) => mapUserToPartialResponse(user));
	}

	async addReaction({
		authChannel,
		messageId,
		emoji,
		userId,
		sessionId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		emoji: string;
		userId: UserID;
		sessionId?: string;
	}): Promise<void> {
		try {
			const {channel, guild, hasPermission, checkPermission} = authChannel;
			this.ensureTextChannel(channel);
			const isMemberTimedOut = isGuildMemberTimedOut(authChannel.member);
			await this.assertMessageHistoryAccess({authChannel, messageId});

			if (this.isOperationDisabled(guild, GuildOperations.REACTIONS)) {
				throw new FeatureTemporarilyDisabledError();
			}

			const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
			if (!message) throw new UnknownMessageError();

			const requestingUser = await this.userRepository.findUnique(userId);
			const guildFeatures = guild?.features ?? null;
			const maxUsersPerReaction = this.resolveLimitForUser({
				user: requestingUser ?? null,
				guildFeatures,
				key: 'max_users_per_message_reaction',
				fallback: MAX_USERS_PER_MESSAGE_REACTION,
			});
			const maxReactionsPerMessage = this.resolveLimitForUser({
				user: requestingUser ?? null,
				guildFeatures,
				key: 'max_reactions_per_message',
				fallback: MAX_REACTIONS_PER_MESSAGE,
			});

			const parsedEmojiBasic = this.parseEmojiWithoutValidation(emoji);
			const emojiId = parsedEmojiBasic.id ? createEmojiID(BigInt(parsedEmojiBasic.id)) : undefined;

			const userReactionExists = await this.channelRepository.messageInteractions.checkUserReactionExists(
				channel.id,
				messageId,
				userId,
				parsedEmojiBasic.name,
				emojiId,
			);

			if (userReactionExists) return;

			const reactionCount = await this.channelRepository.messageInteractions.countReactionUsers(
				channel.id,
				messageId,
				parsedEmojiBasic.name,
				emojiId,
			);

			if (reactionCount === 0 && guild) {
				await checkPermission(Permissions.ADD_REACTIONS);
			}

			let parsedEmoji: ParsedEmoji;

			if (reactionCount > 0) {
				parsedEmoji = parsedEmojiBasic;
			} else {
				parsedEmoji = await this.parseAndValidateEmoji({
					emoji,
					guildId: channel.guildId?.toString() || undefined,
					userId,
					hasPermission: channel.guildId ? hasPermission : undefined,
				});
			}

			if (reactionCount >= maxUsersPerReaction) {
				throw new MaxUsersPerMessageReactionError(maxUsersPerReaction);
			}

			const uniqueReactionCount = await this.channelRepository.messageInteractions.countUniqueReactions(
				channel.id,
				messageId,
			);

			if (isMemberTimedOut && reactionCount === 0) {
				throw new CommunicationDisabledError();
			}

			if (uniqueReactionCount >= maxReactionsPerMessage) {
				throw new MaxReactionsPerMessageError(maxReactionsPerMessage);
			}

			await this.channelRepository.messageInteractions.addReaction(
				channel.id,
				messageId,
				userId,
				parsedEmoji.name,
				emojiId,
				parsedEmoji.animated ?? false,
			);

			await this.dispatchMessageReactionAdd({
				channel,
				messageId,
				emoji: parsedEmoji,
				userId,
				sessionId,
			});

			getMetricsService().counter({name: 'reaction.add'});
		} catch (error) {
			getMetricsService().counter({name: 'reaction.add.error'});
			throw error;
		}
	}

	async removeReaction({
		authChannel,
		messageId,
		emoji,
		targetId,
		sessionId,
		actorId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		emoji: string;
		targetId: UserID;
		sessionId?: string;
		actorId: UserID;
	}): Promise<void> {
		try {
			const {channel, guild, hasPermission} = authChannel;
			this.ensureTextChannel(channel);
			await this.assertMessageHistoryAccess({authChannel, messageId});

			if (this.isOperationDisabled(guild, GuildOperations.REACTIONS)) {
				throw new FeatureTemporarilyDisabledError();
			}

			const parsedEmoji = this.parseEmojiWithoutValidation(emoji);

			const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
			if (!message) return;

			const isRemovingOwnReaction = targetId === actorId;
			if (!isRemovingOwnReaction) {
				await this.assertCanModerateMessageReactions({channel, message, actorId, hasPermission});
			}

			const emojiId = parsedEmoji.id ? createEmojiID(BigInt(parsedEmoji.id)) : undefined;
			await this.channelRepository.messageInteractions.removeReaction(
				channel.id,
				messageId,
				targetId,
				parsedEmoji.name,
				emojiId,
			);

			await this.dispatchMessageReactionRemove({
				channel,
				messageId,
				emoji: parsedEmoji,
				userId: targetId,
				sessionId,
			});

			getMetricsService().counter({name: 'reaction.remove'});
		} catch (error) {
			getMetricsService().counter({name: 'reaction.remove.error'});
			throw error;
		}
	}

	async removeAllReactionsForEmoji({
		authChannel,
		messageId,
		emoji,
		actorId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		emoji: string;
		actorId: UserID;
	}): Promise<void> {
		const {channel, guild, hasPermission} = authChannel;
		this.ensureTextChannel(channel);
		await this.assertMessageHistoryAccess({authChannel, messageId});

		if (this.isOperationDisabled(guild, GuildOperations.REACTIONS)) {
			throw new FeatureTemporarilyDisabledError();
		}

		const parsedEmoji = this.parseEmojiWithoutValidation(emoji);

		const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) return;

		await this.assertCanModerateMessageReactions({channel, message, actorId, hasPermission});

		const emojiId = parsedEmoji.id ? createEmojiID(BigInt(parsedEmoji.id)) : undefined;
		await this.channelRepository.messageInteractions.removeAllReactionsForEmoji(
			channel.id,
			messageId,
			parsedEmoji.name,
			emojiId,
		);

		await this.dispatchMessageReactionRemoveAllForEmoji({
			channel,
			messageId,
			emoji: parsedEmoji,
		});

		getMetricsService().counter({name: 'fluxer.reactions.emoji_cleared'});
	}

	async removeAllReactions({
		authChannel,
		messageId,
		actorId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		actorId: UserID;
	}): Promise<void> {
		const {channel, guild, hasPermission} = authChannel;
		this.ensureTextChannel(channel);
		await this.assertMessageHistoryAccess({authChannel, messageId});

		if (this.isOperationDisabled(guild, GuildOperations.REACTIONS)) {
			throw new FeatureTemporarilyDisabledError();
		}

		const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) return;

		await this.assertCanModerateMessageReactions({channel, message, actorId, hasPermission});

		await this.channelRepository.messageInteractions.removeAllReactions(channel.id, messageId);

		await this.dispatchMessageReactionRemoveAll({channel, messageId});

		getMetricsService().counter({name: 'fluxer.reactions.all_cleared'});
	}

	async getMessageReactions({
		authChannel,
		messageId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
	}): Promise<Array<MessageReaction>> {
		await this.assertMessageHistoryAccess({authChannel, messageId});
		return this.channelRepository.messageInteractions.listMessageReactions(authChannel.channel.id, messageId);
	}

	async setHasReaction(channelId: ChannelID, messageId: MessageID, hasReaction: boolean): Promise<void> {
		return this.channelRepository.messageInteractions.setHasReaction(channelId, messageId, hasReaction);
	}

	private async assertCanModerateMessageReactions({
		channel,
		message,
		actorId,
		hasPermission,
	}: {
		channel: Channel;
		message: Message;
		actorId: UserID;
		hasPermission: (permission: bigint) => Promise<boolean>;
	}): Promise<void> {
		if (message.authorId === actorId) {
			return;
		}

		if (!channel.guildId) {
			throw new MissingPermissionsError();
		}

		const canManageMessages = await hasPermission(Permissions.MANAGE_MESSAGES);
		if (!canManageMessages) {
			throw new MissingPermissionsError();
		}
	}

	private parseEmojiWithoutValidation(emoji: string): {name: string; id?: string; animated?: boolean} {
		const decodedEmoji = decodeURIComponent(emoji);
		const customEmojiMatch = decodedEmoji.match(REACTION_CUSTOM_EMOJI_REGEX);

		if (customEmojiMatch) {
			const [, name, id] = customEmojiMatch;
			return {
				id,
				name: name || 'unknown',
			};
		}

		return {name: decodedEmoji};
	}

	private async parseAndValidateEmoji({
		emoji,
		guildId,
		userId,
		hasPermission,
	}: {
		emoji: string;
		guildId?: string | undefined;
		userId?: UserID;
		hasPermission?: (permission: bigint) => Promise<boolean>;
	}): Promise<ParsedEmoji> {
		const decodedEmoji = decodeURIComponent(emoji);
		const customEmojiMatch = decodedEmoji.match(REACTION_CUSTOM_EMOJI_REGEX);

		if (customEmojiMatch) {
			const [, , id] = customEmojiMatch;
			const emojiIdBigInt = createEmojiID(BigInt(id));

			let hasGlobalExpressions = 0;
			if (userId) {
				const user = await this.userRepository.findUnique(userId);
				const ctx = createLimitMatchContext({user});
				hasGlobalExpressions = resolveLimitSafe(
					this.limitConfigService.getConfigSnapshot(),
					ctx,
					'feature_global_expressions',
					0,
				);
			}

			const emoji = await this.guildRepository.getEmojiById(emojiIdBigInt);
			if (!emoji) {
				throw InputValidationError.fromCode('emoji', ValidationErrorCodes.CUSTOM_EMOJI_NOT_FOUND);
			}

			if (hasGlobalExpressions === 0 && emoji.guildId.toString() !== guildId) {
				throw InputValidationError.fromCode('emoji', ValidationErrorCodes.CUSTOM_EMOJIS_REQUIRE_PREMIUM_OUTSIDE_SOURCE);
			}

			if (hasPermission) {
				const canUseExternalEmojis = await hasPermission(Permissions.USE_EXTERNAL_EMOJIS);
				if (!canUseExternalEmojis) {
					throw new MissingPermissionsError();
				}
			}

			return {
				id,
				name: emoji.name,
				animated: emoji.isAnimated,
			};
		}

		if (!isValidSingleUnicodeEmoji(decodedEmoji)) {
			throw InputValidationError.fromCode('emoji', ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		}

		return {name: decodedEmoji};
	}

	private async dispatchMessageReactionAdd(params: {
		channel: Channel;
		messageId: MessageID;
		emoji: ParsedEmoji;
		userId: UserID;
		sessionId?: string;
	}): Promise<void> {
		await this.dispatchEvent({
			channel: params.channel,
			event: 'MESSAGE_REACTION_ADD',
			data: {
				channel_id: params.channel.id.toString(),
				message_id: params.messageId.toString(),
				emoji: params.emoji,
				user_id: params.userId.toString(),
				session_id: params.sessionId,
			},
		});
	}

	private async dispatchMessageReactionRemove(params: {
		channel: Channel;
		messageId: MessageID;
		emoji: ParsedEmoji;
		userId: UserID;
		sessionId?: string;
	}): Promise<void> {
		await this.dispatchEvent({
			channel: params.channel,
			event: 'MESSAGE_REACTION_REMOVE',
			data: {
				channel_id: params.channel.id.toString(),
				message_id: params.messageId.toString(),
				emoji: params.emoji,
				user_id: params.userId.toString(),
				session_id: params.sessionId,
			},
		});
	}

	private async dispatchMessageReactionRemoveAllForEmoji(params: {
		channel: Channel;
		messageId: MessageID;
		emoji: ParsedEmoji;
	}): Promise<void> {
		await this.dispatchEvent({
			channel: params.channel,
			event: 'MESSAGE_REACTION_REMOVE_EMOJI',
			data: {
				channel_id: params.channel.id.toString(),
				message_id: params.messageId.toString(),
				emoji: params.emoji,
			},
		});
	}

	private async dispatchMessageReactionRemoveAll(params: {channel: Channel; messageId: MessageID}): Promise<void> {
		await this.dispatchEvent({
			channel: params.channel,
			event: 'MESSAGE_REACTION_REMOVE_ALL',
			data: {
				channel_id: params.channel.id.toString(),
				message_id: params.messageId.toString(),
			},
		});
	}
}
