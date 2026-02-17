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

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {S3Errors} from '@fluxer/s3/src/errors/S3Error';
import {authenticateS3Request} from '@fluxer/s3/src/middleware/S3RequestAuthenticator';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import type {MiddlewareHandler} from 'hono';

export interface S3AuthConfig {
	accessKey?: string;
	secretKey?: string;
}

export function createS3AuthMiddleware(config: S3AuthConfig, logger: LoggerInterface): MiddlewareHandler<HonoEnv> {
	return async (ctx, next) => {
		if (ctx.req.path === '/_health') {
			await next();
			return;
		}

		const accessKey = config.accessKey;
		const secretKey = config.secretKey;

		if (!accessKey || !secretKey) {
			logger.error('S3 credentials not configured');
			throw S3Errors.accessDenied('Service not configured');
		}

		const principal = await authenticateS3Request(ctx, {accessKey, secretKey});
		ctx.set('accessKeyId', principal.accessKeyId);
		ctx.set('authenticated', true);

		await next();
	};
}
