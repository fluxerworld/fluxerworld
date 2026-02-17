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

import {Logger} from '@app/lib/Logger';
import NavigationStore from '@app/stores/NavigationStore';
import {FAVORITES_GUILD_ID, ME} from '@fluxer/constants/src/AppConstants';

const logger = new Logger('Navigation');

type NavigationMode = 'push' | 'replace';

export function selectChannel(
	guildId?: string,
	channelId?: string | null,
	messageId?: string,
	mode: NavigationMode = 'push',
): void {
	logger.debug(`Selecting channel: guildId=${guildId}, channelId=${channelId}, messageId=${messageId}`);

	if (!guildId || guildId === ME) {
		NavigationStore.navigateToDM(channelId ?? undefined, messageId, mode);
	} else if (guildId === FAVORITES_GUILD_ID || guildId === '@favorites') {
		NavigationStore.navigateToFavorites(channelId ?? undefined, messageId, mode);
	} else {
		NavigationStore.navigateToGuild(guildId, channelId ?? undefined, messageId, mode);
	}
}

export function selectGuild(guildId: string, channelId?: string, mode: NavigationMode = 'push'): void {
	logger.debug(`Selecting guild: ${guildId}`);

	if (guildId === ME) {
		NavigationStore.navigateToDM(channelId, undefined, mode);
	} else if (guildId === FAVORITES_GUILD_ID || guildId === '@favorites') {
		NavigationStore.navigateToFavorites(channelId, undefined, mode);
	} else {
		NavigationStore.navigateToGuild(guildId, channelId, undefined, mode);
	}
}

export function deselectGuild(): void {
	logger.debug('Deselecting guild');
	NavigationStore.navigateToDM();
}

export function navigateToMessage(
	guildId: string | null | undefined,
	channelId: string,
	messageId: string,
	mode: NavigationMode = 'push',
): void {
	logger.debug(`Navigating to message: channel=${channelId}, message=${messageId}`);

	if (!guildId || guildId === ME) {
		NavigationStore.navigateToDM(channelId, messageId, mode);
	} else if (guildId === FAVORITES_GUILD_ID || guildId === '@favorites') {
		NavigationStore.navigateToFavorites(channelId, messageId, mode);
	} else {
		NavigationStore.navigateToGuild(guildId, channelId, messageId, mode);
	}
}

export function clearMessageIdForChannel(channelId: string, mode: NavigationMode = 'replace'): void {
	logger.debug(`Clearing messageId for channel: ${channelId}`);
	NavigationStore.clearMessageIdForChannel(channelId, mode);
}
