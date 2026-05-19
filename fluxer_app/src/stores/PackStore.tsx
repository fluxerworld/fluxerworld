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

import * as PackActionCreators from '@app/actions/PackActionCreators';
import EmojiStore from '@app/stores/EmojiStore';
import type {GuildEmojiWithUser, GuildStickerWithUser} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {PackDashboardResponse, PackSummaryResponse} from '@fluxer/schema/src/domains/pack/PackSchemas';
import {makeAutoObservable, runInAction} from 'mobx';

type FetchStatus = 'idle' | 'pending' | 'success' | 'error';

class PackStore {
	dashboard: PackDashboardResponse | null = null;
	fetchStatus: FetchStatus = 'idle';
	error: Error | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	async fetch(): Promise<PackDashboardResponse> {
		if (this.fetchStatus === 'pending') {
			throw new Error('Pack fetch already in progress');
		}
		this.fetchStatus = 'pending';
		this.error = null;

		try {
			const dashboard = await PackActionCreators.list();
			runInAction(() => {
				this.dashboard = dashboard;
				this.fetchStatus = 'success';
			});
			// Best-effort hydrate the emoji picker with this user's accessible
			// pack emojis so they appear alongside guild emojis. Only the emoji
			// section is registered — stickers have their own picker pipeline.
			void this.hydratePackEmojis(dashboard);
			return dashboard;
		} catch (err) {
			runInAction(() => {
				this.fetchStatus = 'error';
				this.error = err instanceof Error ? err : new Error('Failed to load packs');
			});
			throw err;
		}
	}

	private async hydratePackEmojis(dashboard: PackDashboardResponse): Promise<void> {
		const accessiblePacks: Array<PackSummaryResponse> = [
			...dashboard.emoji.created,
			...dashboard.emoji.installed,
		];
		// Dedupe — a user could in theory have both created and installed the
		// same pack (rare, but cheap to guard against).
		const seen = new Set<string>();
		const packs = accessiblePacks.filter((pack) => {
			if (seen.has(pack.id)) return false;
			seen.add(pack.id);
			return true;
		});

		// Reset packs in registry — we want this fetch to be authoritative so
		// that uninstalls / deletions actually remove emojis from the picker.
		EmojiStore.clearPacks();

		await Promise.allSettled(
			packs.map(async (pack) => {
				try {
					const emojis = await PackActionCreators.listEmojis(pack.id);
					EmojiStore.updatePack(pack.id, pack.name, emojis);
				} catch {
					// Swallow — one bad pack shouldn't kill the rest.
				}
			}),
		);
	}

	async refresh(): Promise<void> {
		await this.fetch();
	}

	async createPack(type: 'emoji' | 'sticker', name: string, description?: string | null): Promise<void> {
		await PackActionCreators.create(type, name, description);
		await this.refresh();
	}

	async updatePack(packId: string, data: {name?: string; description?: string | null}): Promise<void> {
		await PackActionCreators.update(packId, data);
		await this.refresh();
	}

	async deletePack(packId: string): Promise<void> {
		await PackActionCreators.remove(packId);
		EmojiStore.deletePack(packId);
		await this.refresh();
	}

	async installPack(packId: string): Promise<void> {
		await PackActionCreators.install(packId);
		await this.refresh();
	}

	async uninstallPack(packId: string): Promise<void> {
		await PackActionCreators.uninstall(packId);
		EmojiStore.deletePack(packId);
		await this.refresh();
	}

	async listPackEmojis(packId: string): Promise<ReadonlyArray<GuildEmojiWithUser>> {
		return PackActionCreators.listEmojis(packId);
	}

	async bulkUploadPackEmojis(
		packId: string,
		emojis: Array<{name: string; image: string}>,
	): Promise<{success: Array<GuildEmojiWithUser>; failed: Array<{name: string; error: string}>}> {
		const result = await PackActionCreators.bulkUploadEmojis(packId, emojis);
		await this.refreshPackEmojiRegistration(packId);
		return result;
	}

	async updatePackEmoji(packId: string, emojiId: string, name: string): Promise<void> {
		await PackActionCreators.updateEmoji(packId, emojiId, {name});
		await this.refreshPackEmojiRegistration(packId);
	}

	async removePackEmoji(packId: string, emojiId: string): Promise<void> {
		await PackActionCreators.removeEmoji(packId, emojiId);
		await this.refreshPackEmojiRegistration(packId);
	}

	private async refreshPackEmojiRegistration(packId: string): Promise<void> {
		const pack = this.findPack(packId);
		if (!pack) return;
		try {
			const emojis = await PackActionCreators.listEmojis(packId);
			EmojiStore.updatePack(pack.id, pack.name, emojis);
		} catch {
			// Best effort — picker just won't update for this mutation.
		}
	}

	private findPack(packId: string): PackSummaryResponse | null {
		const dash = this.dashboard;
		if (!dash) return null;
		return (
			dash.emoji.created.find((p) => p.id === packId) ??
			dash.emoji.installed.find((p) => p.id === packId) ??
			null
		);
	}

	async listPackStickers(packId: string): Promise<ReadonlyArray<GuildStickerWithUser>> {
		return PackActionCreators.listStickers(packId);
	}

	async bulkUploadPackStickers(
		packId: string,
		stickers: Array<{name: string; description?: string | null; tags?: string; image: string}>,
	): Promise<{success: Array<GuildStickerWithUser>; failed: Array<{name: string; error: string}>}> {
		return PackActionCreators.bulkUploadStickers(packId, stickers);
	}

	async removePackSticker(packId: string, stickerId: string): Promise<void> {
		await PackActionCreators.removeSticker(packId, stickerId);
	}
}

export default new PackStore();
