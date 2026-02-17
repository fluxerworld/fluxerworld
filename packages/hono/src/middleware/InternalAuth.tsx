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

import {timingSafeEqual} from 'node:crypto';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {matchesAnyExactOrNestedPath} from '@fluxer/hono/src/middleware/utils/PathMatchers';
import type {MiddlewareHandler} from 'hono';

export interface InternalAuthOptions {
	secret: string;
	skipPaths?: Array<string>;
}

function timingSafeCompare(a: string, b: string): boolean {
	const bufferA = Buffer.from(a);
	const bufferB = Buffer.from(b);

	if (bufferA.length !== bufferB.length) {
		return false;
	}

	return timingSafeEqual(bufferA, bufferB);
}

export function createInternalAuth(options: InternalAuthOptions): MiddlewareHandler {
	const {secret, skipPaths = ['/_health']} = options;

	return async (c, next) => {
		const path = c.req.path;

		if (matchesAnyExactOrNestedPath(path, skipPaths)) {
			await next();
			return;
		}

		const authHeader = c.req.header('Authorization');

		if (!authHeader) {
			throw new UnauthorizedError({message: 'Missing Authorization header'});
		}

		if (!authHeader.startsWith('Bearer ')) {
			throw new UnauthorizedError({message: 'Invalid Authorization header format'});
		}

		const token = authHeader.slice(7);

		if (!timingSafeCompare(token, secret)) {
			throw new UnauthorizedError({message: 'Invalid token'});
		}

		await next();
	};
}
