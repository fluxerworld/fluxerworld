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

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {HTTPException} from 'hono/http-exception';

const apiErrorCodeSet = new Set<string>(Object.values(APIErrorCodes));

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isApiErrorCode(value: unknown): value is string {
	return typeof value === 'string' && apiErrorCodeSet.has(value);
}

export function getErrorRecord(err: unknown): Record<string, unknown> | null {
	if (!isRecord(err)) {
		return null;
	}
	return err;
}

export function resolveApiErrorCode(err: unknown): string | null {
	if (err instanceof FluxerError) {
		return err.code;
	}

	if (err instanceof HTTPException && 'code' in err && typeof err.code === 'string') {
		if (isApiErrorCode(err.code)) {
			return err.code;
		}
	}

	const record = getErrorRecord(err);
	if (!record) {
		return null;
	}

	if (isApiErrorCode(record.code)) {
		return record.code;
	}

	if (isApiErrorCode(record.message)) {
		return record.message;
	}

	return null;
}

export function resolveErrorStatus(err: unknown): number | null {
	if (err instanceof FluxerError || err instanceof HTTPException) {
		return err.status;
	}

	const record = getErrorRecord(err);
	if (!record || typeof record.status !== 'number') {
		return null;
	}

	return record.status >= 100 && record.status <= 599 ? record.status : null;
}

export function resolveErrorData(err: unknown): Record<string, unknown> | undefined {
	if (err instanceof HTTPException && 'data' in err && isRecord(err.data)) {
		return err.data;
	}

	const record = getErrorRecord(err);
	if (!record) {
		return undefined;
	}

	if (isRecord(record.data)) {
		return record.data;
	}

	return undefined;
}

export function resolveErrorHeaders(err: unknown): Record<string, string> | undefined {
	if (err instanceof HTTPException && 'headers' in err && isRecord(err.headers)) {
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(err.headers)) {
			if (typeof value === 'string') {
				headers[key] = value;
			}
		}
		return Object.keys(headers).length > 0 ? headers : undefined;
	}

	const record = getErrorRecord(err);
	if (!record || !isRecord(record.headers)) {
		return undefined;
	}

	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(record.headers)) {
		if (typeof value === 'string') {
			headers[key] = value;
		}
	}

	return Object.keys(headers).length > 0 ? headers : undefined;
}

export function resolveMessageVariables(err: unknown): Record<string, unknown> | undefined {
	if (err instanceof HTTPException && 'messageVariables' in err && isRecord(err.messageVariables)) {
		return err.messageVariables;
	}

	const record = getErrorRecord(err);
	if (!record) {
		return undefined;
	}

	return isRecord(record.messageVariables) ? record.messageVariables : undefined;
}

export function resolveErrorMessage(err: unknown): string | undefined {
	const record = getErrorRecord(err);
	if (!record || typeof record.message !== 'string') {
		return undefined;
	}

	return record.message;
}

export function hasApiErrorCode(value: string): boolean {
	return apiErrorCodeSet.has(value);
}
