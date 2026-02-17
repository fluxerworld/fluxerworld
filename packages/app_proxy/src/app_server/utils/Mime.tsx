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

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.htm': 'text/html; charset=utf-8',

	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',

	'.css': 'text/css; charset=utf-8',

	'.json': 'application/json; charset=utf-8',

	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',

	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.eot': 'application/vnd.ms-fontobject',

	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',

	'.pdf': 'application/pdf',
	'.txt': 'text/plain; charset=utf-8',
	'.xml': 'application/xml; charset=utf-8',

	'.webmanifest': 'application/manifest+json',

	'.map': 'application/json',

	'.wasm': 'application/wasm',
};

export function getMimeType(path: string): string {
	const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
	return MIME_TYPES[ext] ?? 'application/octet-stream';
}

export function isStaticAsset(path: string): boolean {
	const lastSlashIndex = path.lastIndexOf('/');
	const filename = lastSlashIndex >= 0 ? path.slice(lastSlashIndex + 1) : path;
	return filename.includes('.');
}

export function isHashedAsset(path: string): boolean {
	const hashPattern = /\.[a-f0-9]{8,}\.(?:js|css|mjs|woff2?|ttf|eot|otf|png|jpg|jpeg|gif|webp|avif|svg)$/i;
	const hashPattern2 = /-[a-f0-9]{8,}\.(?:js|css|mjs|woff2?|ttf|eot|otf|png|jpg|jpeg|gif|webp|avif|svg)$/i;
	return hashPattern.test(path) || hashPattern2.test(path);
}
