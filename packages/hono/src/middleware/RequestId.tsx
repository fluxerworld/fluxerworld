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

import {randomUUID} from 'node:crypto';
import {Headers} from '@fluxer/constants/src/Headers';
import type {MiddlewareHandler} from 'hono';

export type RequestIdGenerator = () => string;
export interface RequestIdOptions {
	headerName?: string;
	generator?: RequestIdGenerator;
	setResponseHeader?: boolean;
}

export const REQUEST_ID_KEY = 'requestId';

export function requestId(options: RequestIdOptions = {}): MiddlewareHandler {
	const {headerName = Headers.X_REQUEST_ID, generator = randomUUID, setResponseHeader = true} = options;

	return async (c, next) => {
		const existingId = c.req.header(headerName);
		const id = existingId || generator();

		c.set(REQUEST_ID_KEY, id);

		await next();

		if (setResponseHeader) {
			c.res.headers.set(headerName, id);
		}
	};
}
