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

export interface PaginationUrlParams {
	q?: string;
	status?: number | string;
	type?: number | string;
	category?: string;
	target_type?: string;
	target_id?: string;
	admin_user_id?: string;
	action?: string;
	sort?: string;
	limit?: number;
	tab?: string;
}

export function buildPaginationUrl(page: number, params: PaginationUrlParams = {}): string {
	const urlParams = new URLSearchParams();
	urlParams.set('page', String(page));

	Object.entries(params).forEach(([key, value]) => {
		if (value === undefined || value === null || String(value).trim() === '') {
			return;
		}
		urlParams.set(key, String(value));
	});

	const queryString = urlParams.toString();
	return queryString ? `?${queryString}` : '';
}
