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

import {createHmac, timingSafeEqual} from 'node:crypto';

export interface SessionConfig {
	secretKey: string;
	maxAgeSeconds?: number;
}

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function signData(data: string, secretKey: string): string {
	const signature = createHmac('sha256', secretKey).update(data).digest('base64url');
	return `${data}.${signature}`;
}

function verifySignature(signedData: string, secretKey: string): string | null {
	const dotIndex = signedData.lastIndexOf('.');
	if (dotIndex === -1) {
		return null;
	}

	const data = signedData.slice(0, dotIndex);
	const providedSignature = signedData.slice(dotIndex + 1);
	const expectedSignature = createHmac('sha256', secretKey).update(data).digest('base64url');

	try {
		const providedBuffer = Buffer.from(providedSignature, 'base64url');
		const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

		if (providedBuffer.length !== expectedBuffer.length) {
			return null;
		}

		if (timingSafeEqual(providedBuffer, expectedBuffer)) {
			return data;
		}
	} catch {
		return null;
	}

	return null;
}

export function createSession<T extends object>(data: T, secretKey: string): string {
	const sessionWithTimestamp = {
		...data,
		createdAt: Math.floor(Date.now() / 1000),
	};
	const encoded = Buffer.from(JSON.stringify(sessionWithTimestamp)).toString('base64url');
	return signData(encoded, secretKey);
}

export function parseSession<T extends object>(
	cookie: string,
	secretKey: string,
	maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS,
): (T & {createdAt: number}) | null {
	const data = verifySignature(cookie, secretKey);
	if (!data) {
		return null;
	}

	try {
		const decoded = Buffer.from(data, 'base64url').toString('utf-8');
		const session = JSON.parse(decoded) as T & {createdAt: number};

		if (typeof session.createdAt !== 'number') {
			return null;
		}

		const now = Math.floor(Date.now() / 1000);
		if (now - session.createdAt > maxAgeSeconds) {
			return null;
		}

		return session;
	} catch {
		return null;
	}
}
