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

import type {ChannelID, MemeID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {mapFavoriteMemeToResponse} from '@fluxer/api/src/favorite_meme/FavoriteMemeModel';
import type {FavoriteMemeService} from '@fluxer/api/src/favorite_meme/FavoriteMemeService';
import type {User} from '@fluxer/api/src/models/User';
import {UnknownFavoriteMemeError} from '@fluxer/errors/src/domains/core/UnknownFavoriteMemeError';
import type {
	CreateFavoriteMemeBodySchema,
	CreateFavoriteMemeFromUrlBodySchema,
	FavoriteMemeListResponse,
	FavoriteMemeResponse,
	UpdateFavoriteMemeBodySchema,
} from '@fluxer/schema/src/domains/meme/MemeSchemas';

interface FavoriteMemeListParams {
	userId: UserID;
}

interface FavoriteMemeCreateFromUrlParams {
	user: User;
	data: CreateFavoriteMemeFromUrlBodySchema;
}

interface FavoriteMemeCreateFromMessageParams {
	user: User;
	channelId: ChannelID;
	messageId: MessageID;
	data: CreateFavoriteMemeBodySchema;
}

interface FavoriteMemeGetParams {
	userId: UserID;
	memeId: MemeID;
}

interface FavoriteMemeUpdateParams {
	user: User;
	memeId: MemeID;
	data: UpdateFavoriteMemeBodySchema;
}

interface FavoriteMemeDeleteParams {
	userId: UserID;
	memeId: MemeID;
}

export class FavoriteMemeRequestService {
	constructor(private readonly favoriteMemeService: FavoriteMemeService) {}

	async listFavoriteMemes(params: FavoriteMemeListParams): Promise<FavoriteMemeListResponse> {
		const memes = await this.favoriteMemeService.listFavoriteMemes(params.userId);
		return memes.map((meme) => mapFavoriteMemeToResponse(meme));
	}

	async createFromUrl(params: FavoriteMemeCreateFromUrlParams): Promise<FavoriteMemeResponse> {
		const {user, data} = params;
		const meme = await this.favoriteMemeService.createFromUrl({
			user,
			url: data.url,
			name: data.name,
			altText: data.alt_text ?? undefined,
			tags: data.tags ?? undefined,
			klipySlug: data.klipy_slug ?? undefined,
			tenorSlugId: data.tenor_slug_id ?? undefined,
		});
		return mapFavoriteMemeToResponse(meme);
	}

	async createFromMessage(params: FavoriteMemeCreateFromMessageParams): Promise<FavoriteMemeResponse> {
		const {user, channelId, messageId, data} = params;
		const meme = await this.favoriteMemeService.createFromMessage({
			user,
			channelId,
			messageId,
			attachmentId: data.attachment_id?.toString(),
			embedIndex: data.embed_index ?? undefined,
			name: data.name,
			altText: data.alt_text ?? undefined,
			tags: data.tags ?? undefined,
		});
		return mapFavoriteMemeToResponse(meme);
	}

	async getFavoriteMeme(params: FavoriteMemeGetParams): Promise<FavoriteMemeResponse> {
		const meme = await this.favoriteMemeService.getFavoriteMeme(params.userId, params.memeId);
		if (!meme) {
			throw new UnknownFavoriteMemeError();
		}
		return mapFavoriteMemeToResponse(meme);
	}

	async updateFavoriteMeme(params: FavoriteMemeUpdateParams): Promise<FavoriteMemeResponse> {
		const {user, memeId, data} = params;
		const meme = await this.favoriteMemeService.update({
			user,
			memeId,
			name: data.name ?? undefined,
			altText: data.alt_text === undefined ? undefined : data.alt_text,
			tags: data.tags ?? undefined,
		});
		return mapFavoriteMemeToResponse(meme);
	}

	async deleteFavoriteMeme(params: FavoriteMemeDeleteParams): Promise<void> {
		await this.favoriteMemeService.delete(params.userId, params.memeId);
	}
}
