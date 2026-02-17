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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import {FeatureTemporarilyDisabledModal} from '@app/components/alerts/FeatureTemporarilyDisabledModal';
import {MessageDeleteFailedModal} from '@app/components/alerts/MessageDeleteFailedModal';
import {MessageDeleteTooQuickModal} from '@app/components/alerts/MessageDeleteTooQuickModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {Endpoints} from '@app/Endpoints';
import type {JumpOptions} from '@app/lib/ChannelMessages';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import http from '@app/lib/HttpClient';
import {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import MessageQueue from '@app/lib/MessageQueue';
import type {MessageRecord} from '@app/records/MessageRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildNSFWAgreeStore from '@app/stores/GuildNSFWAgreeStore';
import MessageEditMobileStore from '@app/stores/MessageEditMobileStore';
import MessageEditStore from '@app/stores/MessageEditStore';
import MessageReferenceStore from '@app/stores/MessageReferenceStore';
import MessageReplyStore from '@app/stores/MessageReplyStore';
import MessageStore from '@app/stores/MessageStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {getApiErrorCode} from '@app/utils/ApiErrorUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {MessageFlags} from '@fluxer/constants/src/ChannelConstants';
import type {JumpType} from '@fluxer/constants/src/JumpConstants';
import {MAX_MESSAGES_PER_CHANNEL} from '@fluxer/constants/src/LimitConstants';
import type {MessageId} from '@fluxer/schema/src/branded/WireIds';
import type {
	AllowedMentions,
	Message,
	MessageReference,
	MessageStickerItem,
} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('MessageActionCreators');

const pendingDeletePromises = new Map<string, Promise<void>>();
const pendingFetchPromises = new Map<string, Promise<Array<Message>>>();

function shouldBlockMessageFetch(channelId: string): boolean {
	const channel = ChannelStore.getChannel(channelId);
	if (!channel || channel.isPrivate()) {
		return false;
	}

	return GuildNSFWAgreeStore.shouldShowGate({channelId: channel.id, guildId: channel.guildId ?? null});
}

function makeFetchKey(
	channelId: string,
	before: string | null,
	after: string | null,
	limit: number,
	jump?: JumpOptions,
): string {
	return JSON.stringify({
		channelId,
		before,
		after,
		limit,
		jump: jump
			? {
					present: !!jump.present,
					messageId: jump.messageId ?? null,
					offset: jump.offset ?? 0,
					flash: !!jump.flash,
					returnMessageId: jump.returnMessageId ?? null,
					jumpType: jump.jumpType ?? null,
				}
			: null,
	});
}

async function requestMissingGuildMembers(channelId: string, messages: Array<Message>): Promise<void> {
	const channel = ChannelStore.getChannel(channelId);
	if (!channel?.guildId) {
		return;
	}

	const guildId = channel.guildId;
	const currentUserId = AuthenticationStore.currentUserId;

	const authorIds = messages
		.filter((msg) => !msg.webhook_id && msg.author.id !== currentUserId)
		.map((msg) => msg.author.id);

	if (authorIds.length === 0) {
		return;
	}

	await GuildMemberStore.ensureMembersLoaded(guildId, authorIds);
}

interface SendMessageParams {
	content: string;
	nonce: string;
	hasAttachments?: boolean;
	allowedMentions?: AllowedMentions;
	messageReference?: MessageReference;
	flags?: number;
	favoriteMemeId?: string;
	stickers?: Array<MessageStickerItem>;
	tts?: boolean;
}

export function jumpToPresent(channelId: string, limit = MAX_MESSAGES_PER_CHANNEL): void {
	NavigationActionCreators.clearMessageIdForChannel(channelId);

	logger.debug(`Jumping to present in channel ${channelId}`);
	ReadStateActionCreators.clearStickyUnread(channelId);

	const jump: JumpOptions = {
		present: true,
	};

	if (MessageStore.hasPresent(channelId)) {
		MessageStore.handleLoadMessagesSuccessCached({channelId, jump, limit});
	} else {
		fetchMessages(channelId, null, null, limit, jump);
	}
}

export function jumpToMessage(
	channelId: string,
	messageId: string,
	flash = true,
	offset?: number,
	returnTargetId?: string,
	jumpType?: JumpType,
): void {
	logger.debug(`Jumping to message ${messageId} in channel ${channelId}`);

	fetchMessages(channelId, null, null, MAX_MESSAGES_PER_CHANNEL, {
		messageId: messageId as MessageId,
		flash,
		offset,
		returnMessageId: returnTargetId as MessageId | null | undefined,
		jumpType,
	});
}

const tryFetchMessagesCached = (
	channelId: string,
	before: string | null,
	after: string | null,
	limit: number,
	jump?: JumpOptions,
): boolean => {
	const messages = MessageStore.getMessages(channelId);

	if (jump?.messageId && messages.has(jump.messageId, true)) {
		MessageStore.handleLoadMessagesSuccessCached({channelId, jump, limit});
		return true;
	} else if (before && messages.hasBeforeCached(before)) {
		MessageStore.handleLoadMessagesSuccessCached({channelId, before, limit});
		return true;
	} else if (after && messages.hasAfterCached(after)) {
		MessageStore.handleLoadMessagesSuccessCached({channelId, after, limit});
		return true;
	}

	return false;
};

export async function fetchMessages(
	channelId: string,
	before: string | null,
	after: string | null,
	limit: number,
	jump?: JumpOptions,
): Promise<Array<Message>> {
	const key = makeFetchKey(channelId, before, after, limit, jump);
	const inFlight = pendingFetchPromises.get(key);
	if (inFlight) {
		logger.debug(`Using in-flight fetchMessages for channel ${channelId} (deduped)`);
		return inFlight;
	}

	if (shouldBlockMessageFetch(channelId)) {
		logger.debug(`Skipping message fetch for gated channel ${channelId}`);
		MessageStore.handleLoadMessagesBlocked({channelId});
		return [];
	}

	if (tryFetchMessagesCached(channelId, before, after, limit, jump)) {
		return [];
	}

	const promise = (async () => {
		if (DeveloperOptionsStore.slowMessageLoad) {
			logger.debug('Slow message load enabled, delaying by 3 seconds');
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}

		MessageStore.handleLoadMessages({channelId, jump});

		try {
			const timeStart = Date.now();
			logger.debug(`Fetching messages for channel ${channelId}`);

			const around = jump?.messageId;
			const response = await http.get<Array<Message>>({
				url: Endpoints.CHANNEL_MESSAGES(channelId),
				query: {before, after, limit, around: around ?? null},
				retries: 2,
			});
			const messages = response.body ?? [];

			const isBefore = before != null;
			const isAfter = after != null;
			const isReplacement = before == null && after == null;

			const halfLimit = Math.floor(limit / 2);
			let hasMoreBefore = around != null || (messages.length === limit && (isBefore || isReplacement));
			let hasMoreAfter = around != null || (isAfter && messages.length === limit);

			if (around) {
				const knownLatestMessageId =
					ReadStateStore.lastMessageId(channelId) ?? ChannelStore.getChannel(channelId)?.lastMessageId ?? null;
				const newestFetchedMessageId = messages[0]?.id ?? null;
				const targetIndex = messages.findIndex((msg: Message) => msg.id === around);
				const pageFilled = messages.length === limit;

				if (targetIndex === -1) {
					logger.warn(`Target message ${around} not found in response!`);
				} else {
					const messagesNewerThanTarget = targetIndex;
					const messagesOlderThanTarget = messages.length - targetIndex - 1;
					const isAtKnownLatest = newestFetchedMessageId != null && newestFetchedMessageId === knownLatestMessageId;

					hasMoreBefore = pageFilled || messagesOlderThanTarget >= halfLimit;
					hasMoreAfter = pageFilled || (messagesNewerThanTarget >= halfLimit && !isAtKnownLatest);

					logger.debug(
						`Jump to message ${around}: targetIndex=${targetIndex}, messagesNewer=${messagesNewerThanTarget}, messagesOlder=${messagesOlderThanTarget}, pageFilled=${pageFilled}, hasMoreBefore=${hasMoreBefore}, hasMoreAfter=${hasMoreAfter}, limit=${limit}, knownLatestMessageId=${knownLatestMessageId}, newestFetched=${newestFetchedMessageId}`,
					);
				}
			}

			logger.info(`Fetched ${messages.length} messages for channel ${channelId}, took ${Date.now() - timeStart}ms`);

			MessageStore.handleLoadMessagesSuccess({
				channelId,
				messages,
				isBefore,
				isAfter,
				hasMoreBefore,
				hasMoreAfter,
				cached: false,
				jump,
			});
			ReadStateStore.handleLoadMessages({
				channelId,
				isAfter,
				messages,
			});
			MessageReferenceStore.handleMessagesFetchSuccess(channelId, messages);

			void requestMissingGuildMembers(channelId, messages);

			return messages;
		} catch (error) {
			logger.error(`Failed to fetch messages for channel ${channelId}:`, error);
			MessageStore.handleLoadMessagesFailure({channelId});
			return [];
		}
	})();

	pendingFetchPromises.set(key, promise);
	promise.finally(() => pendingFetchPromises.delete(key));
	return promise;
}

export function send(channelId: string, params: SendMessageParams): Promise<Message | null> {
	return new Promise<Message | null>((resolve) => {
		logger.debug(`Enqueueing message for channel ${channelId}`);

		MessageQueue.enqueue(
			{
				type: 'send',
				channelId,
				nonce: params.nonce,
				content: params.content,
				hasAttachments: params.hasAttachments,
				allowedMentions: params.allowedMentions,
				messageReference: params.messageReference,
				flags: params.flags,
				favoriteMemeId: params.favoriteMemeId,
				stickers: params.stickers,
				tts: params.tts,
			},
			(result, error) => {
				if (result?.body) {
					logger.debug(`Message sent successfully in channel ${channelId}`);
					resolve(result.body);
				} else {
					if (error) {
						logger.debug(`Message send failed in channel ${channelId}`, error);
					}
					resolve(null);
				}
			},
		);
	});
}

export function edit(channelId: string, messageId: string, content?: string, flags?: number): Promise<Message | null> {
	return new Promise<Message | null>((resolve) => {
		logger.debug(`Enqueueing edit for message ${messageId} in channel ${channelId}`);

		MessageQueue.enqueue(
			{
				type: 'edit',
				channelId,
				messageId,
				content,
				flags,
			},
			(result, error) => {
				if (result?.body) {
					logger.debug(`Message edited successfully: ${messageId} in channel ${channelId}`);
					resolve(result.body);
				} else {
					if (error) {
						logger.debug(`Message edit failed: ${messageId} in channel ${channelId}`, error);
					}
					resolve(null);
				}
			},
		);
	});
}

export async function remove(channelId: string, messageId: string): Promise<void> {
	const pendingPromise = pendingDeletePromises.get(messageId);
	if (pendingPromise) {
		logger.debug(`Using in-flight delete request for message ${messageId}`);
		return pendingPromise;
	}

	const deletePromise = (async () => {
		try {
			logger.debug(`Deleting message ${messageId} in channel ${channelId}`);
			await http.delete({url: Endpoints.CHANNEL_MESSAGE(channelId, messageId)});
			logger.debug(`Successfully deleted message ${messageId} in channel ${channelId}`);
		} catch (error) {
			logger.error(`Failed to delete message ${messageId} in channel ${channelId}:`, error);

			if (error instanceof HttpError) {
				const {status} = error;
				const errorCode = getApiErrorCode(error);

				if (status === 429) {
					ModalActionCreators.push(modal(() => <MessageDeleteTooQuickModal />));
				} else if (status === 403 && errorCode === APIErrorCodes.FEATURE_TEMPORARILY_DISABLED) {
					ModalActionCreators.push(modal(() => <FeatureTemporarilyDisabledModal />));
				} else if (status === 404) {
					logger.debug(`Message ${messageId} was already deleted (404 response)`);
				} else {
					ModalActionCreators.push(modal(() => <MessageDeleteFailedModal />));
				}
			} else {
				ModalActionCreators.push(modal(() => <MessageDeleteFailedModal />));
			}

			throw error;
		} finally {
			pendingDeletePromises.delete(messageId);
		}
	})();

	pendingDeletePromises.set(messageId, deletePromise);
	return deletePromise;
}

interface ShowDeleteConfirmationOptions {
	message: MessageRecord;
	onDelete?: () => void;
}

export function showDeleteConfirmation(i18n: I18n, {message, onDelete}: ShowDeleteConfirmationOptions): void {
	ModalActionCreators.push(
		modal(() => (
			<ConfirmModal
				title={i18n._(msg`Delete Message`)}
				description={i18n._(msg`This will create a rift in the space-time continuum and cannot be undone.`)}
				message={message}
				primaryText={i18n._(msg`Delete`)}
				onPrimary={() => {
					remove(message.channelId, message.id);
					onDelete?.();
				}}
			/>
		)),
	);
}

export function deleteLocal(channelId: string, messageId: string): void {
	logger.debug(`Deleting message ${messageId} locally in channel ${channelId}`);
	MessageStore.handleMessageDelete({id: messageId, channelId});
}

export function revealMessage(channelId: string, messageId: string | null): void {
	logger.debug(`Revealing message ${messageId} in channel ${channelId}`);
	MessageStore.handleMessageReveal({channelId, messageId});
}

export function startReply(channelId: string, messageId: string, mentioning: boolean): void {
	logger.debug(`Starting reply to message ${messageId} in channel ${channelId}, mentioning=${mentioning}`);
	MessageReplyStore.startReply(channelId, messageId, mentioning);
	ComponentDispatch.dispatch('FOCUS_TEXTAREA', {channelId});
}

export function stopReply(channelId: string): void {
	logger.debug(`Stopping reply in channel ${channelId}`);
	MessageReplyStore.stopReply(channelId);
}

export function setReplyMentioning(channelId: string, mentioning: boolean): void {
	logger.debug(`Setting reply mentioning in channel ${channelId}: ${mentioning}`);
	MessageReplyStore.setMentioning(channelId, mentioning);
}

export function startEdit(channelId: string, messageId: string, initialContent: string): void {
	logger.debug(`Starting edit for message ${messageId} in channel ${channelId}`);
	const draftContent = MessageEditStore.getDraftContent(messageId);
	const contentToUse = draftContent ?? initialContent;
	MessageEditStore.startEditing(channelId, messageId, contentToUse);
}

export function stopEdit(channelId: string): void {
	logger.debug(`Stopping edit in channel ${channelId}`);
	MessageEditStore.stopEditing(channelId);
}

export function startEditMobile(channelId: string, messageId: string): void {
	logger.debug(`Starting mobile edit for message ${messageId} in channel ${channelId}`);
	MessageEditMobileStore.startEditingMobile(channelId, messageId);
}

export function stopEditMobile(channelId: string): void {
	logger.debug(`Stopping mobile edit in channel ${channelId}`);
	MessageEditMobileStore.stopEditingMobile(channelId);
}

export function createOptimistic(channelId: string, message: Message): void {
	logger.debug(`Creating optimistic message in channel ${channelId}`);
	MessageStore.handleIncomingMessage({channelId, message});
}

export function deleteOptimistic(channelId: string, messageId: string): void {
	logger.debug(`Deleting optimistic message ${messageId} in channel ${channelId}`);
	MessageStore.handleMessageDelete({channelId, id: messageId});
}

export function sendError(channelId: string, nonce: string): void {
	logger.debug(`Message send error for nonce ${nonce} in channel ${channelId}`);
	MessageStore.handleSendFailed({channelId, nonce});
}

export function retryLocal(channelId: string, messageId: string): void {
	logger.debug(`Retrying optimistic message ${messageId} in channel ${channelId}`);
	MessageStore.handleSendRetry({channelId, messageId});
}

export function editOptimistic(
	channelId: string,
	messageId: string,
	content: string,
): {originalContent: string; originalEditedTimestamp: string | null} | null {
	logger.debug(`Applying optimistic edit for message ${messageId} in channel ${channelId}`);
	return MessageStore.handleOptimisticEdit({channelId, messageId, content});
}

export function editRollback(
	channelId: string,
	messageId: string,
	originalContent: string,
	originalEditedTimestamp: string | null,
): void {
	logger.debug(`Rolling back edit for message ${messageId} in channel ${channelId}`);
	MessageStore.handleEditRollback({channelId, messageId, originalContent, originalEditedTimestamp});
}

export async function forward(
	channelIds: Array<string>,
	messageReference: {message_id: string; channel_id: string; guild_id?: string | null},
	optionalMessage?: string,
): Promise<void> {
	logger.debug(`Forwarding message ${messageReference.message_id} to ${channelIds.length} channels`);

	try {
		for (const channelId of channelIds) {
			const nonce = SnowflakeUtils.fromTimestamp(Date.now());
			await send(channelId, {
				content: '',
				nonce,
				messageReference: {
					message_id: messageReference.message_id,
					channel_id: messageReference.channel_id,
					guild_id: messageReference.guild_id || undefined,
					type: 1,
				},
				flags: 1,
			});

			if (optionalMessage) {
				const commentNonce = SnowflakeUtils.fromTimestamp(Date.now() + 1);
				await send(channelId, {
					content: optionalMessage,
					nonce: commentNonce,
				});
			}
		}
		logger.debug('Successfully forwarded message to all channels');
	} catch (error) {
		logger.error('Failed to forward message:', error);
		throw error;
	}
}

export async function toggleSuppressEmbeds(channelId: string, messageId: string, currentFlags: number): Promise<void> {
	try {
		const isSuppressed = (currentFlags & MessageFlags.SUPPRESS_EMBEDS) === MessageFlags.SUPPRESS_EMBEDS;
		const newFlags = isSuppressed
			? currentFlags & ~MessageFlags.SUPPRESS_EMBEDS
			: currentFlags | MessageFlags.SUPPRESS_EMBEDS;

		logger.debug(`${isSuppressed ? 'Unsuppressing' : 'Suppressing'} embeds for message ${messageId}`);

		await http.patch<Message>({
			url: Endpoints.CHANNEL_MESSAGE(channelId, messageId),
			body: {flags: newFlags},
		});

		logger.debug(`Successfully ${isSuppressed ? 'unsuppressed' : 'suppressed'} embeds for message ${messageId}`);
	} catch (error) {
		logger.error('Failed to toggle suppress embeds:', error);
		throw error;
	}
}

export async function deleteAttachment(channelId: string, messageId: string, attachmentId: string): Promise<void> {
	try {
		logger.debug(`Deleting attachment ${attachmentId} from message ${messageId}`);

		await http.delete({
			url: Endpoints.CHANNEL_MESSAGE_ATTACHMENT(channelId, messageId, attachmentId),
		});

		logger.debug(`Successfully deleted attachment ${attachmentId} from message ${messageId}`);
	} catch (error) {
		logger.error('Failed to delete attachment:', error);
		throw error;
	}
}
