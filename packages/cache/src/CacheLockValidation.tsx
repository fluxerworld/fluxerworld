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

import {randomBytes} from 'node:crypto';

const LOCK_KEY_PATTERN = /^[a-zA-Z0-9:_-]+$/;
const LOCK_TOKEN_PATTERN = /^[a-z0-9]+$/;

export function validateLockKey(key: string): void {
	if (!LOCK_KEY_PATTERN.test(key)) {
		throw new Error('Invalid lock key format');
	}
}

export function validateLockToken(token: string): void {
	if (!LOCK_TOKEN_PATTERN.test(token)) {
		throw new Error('Invalid lock token format');
	}
}

export function generateLockToken(): string {
	return randomBytes(16).toString('hex');
}

export function formatLockKey(key: string): string {
	return `lock:${key}`;
}
