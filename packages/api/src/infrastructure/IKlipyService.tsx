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

import type {KlipyCategoryTagResponse, KlipyGifResponse} from '@fluxer/schema/src/domains/klipy/KlipySchemas';

export interface IKlipyService {
	search(params: {q: string; locale: string; country: string}): Promise<Array<KlipyGifResponse>>;

	registerShare(params: {id: string; q: string; locale: string; country: string}): Promise<void>;

	getFeatured(params: {locale: string; country: string}): Promise<{
		gifs: Array<KlipyGifResponse>;
		categories: Array<KlipyCategoryTagResponse>;
	}>;

	getTrendingGifs(params: {locale: string; country: string}): Promise<Array<KlipyGifResponse>>;

	suggest(params: {q: string; locale: string}): Promise<Array<string>>;
}
