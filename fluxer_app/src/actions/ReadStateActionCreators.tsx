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
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import MessageStore from '@app/stores/MessageStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {atPreviousMillisecond} from '@fluxer/snowflake/src/SnowflakeUtils';

const logger = new Logger('ReadStateActionCreators');

export function ack(channelId: string, immediate = false, force = false): void {
	logger.debug(`Acking channel ${channelId}, immediate=${immediate}, force=${force}`);
	ReadStateStore.handleChannelAck({channelId, immediate, force});
}

export function ackWithStickyUnread(channelId: string): void {
	logger.debug(`Acking channel ${channelId} with sticky unread preservation`);
	ReadStateStore.handleChannelAckWithStickyUnread({channelId});
}

export async function manualAck(channelId: string, messageId: string): Promise<void> {
	try {
		logger.debug(`Manual ack: ${messageId} in ${channelId}`);
		const mentionCount = ReadStateStore.getManualAckMentionCount(channelId, messageId);

		await http.post({
			url: Endpoints.CHANNEL_MESSAGE_ACK(channelId, messageId),
			body: {
				manual: true,
				mention_count: mentionCount,
			},
		});

		ReadStateStore.handleMessageAck({channelId, messageId, manual: true});
		logger.debug(`Successfully manual acked ${messageId}`);
	} catch (error) {
		logger.error(`Failed to manual ack ${messageId}:`, error);
		throw error;
	}
}

export async function markAsUnread(channelId: string, messageId: string): Promise<void> {
	const messages = MessageStore.getMessages(channelId);
	const messagesArray = messages.toArray();
	const messageIndex = messagesArray.findIndex((m) => m.id === messageId);

	logger.debug(`Marking message ${messageId} as unread, index: ${messageIndex}, total: ${messagesArray.length}`);

	if (messageIndex < 0) {
		logger.debug('Message not found in cache; skipping mark-as-unread request');
		return;
	}

	const ackMessageId = messageIndex > 0 ? messagesArray[messageIndex - 1].id : atPreviousMillisecond(messageId);

	if (!ackMessageId || ackMessageId === '0') {
		logger.debug('Unable to determine a previous message to ack; skipping mark-as-unread request');
		return;
	}

	logger.debug(`Acking ${ackMessageId} to mark ${messageId} as unread`);
	await manualAck(channelId, ackMessageId);
}

export function clearManualAck(channelId: string): void {
	ReadStateStore.handleClearManualAck({channelId});
}

export function clearStickyUnread(channelId: string): void {
	logger.debug(`Clearing sticky unread for ${channelId}`);
	ReadStateStore.clearStickyUnread(channelId);
}

interface BulkAckEntry {
	channelId: string;
	messageId: string;
}

const BULK_ACK_BATCH_SIZE = 100;

function chunkEntries<T>(entries: Array<T>, size: number): Array<Array<T>> {
	const chunks: Array<Array<T>> = [];
	for (let i = 0; i < entries.length; i += size) {
		chunks.push(entries.slice(i, i + size));
	}
	return chunks;
}

function createBulkEntry(channelId: string): BulkAckEntry | null {
	const messageId =
		ReadStateStore.lastMessageId(channelId) ?? ChannelStore.getChannel(channelId)?.lastMessageId ?? null;

	if (messageId == null) {
		return null;
	}

	return {channelId, messageId};
}

async function sendBulkAck(entries: Array<BulkAckEntry>): Promise<void> {
	if (entries.length === 0) return;

	try {
		await http.post({
			url: Endpoints.READ_STATES_ACK_BULK,
			body: {
				read_states: entries.map((entry) => ({
					channel_id: entry.channelId,
					message_id: entry.messageId,
				})),
			},
		});
	} catch (error) {
		logger.error('Failed to bulk ack read states:', error);
	}
}

function updateReadStatesLocally(entries: Array<BulkAckEntry>): void {
	for (const entry of entries) {
		ReadStateStore.handleMessageAck({channelId: entry.channelId, messageId: entry.messageId, manual: false});
	}
}

export async function bulkAckChannels(channelIds: Array<string>): Promise<void> {
	const entries = channelIds
		.map((channelId) => createBulkEntry(channelId))
		.filter((entry): entry is BulkAckEntry => entry != null);

	if (entries.length === 0) return;

	const chunks = chunkEntries(entries, BULK_ACK_BATCH_SIZE);
	for (const chunk of chunks) {
		updateReadStatesLocally(chunk);
		await sendBulkAck(chunk);
	}
}
