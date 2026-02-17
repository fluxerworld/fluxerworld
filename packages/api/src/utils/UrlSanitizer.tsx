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

export function sanitizeOptionalAbsoluteUrl(url: string | null | undefined): string | undefined {
	if (typeof url !== 'string') {
		return;
	}

	const trimmedUrl = url.trim();
	if (!trimmedUrl) {
		return;
	}

	try {
		return new URL(trimmedUrl).toString();
	} catch {
		return;
	}
}

export function sanitizeOptionalAbsoluteUrlOrNull(url: string | null | undefined): string | null {
	return sanitizeOptionalAbsoluteUrl(url) ?? null;
}
