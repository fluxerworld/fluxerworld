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

import type {MessageEmbedAuthor} from '@fluxer/api/src/database/types/MessageTypes';
import {sanitizeOptionalAbsoluteUrlOrNull} from '@fluxer/api/src/utils/UrlSanitizer';

export class EmbedAuthor {
	readonly name: string | null;
	readonly url: string | null;
	readonly iconUrl: string | null;

	constructor(author: MessageEmbedAuthor) {
		this.name = author.name ?? null;
		this.url = sanitizeOptionalAbsoluteUrlOrNull(author.url);
		this.iconUrl = sanitizeOptionalAbsoluteUrlOrNull(author.icon_url);
	}

	toMessageEmbedAuthor(): MessageEmbedAuthor {
		return {
			name: this.name,
			url: this.url,
			icon_url: this.iconUrl,
		};
	}
}
