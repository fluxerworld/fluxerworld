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

import {HttpError} from '@app/lib/HttpError';

interface ApiValidationError {
	path: string;
	message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getBody(error: unknown): Record<string, unknown> | undefined {
	if (!(error instanceof HttpError)) return undefined;
	if (!isRecord(error.body)) return undefined;
	return error.body;
}

export function getResponseCode(body: unknown): string | undefined {
	if (!isRecord(body)) return undefined;
	const code = body.code;
	return typeof code === 'string' ? code : undefined;
}

export function getResponseMessage(body: unknown): string | undefined {
	if (!isRecord(body)) return undefined;
	const message = body.message;
	return typeof message === 'string' ? message : undefined;
}

export function getResponseRetryAfter(body: unknown): number | undefined {
	if (!isRecord(body)) return undefined;
	const retryAfter = body.retry_after;
	return typeof retryAfter === 'number' ? retryAfter : undefined;
}

export function getApiErrorCode(error: unknown): string | undefined {
	return getResponseCode(getBody(error));
}

export function getApiErrorMessage(error: unknown): string | undefined {
	return getResponseMessage(getBody(error));
}

export function getApiErrorErrors(error: unknown): ReadonlyArray<ApiValidationError> | undefined {
	const body = getBody(error);
	if (!body) return undefined;
	if (!Array.isArray(body.errors)) return undefined;
	return body.errors as ReadonlyArray<ApiValidationError>;
}

export function getApiErrorRetryAfter(error: unknown): number | undefined {
	return getResponseRetryAfter(getBody(error));
}
