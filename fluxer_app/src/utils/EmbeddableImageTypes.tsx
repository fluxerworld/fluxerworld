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

const PROXY_EMBEDDABLE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']);
const PROXY_EMBEDDABLE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

const SVG_MIME_TYPES = new Set(['image/svg+xml', 'image/svg']);

function normaliseMimeType(mimeType: string): string {
	return mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
}

export function isEmbeddableImageFile(file: Pick<File, 'type' | 'name'>): boolean {
	const mimeType = normaliseMimeType(file.type);
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

	if (SVG_MIME_TYPES.has(mimeType) || extension === 'svg') {
		return false;
	}

	return (
		(mimeType.length > 0 && PROXY_EMBEDDABLE_IMAGE_MIME_TYPES.has(mimeType)) ||
		PROXY_EMBEDDABLE_IMAGE_EXTENSIONS.has(extension)
	);
}
