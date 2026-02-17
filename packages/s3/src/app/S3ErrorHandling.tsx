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

import {createErrorHandler} from '@fluxer/errors/src/ErrorHandler';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {S3Error} from '@fluxer/s3/src/errors/S3Error';
import {captureException} from '@fluxer/sentry/src/Sentry';
import type {Hono} from 'hono';
import type {HonoEnv} from '../types/HonoEnv';

interface SetupS3ErrorHandlingOptions {
	app: Hono<HonoEnv>;
	logger: LoggerInterface;
}

export function setupS3ErrorHandling(options: SetupS3ErrorHandlingOptions): void {
	const {app, logger} = options;

	const errorHandler = createErrorHandler({
		includeStack: false,
		responseFormat: 'xml',
		logError: (err, ctx) => {
			const isExpectedError = err instanceof Error && 'isExpected' in err && err.isExpected;

			if (!(err instanceof S3Error || isExpectedError)) {
				captureException(err);
			}

			logger.error(
				{
					error: err.message,
					stack: err.stack,
					requestId: ctx.get('requestId'),
				},
				'Request error',
			);
		},
		customHandler: (err, ctx) => {
			if (err instanceof S3Error) {
				err.requestId = ctx.get('requestId');
				return err.getResponse();
			}
			return undefined;
		},
	});

	app.onError(errorHandler);

	app.notFound((ctx) => {
		const s3Error = new S3Error('NoSuchKey', 'The specified resource was not found.', {
			requestId: ctx.get('requestId'),
		});
		return s3Error.getResponse();
	});
}
