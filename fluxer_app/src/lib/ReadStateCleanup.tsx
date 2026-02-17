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
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import InitializationStore from '@app/stores/InitializationStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {reaction} from 'mobx';

const logger = new Logger('ReadStateCleanup');
const CLEANUP_INTERVAL_MS = 300;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let cleanupTask: Promise<void> | null = null;
let cleanupReactionDisposer: (() => void) | null = null;

function collectStaleChannels(): Array<string> {
	const channelIds = ReadStateStore.getChannelIds();
	return channelIds.filter((channelId) => {
		return ChannelStore.getChannel(channelId) == null;
	});
}

async function deleteReadState(channelId: string): Promise<void> {
	try {
		await http.delete({url: Endpoints.CHANNEL_MESSAGES_ACK(channelId)});
	} catch (error) {
		logger.warn(`Failed to delete read state for ${channelId}:`, error);
	} finally {
		ReadStateStore.clear(channelId);
	}
}

async function runCleanup(): Promise<void> {
	if (cleanupTask) {
		return cleanupTask;
	}

	cleanupTask = (async () => {
		try {
			const staleChannels = collectStaleChannels();
			if (staleChannels.length === 0) {
				return;
			}

			logger.info(`Cleaning up ${staleChannels.length} stale read state(s)`);
			for (const [index, channelId] of staleChannels.entries()) {
				await deleteReadState(channelId);
				if (index < staleChannels.length - 1) {
					await sleep(CLEANUP_INTERVAL_MS);
				}
			}
		} finally {
			cleanupTask = null;
		}
	})();

	return cleanupTask;
}

export function startReadStateCleanup(): void {
	if (cleanupReactionDisposer) {
		return;
	}

	cleanupReactionDisposer = reaction(
		() =>
			InitializationStore.isReady &&
			AuthenticationStore.isAuthenticated &&
			GuildAvailabilityStore.totalUnavailableGuilds === 0,
		(canCleanup) => {
			if (!canCleanup) return;
			void runCleanup();
		},
		{fireImmediately: true},
	);
}
