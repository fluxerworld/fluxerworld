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

import {userIdToChannelId} from '@fluxer/api/src/BrandedTypes';
import {makeAttachmentCdnUrl} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {FavoriteMeme} from '@fluxer/api/src/models/FavoriteMeme';
import type {FavoriteMemeResponse} from '@fluxer/schema/src/domains/meme/MemeSchemas';

export function mapFavoriteMemeToResponse(meme: FavoriteMeme): FavoriteMemeResponse {
	const url = makeAttachmentCdnUrl(userIdToChannelId(meme.userId), meme.attachmentId, meme.filename);
	return {
		id: meme.id.toString(),
		user_id: meme.userId.toString(),
		name: meme.name,
		alt_text: meme.altText ?? null,
		tags: meme.tags || [],
		attachment_id: meme.attachmentId.toString(),
		filename: meme.filename,
		content_type: meme.contentType,
		content_hash: meme.contentHash ?? null,
		size: Number(meme.size),
		width: meme.width ?? null,
		height: meme.height ?? null,
		duration: meme.duration ?? null,
		url,
		is_gifv: meme.isGifv ?? false,
		klipy_slug: meme.klipySlug ?? null,
		tenor_slug_id: meme.tenorSlugId ?? null,
	};
}
