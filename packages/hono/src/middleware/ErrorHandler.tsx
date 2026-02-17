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

import {createErrorHandler as createFluxerErrorHandler} from '@fluxer/errors/src/ErrorHandler';
import type {Context, ErrorHandler} from 'hono';

export interface ErrorHandlerOptions {
	includeStack?: boolean;
	logger?: (error: Error, context: Context) => void;
	captureException?: (error: Error, context?: Record<string, unknown>) => void;
}

export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
	const {includeStack = false, logger, captureException} = options;

	const logError =
		logger || captureException
			? (error: Error, context: Context) => {
					if (logger) {
						logger(error, context);
					}
					if (captureException) {
						captureException(error, {
							path: context.req.path,
							method: context.req.method,
							status: context.res?.status,
						});
					}
				}
			: undefined;

	return createFluxerErrorHandler({
		includeStack,
		logError,
	});
}
