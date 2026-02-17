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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildNSFWAgreeStore from '@app/stores/GuildNSFWAgreeStore';
import MessageStore from '@app/stores/MessageStore';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('MessageReferenceStore');

export const MessageReferenceState = {
	LOADED: 'LOADED',
	NOT_LOADED: 'NOT_LOADED',
	DELETED: 'DELETED',
} as const;
export type MessageReferenceState = ValueOf<typeof MessageReferenceState>;

class MessageReferenceStore {
	deletedMessageIds = new Set<string>();
	cachedMessages = new Map<string, MessageRecord>();
	private referenceCount = new Map<string, Set<string>>();
	private referencingMessages = new Map<string, {channelId: string; messageId: string}>();

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	private getKey(channelId: string, messageId: string): string {
		return `${channelId}:${messageId}`;
	}

	private addReference(refChannelId: string, refMessageId: string, referencingMessageId: string): void {
		const key = this.getKey(refChannelId, refMessageId);
		let refs = this.referenceCount.get(key);
		if (!refs) {
			refs = new Set<string>();
			this.referenceCount.set(key, refs);
		}
		refs.add(referencingMessageId);
		this.referencingMessages.set(referencingMessageId, {channelId: refChannelId, messageId: refMessageId});
	}

	private removeReference(refChannelId: string, refMessageId: string, referencingMessageId: string): void {
		const key = this.getKey(refChannelId, refMessageId);
		const refs = this.referenceCount.get(key);
		if (refs) {
			refs.delete(referencingMessageId);
			if (refs.size === 0) {
				this.referenceCount.delete(key);
				this.cachedMessages.delete(key);
			}
		}
		this.referencingMessages.delete(referencingMessageId);
	}

	handleMessageCreate(message: Message, _optimistic: boolean): void {
		if (message.referenced_message) {
			const refChannelId = message.message_reference?.channel_id ?? message.channel_id;
			const refMessageId = message.referenced_message.id;
			const key = this.getKey(refChannelId, refMessageId);
			if (!this.cachedMessages.has(key)) {
				const referencedMessageRecord = new MessageRecord(message.referenced_message);
				this.cachedMessages.set(key, referencedMessageRecord);
			}
			this.addReference(refChannelId, refMessageId, message.id);
		}
	}

	handleMessageDelete(channelId: string, messageId: string): void {
		const key = this.getKey(channelId, messageId);
		this.deletedMessageIds.add(key);
		this.cachedMessages.delete(key);
		this.referenceCount.delete(key);

		const referencedBy = this.referencingMessages.get(messageId);
		if (referencedBy) {
			this.removeReference(referencedBy.channelId, referencedBy.messageId, messageId);
		}
	}

	handleMessageDeleteBulk(channelId: string, messageIds: Array<string>): void {
		for (const messageId of messageIds) {
			const key = this.getKey(channelId, messageId);
			this.deletedMessageIds.add(key);
			this.cachedMessages.delete(key);
			this.referenceCount.delete(key);

			const referencedBy = this.referencingMessages.get(messageId);
			if (referencedBy) {
				this.removeReference(referencedBy.channelId, referencedBy.messageId, messageId);
			}
		}
	}

	handleMessagesFetchSuccess(channelId: string, messages: Array<Message>): void {
		for (const message of messages) {
			if (message.referenced_message) {
				const refChannelId = message.message_reference?.channel_id ?? channelId;
				const refMessageId = message.referenced_message.id;
				const key = this.getKey(refChannelId, refMessageId);
				if (!this.cachedMessages.has(key)) {
					const referencedMessageRecord = new MessageRecord(message.referenced_message);
					this.cachedMessages.set(key, referencedMessageRecord);
				}
				this.addReference(refChannelId, refMessageId, message.id);
			}
		}

		const potentiallyMissingMessageIds = messages
			.filter((message) => message.message_reference && !message.referenced_message)
			.map((message) => ({
				channelId: message.message_reference!.channel_id ?? channelId,
				messageId: message.message_reference!.message_id,
				referencingMessageId: message.id,
			}))
			.filter(
				({channelId: refChannelId, messageId}) =>
					!MessageStore.getMessage(refChannelId, messageId) &&
					!this.deletedMessageIds.has(this.getKey(refChannelId, messageId)) &&
					!this.cachedMessages.has(this.getKey(refChannelId, messageId)),
			);

		for (const {channelId: refChannelId, messageId, referencingMessageId} of potentiallyMissingMessageIds) {
			this.addReference(refChannelId, messageId, referencingMessageId);
		}

		if (potentiallyMissingMessageIds.length > 0) {
			this.fetchMissingMessages(potentiallyMissingMessageIds.map(({channelId, messageId}) => ({channelId, messageId})));
		}
	}

	handleChannelDelete(channelId: string): void {
		this.cleanupChannelMessages(channelId);
	}

	handleConnectionOpen(): void {
		this.deletedMessageIds.clear();
		this.cachedMessages.clear();
		this.referenceCount.clear();
		this.referencingMessages.clear();
	}

	handleMessageUpdate(message: Message): void {
		const previousRef = this.referencingMessages.get(message.id);
		const newRefChannelId = message.message_reference?.channel_id ?? message.channel_id;
		const newRefMessageId = message.referenced_message?.id;

		if (previousRef) {
			const previousKey = this.getKey(previousRef.channelId, previousRef.messageId);
			const newKey = newRefMessageId ? this.getKey(newRefChannelId, newRefMessageId) : null;
			if (previousKey !== newKey) {
				this.removeReference(previousRef.channelId, previousRef.messageId, message.id);
			}
		}

		if (message.referenced_message) {
			const refMessageId = message.referenced_message.id;
			const key = this.getKey(newRefChannelId, refMessageId);
			if (!this.cachedMessages.has(key)) {
				const referencedMessageRecord = new MessageRecord(message.referenced_message);
				this.cachedMessages.set(key, referencedMessageRecord);
			}
			this.addReference(newRefChannelId, refMessageId, message.id);
		}
	}

	private fetchMissingMessages(refs: Array<{channelId: string; messageId: string}>): void {
		const allowedRefs = refs.filter(({channelId}) => {
			const channel = ChannelStore.getChannel(channelId);
			if (!channel) {
				// Be conservative: if we can't resolve the channel, don't fetch message content.
				return false;
			}
			if (channel.isPrivate()) {
				return true;
			}
			return !GuildNSFWAgreeStore.shouldShowGate({channelId: channel.id, guildId: channel.guildId ?? null});
		});

		if (allowedRefs.length === 0) {
			return;
		}

		Promise.allSettled(
			allowedRefs.map(({channelId, messageId}) =>
				http
					.get<Message>({
						url: Endpoints.CHANNEL_MESSAGE(channelId, messageId),
					})
					.then((response) => {
						if (response.body) {
							this.handleMessageFetchSuccess(channelId, messageId, response.body);
						}
					})
					.catch((error) => this.handleMessageFetchError(channelId, messageId, error)),
			),
		);
	}

	private handleMessageFetchSuccess(channelId: string, messageId: string, message: Message): void {
		const messageRecord = new MessageRecord(message);
		const key = this.getKey(channelId, messageId);
		this.cachedMessages.set(key, messageRecord);
	}

	private handleMessageFetchError(channelId: string, messageId: string, error: unknown): void {
		const key = this.getKey(channelId, messageId);

		if (error instanceof HttpError && error.status === 404) {
			this.deletedMessageIds.add(key);
			this.cachedMessages.delete(key);
		} else {
			logger.error(`Failed to fetch message ${messageId}`, error);
		}
	}

	private cleanupChannelMessages(channelId: string): void {
		const channelPrefix = `${channelId}:`;

		for (const key of Array.from(this.deletedMessageIds)) {
			if (key.startsWith(channelPrefix)) {
				this.deletedMessageIds.delete(key);
			}
		}

		for (const key of Array.from(this.cachedMessages.keys())) {
			if (key.startsWith(channelPrefix)) {
				this.cachedMessages.delete(key);
			}
		}

		for (const key of Array.from(this.referenceCount.keys())) {
			if (key.startsWith(channelPrefix)) {
				this.referenceCount.delete(key);
			}
		}

		for (const [messageId, ref] of Array.from(this.referencingMessages.entries())) {
			if (ref.channelId === channelId) {
				this.referencingMessages.delete(messageId);
			}
		}
	}

	getMessage(channelId: string, messageId: string): MessageRecord | null {
		const key = this.getKey(channelId, messageId);

		if (this.deletedMessageIds.has(key)) {
			return null;
		}

		return MessageStore.getMessage(channelId, messageId) || this.cachedMessages.get(key) || null;
	}

	getMessageReference(
		channelId: string,
		messageId: string,
	): {
		message: MessageRecord | null;
		state: MessageReferenceState;
	} {
		const key = this.getKey(channelId, messageId);

		if (this.deletedMessageIds.has(key)) {
			return {
				message: null,
				state: MessageReferenceState.DELETED,
			};
		}

		const message = MessageStore.getMessage(channelId, messageId);
		if (message) {
			return {
				message,
				state: MessageReferenceState.LOADED,
			};
		}

		const cachedMessage = this.cachedMessages.get(key);
		if (cachedMessage) {
			return {
				message: cachedMessage,
				state: MessageReferenceState.LOADED,
			};
		}

		return {
			message: null,
			state: MessageReferenceState.NOT_LOADED,
		};
	}
}

export default new MessageReferenceStore();
