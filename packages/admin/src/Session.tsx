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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {Session} from '@fluxer/admin/src/types/App';
import {createSession as createSessionCore, parseSession as parseSessionCore} from '@fluxer/hono/src/Session';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionData {
	userId: string;
	accessToken: string;
}

export function createSession(userId: string, accessToken: string, secretKey: string): string {
	return createSessionCore<SessionData>({userId, accessToken}, secretKey);
}

export function parseSession(cookieValue: string, secretKey: string): Session | null {
	const session = parseSessionCore<SessionData>(cookieValue, secretKey, MAX_AGE_SECONDS);
	if (!session) {
		return null;
	}

	return {
		userId: session.userId,
		accessToken: session.accessToken,
		createdAt: session.createdAt,
	};
}
