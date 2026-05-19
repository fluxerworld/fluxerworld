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
import type {GuildEmojiWithUser, GuildStickerWithUser} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {PackDashboardResponse, PackSummaryResponse} from '@fluxer/schema/src/domains/pack/PackSchemas';

const logger = new Logger('Packs');

export async function list(): Promise<PackDashboardResponse> {
	try {
		logger.debug('Requesting pack dashboard');
		const response = await http.get<PackDashboardResponse>({url: Endpoints.PACKS});
		return response.body;
	} catch (error) {
		logger.error('Failed to fetch pack dashboard:', error);
		throw error;
	}
}

export async function create(
	type: 'emoji' | 'sticker',
	name: string,
	description?: string | null,
): Promise<PackSummaryResponse> {
	try {
		logger.debug(`Creating ${type} pack ${name}`);
		const response = await http.post<PackSummaryResponse>({
			url: Endpoints.PACK_CREATE(type),
			body: {name, description: description ?? null},
		});
		return response.body;
	} catch (error) {
		logger.error(`Failed to create ${type} pack:`, error);
		throw error;
	}
}

export async function update(
	packId: string,
	data: {name?: string; description?: string | null},
): Promise<PackSummaryResponse> {
	try {
		logger.debug(`Updating pack ${packId}`);
		const response = await http.patch<PackSummaryResponse>({url: Endpoints.PACK(packId), body: data});
		return response.body;
	} catch (error) {
		logger.error(`Failed to update pack ${packId}:`, error);
		throw error;
	}
}

export async function remove(packId: string): Promise<void> {
	try {
		logger.debug(`Deleting pack ${packId}`);
		await http.delete({url: Endpoints.PACK(packId)});
	} catch (error) {
		logger.error(`Failed to delete pack ${packId}:`, error);
		throw error;
	}
}

export async function install(packId: string): Promise<void> {
	try {
		logger.debug(`Installing pack ${packId}`);
		await http.post({url: Endpoints.PACK_INSTALL(packId)});
	} catch (error) {
		logger.error(`Failed to install pack ${packId}:`, error);
		throw error;
	}
}

export async function uninstall(packId: string): Promise<void> {
	try {
		logger.debug(`Uninstalling pack ${packId}`);
		await http.delete({url: Endpoints.PACK_INSTALL(packId)});
	} catch (error) {
		logger.error(`Failed to uninstall pack ${packId}:`, error);
		throw error;
	}
}

// ── Pack emojis ────────────────────────────────────────────────────────────

export async function listEmojis(packId: string): Promise<ReadonlyArray<GuildEmojiWithUser>> {
	try {
		const response = await http.get<ReadonlyArray<GuildEmojiWithUser>>({url: Endpoints.PACK_EMOJIS(packId)});
		return response.body;
	} catch (error) {
		logger.error(`Failed to list emojis for pack ${packId}:`, error);
		throw error;
	}
}

export async function bulkUploadEmojis(
	packId: string,
	emojis: Array<{name: string; image: string}>,
	signal?: AbortSignal,
): Promise<{success: Array<GuildEmojiWithUser>; failed: Array<{name: string; error: string}>}> {
	try {
		const response = await http.post<{
			success: Array<GuildEmojiWithUser>;
			failed: Array<{name: string; error: string}>;
		}>({
			url: Endpoints.PACK_EMOJI_BULK(packId),
			body: {emojis},
			signal,
		});
		return response.body;
	} catch (error) {
		logger.error(`Failed to bulk upload emojis to pack ${packId}:`, error);
		throw error;
	}
}

export async function updateEmoji(packId: string, emojiId: string, data: {name: string}): Promise<void> {
	try {
		await http.patch({url: Endpoints.PACK_EMOJI(packId, emojiId), body: data});
	} catch (error) {
		logger.error(`Failed to update emoji ${emojiId} in pack ${packId}:`, error);
		throw error;
	}
}

export async function removeEmoji(packId: string, emojiId: string, purge = false): Promise<void> {
	try {
		await http.delete({
			url: Endpoints.PACK_EMOJI(packId, emojiId),
			query: purge ? {purge: true} : undefined,
		});
	} catch (error) {
		logger.error(`Failed to remove emoji ${emojiId} from pack ${packId}:`, error);
		throw error;
	}
}

// ── Pack stickers ──────────────────────────────────────────────────────────

export async function listStickers(packId: string): Promise<ReadonlyArray<GuildStickerWithUser>> {
	try {
		const response = await http.get<ReadonlyArray<GuildStickerWithUser>>({url: Endpoints.PACK_STICKERS(packId)});
		return response.body;
	} catch (error) {
		logger.error(`Failed to list stickers for pack ${packId}:`, error);
		throw error;
	}
}

export async function bulkUploadStickers(
	packId: string,
	stickers: Array<{name: string; description?: string | null; tags?: string; image: string}>,
	signal?: AbortSignal,
): Promise<{success: Array<GuildStickerWithUser>; failed: Array<{name: string; error: string}>}> {
	try {
		const response = await http.post<{
			success: Array<GuildStickerWithUser>;
			failed: Array<{name: string; error: string}>;
		}>({
			url: Endpoints.PACK_STICKERS_BULK(packId),
			body: {stickers},
			signal,
		});
		return response.body;
	} catch (error) {
		logger.error(`Failed to bulk upload stickers to pack ${packId}:`, error);
		throw error;
	}
}

export async function updateSticker(
	packId: string,
	stickerId: string,
	data: {name?: string; description?: string | null; tags?: string},
): Promise<void> {
	try {
		await http.patch({url: Endpoints.PACK_STICKER(packId, stickerId), body: data});
	} catch (error) {
		logger.error(`Failed to update sticker ${stickerId} in pack ${packId}:`, error);
		throw error;
	}
}

export async function removeSticker(packId: string, stickerId: string, purge = false): Promise<void> {
	try {
		await http.delete({
			url: Endpoints.PACK_STICKER(packId, stickerId),
			query: purge ? {purge: true} : undefined,
		});
	} catch (error) {
		logger.error(`Failed to remove sticker ${stickerId} from pack ${packId}:`, error);
		throw error;
	}
}
