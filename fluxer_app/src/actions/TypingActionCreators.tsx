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
import TypingStore from '@app/stores/TypingStore';

const logger = new Logger('Typing');

export async function sendTyping(channelId: string): Promise<void> {
	try {
		logger.debug(`Sending typing indicator to channel ${channelId}`);
		await http.post({url: Endpoints.CHANNEL_TYPING(channelId)});
		logger.debug(`Successfully sent typing indicator to channel ${channelId}`);
	} catch (error) {
		logger.error(`Failed to send typing indicator to channel ${channelId}:`, error);
	}
}

export function startTyping(channelId: string, userId: string): void {
	logger.debug(`Starting typing indicator for user ${userId} in channel ${channelId}`);
	TypingStore.startTyping(channelId, userId);
}

export function stopTyping(channelId: string, userId: string): void {
	logger.debug(`Stopping typing indicator for user ${userId} in channel ${channelId}`);
	TypingStore.stopTyping(channelId, userId);
}
