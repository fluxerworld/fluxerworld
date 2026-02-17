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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const CommonErrorCode = {
	INTERNAL_ERROR: 'InternalError',
	INVALID_ARGUMENT: 'InvalidArgument',
	INVALID_REQUEST: 'InvalidRequest',
	INVALID_OPERATION: 'InvalidOperation',

	ACCESS_DENIED: 'AccessDenied',
	UNAUTHORIZED: 'Unauthorized',
	FORBIDDEN: 'Forbidden',
	INVALID_TOKEN: 'InvalidToken',

	NOT_FOUND: 'NotFound',
	KEY_NOT_FOUND: 'KeyNotFound',
	RESOURCE_NOT_FOUND: 'ResourceNotFound',
	ALREADY_EXISTS: 'AlreadyExists',
	CONFLICT: 'Conflict',

	TYPE_MISMATCH: 'TypeMismatch',
	VALIDATION_ERROR: 'ValidationError',

	RATE_LIMITED: 'RateLimited',
	TOO_MANY_REQUESTS: 'TooManyRequests',

	SERVICE_UNAVAILABLE: 'ServiceUnavailable',
	NOT_IMPLEMENTED: 'NotImplemented',
	TIMEOUT: 'Timeout',
} as const;

export type CommonErrorCodeValue = ValueOf<typeof CommonErrorCode>;

export const ErrorCodeToStatus: Record<CommonErrorCodeValue, number> = {
	[CommonErrorCode.INTERNAL_ERROR]: 500,
	[CommonErrorCode.INVALID_ARGUMENT]: 400,
	[CommonErrorCode.INVALID_REQUEST]: 400,
	[CommonErrorCode.INVALID_OPERATION]: 400,
	[CommonErrorCode.ACCESS_DENIED]: 403,
	[CommonErrorCode.UNAUTHORIZED]: 401,
	[CommonErrorCode.FORBIDDEN]: 403,
	[CommonErrorCode.INVALID_TOKEN]: 401,
	[CommonErrorCode.NOT_FOUND]: 404,
	[CommonErrorCode.KEY_NOT_FOUND]: 404,
	[CommonErrorCode.RESOURCE_NOT_FOUND]: 404,
	[CommonErrorCode.ALREADY_EXISTS]: 409,
	[CommonErrorCode.CONFLICT]: 409,
	[CommonErrorCode.TYPE_MISMATCH]: 400,
	[CommonErrorCode.VALIDATION_ERROR]: 400,
	[CommonErrorCode.RATE_LIMITED]: 429,
	[CommonErrorCode.TOO_MANY_REQUESTS]: 429,
	[CommonErrorCode.SERVICE_UNAVAILABLE]: 503,
	[CommonErrorCode.NOT_IMPLEMENTED]: 501,
	[CommonErrorCode.TIMEOUT]: 408,
};
