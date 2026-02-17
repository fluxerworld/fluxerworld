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

import {createHash, createHmac} from 'node:crypto';

export function hmacSha256(key: string | Buffer, data: string): Buffer {
	return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function sha256(data: string | Buffer): string {
	return createHash('sha256').update(data).digest('hex');
}

export function md5(data: string | Buffer): string {
	return createHash('md5').update(data).digest('hex');
}

export function md5Base64(data: string | Buffer): string {
	return createHash('md5').update(data).digest('base64');
}

export function randomHex(bytes: number): string {
	const array = new Uint8Array(bytes);
	crypto.getRandomValues(array);
	return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomUUID(): string {
	return crypto.randomUUID();
}
