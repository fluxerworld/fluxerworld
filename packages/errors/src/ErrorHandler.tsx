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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {createJsonErrorResponse, createXmlErrorResponse} from '@fluxer/errors/src/error_handling/ErrorResponse';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import type {Context, ErrorHandler} from 'hono';
import {HTTPException} from 'hono/http-exception';

const HTTP_STATUS_TO_ERROR_CODE: Record<number, string> = {
	400: 'BAD_REQUEST',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	405: 'METHOD_NOT_ALLOWED',
	409: 'CONFLICT',
	410: 'GONE',
	500: 'INTERNAL_SERVER_ERROR',
	501: 'NOT_IMPLEMENTED',
	502: 'BAD_GATEWAY',
	503: 'SERVICE_UNAVAILABLE',
	504: 'GATEWAY_TIMEOUT',
};

export type ResponseFormat = 'json' | 'xml';
export interface ErrorHandlerOptions {
	logError?: (error: Error, context: Context) => void;
	includeStack?: boolean;
	responseFormat?: ResponseFormat;
	customHandler?: (error: Error, context: Context) => Response | Promise<Response> | undefined;
}

export function createErrorHandler(options: ErrorHandlerOptions = {}): ErrorHandler {
	const {logError, includeStack = false, responseFormat = 'json', customHandler} = options;

	return async (error: Error, c: Context): Promise<Response> => {
		if (logError) {
			logError(error, c);
		}

		if (customHandler) {
			const customResponse = await customHandler(error, c);
			if (customResponse) {
				return customResponse;
			}
		}

		if (error instanceof FluxerError) {
			return error.getResponse();
		}

		if (error instanceof HTTPException) {
			const status = error.status;
			const code = HTTP_STATUS_TO_ERROR_CODE[status] ?? 'GENERAL_ERROR';
			const message = error.message || 'An error occurred';

			if (responseFormat === 'xml') {
				return createXmlErrorResponse(status, code, message);
			}

			return createJsonErrorResponse({
				status,
				code,
				message,
				data: includeStack ? {stack: error.stack} : undefined,
			});
		}

		const status = HttpStatus.INTERNAL_SERVER_ERROR;
		const message = includeStack ? error.message : 'Something went wrong. Please try again later.';

		if (responseFormat === 'xml') {
			return createXmlErrorResponse(status, 'INTERNAL_SERVER_ERROR', message);
		}

		return createJsonErrorResponse({
			status,
			code: 'INTERNAL_SERVER_ERROR',
			message,
			data: includeStack ? {stack: error.stack} : undefined,
		});
	};
}
