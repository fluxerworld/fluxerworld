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
import MessageStore from '@app/stores/MessageStore';
import NavigationStore from '@app/stores/NavigationStore';
import NotificationStore from '@app/stores/NotificationStore';
import {reaction} from 'mobx';

const logger = new Logger('NavigationSideEffects');

class NavigationSideEffectsStore {
	private lastChannelId: string | null = null;
	private lastMessageId: string | null = null;
	private disposer: (() => void) | null = null;

	initialize(): void {
		if (this.disposer) return;

		this.disposer = reaction(
			() => ({
				guildId: NavigationStore.guildId,
				channelId: NavigationStore.channelId,
				messageId: NavigationStore.messageId,
			}),
			({guildId, channelId, messageId}) => {
				this.handleRouteChange(guildId, channelId, messageId);
			},
			{fireImmediately: true},
		);
	}

	private handleRouteChange(guildId: string | null, channelId: string | null, messageId: string | null): void {
		const channelChanged = channelId !== this.lastChannelId;
		const messageChanged = messageId !== this.lastMessageId;

		if (!channelChanged && !messageChanged) return;

		this.lastChannelId = channelId;
		this.lastMessageId = messageId;

		if (!channelId) return;

		logger.debug(`Route change: guild=${guildId}, channel=${channelId}, message=${messageId}`);

		MessageStore.handleChannelSelect({guildId: guildId ?? undefined, channelId, messageId: messageId ?? undefined});
		NotificationStore.handleChannelSelect({channelId});
	}

	destroy(): void {
		this.disposer?.();
		this.disposer = null;
	}
}

export default new NavigationSideEffectsStore();
