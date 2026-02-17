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
import type {Router} from '@app/lib/router/RouterTypes';
import {Routes} from '@app/Routes';
import * as RouterUtils from '@app/utils/RouterUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {action, makeAutoObservable} from 'mobx';

type NavigationMode = 'push' | 'replace';

const logger = new Logger('NavigationStore');

class NavigationStore {
	guildId: string | null = null;
	channelId: string | null = null;
	messageId: string | null = null;
	private router: Router | null = null;
	private unsubscribe: (() => void) | null = null;
	currentLocation: URL | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	@action
	initialize(router: Router): void {
		this.router = router;
		this.updateFromRouter();

		this.unsubscribe = this.router.subscribe(() => {
			this.updateFromRouter();
		});
	}

	@action
	private updateFromRouter(): void {
		if (!this.router) return;

		const state = this.router.getState();
		this.currentLocation = state.location;
		const match = state.matches[state.matches.length - 1];

		if (!match) {
			this.guildId = null;
			this.channelId = null;
			this.messageId = null;
			return;
		}

		const params = match.params;
		this.guildId = (params.guildId as string) ?? null;
		this.channelId = (params.channelId as string) ?? null;
		this.messageId = (params.messageId as string) ?? null;
	}

	get pathname(): string {
		return this.currentLocation?.pathname ?? '';
	}

	get search(): string {
		return this.currentLocation?.search ?? '';
	}

	get hash(): string {
		return this.currentLocation?.hash ?? '';
	}

	get context(): 'dm' | 'favorites' | 'guild' {
		const guildId = this.guildId;
		if (!guildId || guildId === ME) return 'dm';
		if (guildId === '@favorites') return 'favorites';
		return 'guild';
	}

	navigateToGuild(guildId: string, channelId?: string, messageId?: string, mode: NavigationMode = 'push'): void {
		const path = this.buildGuildPath(guildId, channelId, messageId);
		logger.debug(`navigateToGuild: ${path} (${mode})`);
		this.applyNavigation(path, mode);
	}

	navigateToDM(channelId?: string, messageId?: string, mode: NavigationMode = 'push'): void {
		const path = this.buildDMPath(channelId, messageId);
		logger.debug(`navigateToDM: ${path} (${mode})`);
		this.applyNavigation(path, mode);
	}

	navigateToFavorites(channelId?: string, messageId?: string, mode: NavigationMode = 'push'): void {
		const path = this.buildFavoritesPath(channelId, messageId);
		logger.debug(`navigateToFavorites: ${path} (${mode})`);
		this.applyNavigation(path, mode);
	}

	clearMessageIdForChannel(channelId: string, mode: NavigationMode = 'replace'): void {
		if (this.channelId !== channelId || !this.messageId) return;

		const ctx = this.context;
		let path: string;
		if (ctx === 'dm') {
			path = Routes.dmChannel(channelId);
		} else if (ctx === 'favorites') {
			path = Routes.favoritesChannel(channelId);
		} else {
			const guildId = this.guildId;
			if (!guildId) return;
			path = Routes.guildChannel(guildId, channelId);
		}

		logger.debug(`clearMessageIdForChannel: ${path} (${mode})`);
		this.applyNavigation(path, mode);
	}

	buildChannelPath(guildId: string | null | undefined, channelId: string): string {
		if (!guildId || guildId === ME) {
			return Routes.dmChannel(channelId);
		}
		if (guildId === '@favorites') {
			return Routes.favoritesChannel(channelId);
		}
		return Routes.guildChannel(guildId, channelId);
	}

	buildMessagePath(guildId: string | null | undefined, channelId: string, messageId: string): string {
		if (!guildId || guildId === ME) {
			return Routes.dmChannelMessage(channelId, messageId);
		}
		if (guildId === '@favorites') {
			return Routes.favoritesChannelMessage(channelId, messageId);
		}
		return Routes.channelMessage(guildId, channelId, messageId);
	}

	private buildGuildPath(guildId: string, channelId?: string, messageId?: string): string {
		if (messageId && channelId) {
			return Routes.channelMessage(guildId, channelId, messageId);
		}
		return Routes.guildChannel(guildId, channelId);
	}

	private buildDMPath(channelId?: string, messageId?: string): string {
		if (messageId && channelId) {
			return Routes.dmChannelMessage(channelId, messageId);
		}
		if (channelId) {
			return Routes.dmChannel(channelId);
		}
		return Routes.ME;
	}

	private buildFavoritesPath(channelId?: string, messageId?: string): string {
		if (messageId && channelId) {
			return Routes.favoritesChannelMessage(channelId, messageId);
		}
		if (channelId) {
			return Routes.favoritesChannel(channelId);
		}
		return Routes.FAVORITES;
	}

	private applyNavigation(path: string, mode: NavigationMode): void {
		if (mode === 'replace') {
			RouterUtils.replaceWith(path);
		} else {
			RouterUtils.transitionTo(path);
		}
	}

	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
		this.router = null;
	}
}

export default new NavigationStore();
