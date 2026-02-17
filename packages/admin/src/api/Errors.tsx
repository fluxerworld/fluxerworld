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

import type {JsonValue} from '@fluxer/admin/src/api/JsonTypes';
import {isJsonObject, parseJson} from '@fluxer/admin/src/api/JsonTypes';

export interface ValidationError {
	path: string;
	message: string;
	code: string;
}

export type ApiError =
	| {type: 'unauthorized'}
	| {type: 'forbidden'; code: string; message: string; details: Record<string, string>}
	| {type: 'notFound'; code: string; message: string}
	| {type: 'badRequest'; code: string; message: string; errors: Array<ValidationError>}
	| {type: 'rateLimited'; code: string; message: string; retryAfter: number; isGlobal: boolean}
	| {type: 'clientError'; status: number; code: string; message: string}
	| {type: 'serverError'; status: number; code: string | null; message: string}
	| {type: 'networkError'; message: string}
	| {type: 'parseError'; body: string; parseError: string};

export function isUnauthorized(error: ApiError): error is {type: 'unauthorized'} {
	return error.type === 'unauthorized';
}

export function isForbidden(
	error: ApiError,
): error is {type: 'forbidden'; code: string; message: string; details: Record<string, string>} {
	return error.type === 'forbidden';
}

export function isNotFound(error: ApiError): error is {type: 'notFound'; code: string; message: string} {
	return error.type === 'notFound';
}

export function getErrorMessage(error: ApiError): string {
	switch (error.type) {
		case 'unauthorized':
			return 'Authentication required';
		case 'forbidden':
			return error.message;
		case 'notFound':
			return error.message;
		case 'badRequest':
			return error.message;
		case 'rateLimited':
			return error.message;
		case 'clientError':
			return error.message;
		case 'serverError':
			return error.message;
		case 'networkError':
			return error.message;
		case 'parseError':
			return 'Failed to parse API response';
	}
}

export function getErrorCode(error: ApiError): string | null {
	switch (error.type) {
		case 'forbidden':
			return error.code;
		case 'notFound':
			return error.code;
		case 'badRequest':
			return error.code;
		case 'rateLimited':
			return error.code;
		case 'clientError':
			return error.code;
		case 'serverError':
			return error.code;
		default:
			return null;
	}
}

export function getErrorDisplayString(error: ApiError): string {
	switch (error.type) {
		case 'badRequest': {
			const base = `${error.message} (${error.code})`;
			if (error.errors.length === 0) return base;
			const errorDetails = error.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
			return `${base}\n${errorDetails}`;
		}
		case 'rateLimited':
			return `${error.message} (Retry after ${Math.round(error.retryAfter)}s)`;
		case 'forbidden':
			return error.message;
		case 'notFound':
			return error.message;
		case 'clientError':
			return error.message;
		case 'serverError':
			return error.code ? `${error.message} (Error code: ${error.code})` : error.message;
		default:
			return getErrorMessage(error);
	}
}

export function isRetryable(error: ApiError): boolean {
	return error.type === 'rateLimited' || error.type === 'serverError' || error.type === 'networkError';
}

export function getRetryAfterSeconds(error: ApiError): number | null {
	if (error.type === 'rateLimited') {
		return error.retryAfter;
	}
	return null;
}

export function getValidationErrors(error: ApiError): Array<ValidationError> {
	if (error.type === 'badRequest') {
		return error.errors;
	}
	return [];
}

export function getErrorTitle(error: ApiError): string {
	switch (error.type) {
		case 'unauthorized':
			return 'Authentication Required';
		case 'forbidden':
			return 'Permission Denied';
		case 'notFound':
			return 'Not Found';
		case 'badRequest':
			return 'Validation Error';
		case 'rateLimited':
			return 'Rate Limited';
		case 'clientError':
			return 'Client Error';
		case 'serverError':
			return 'Server Error';
		case 'networkError':
			return 'Network Error';
		case 'parseError':
			return 'Response Error';
	}
}

export function getErrorSubtitle(error: ApiError): string {
	switch (error.type) {
		case 'unauthorized':
			return 'Your session has expired. Please log in again.';
		case 'forbidden':
			return "You don't have permission to perform this action.";
		case 'notFound':
			return 'The requested resource could not be found.';
		case 'badRequest':
			return 'Please check your input and try again.';
		case 'rateLimited':
			return "You've made too many requests. Please wait before trying again.";
		case 'clientError':
			return 'The request was invalid or malformed.';
		case 'serverError':
			return 'An internal server error occurred. Please try again later.';
		case 'networkError':
			return 'Could not connect to the server. Please check your connection.';
		case 'parseError':
			return 'The server returned an invalid response.';
	}
}

export function getErrorDetails(error: ApiError): Array<string> {
	switch (error.type) {
		case 'forbidden':
			return [`Permission denied (Error code: ${error.code})`];
		case 'notFound':
			return [`Resource not found (Error code: ${error.code})`];
		case 'badRequest': {
			const codeDetail = `Validation failed (Error code: ${error.code})`;
			const validationDetails = error.errors.map((e) => `${e.path}: ${e.message}`);
			return [codeDetail, ...validationDetails];
		}
		case 'rateLimited':
			return [
				`Rate limit exceeded (Error code: ${error.code})`,
				`Retry after: ${Math.round(error.retryAfter)} seconds`,
				error.isGlobal ? 'This is a global rate limit' : 'This is an endpoint-specific rate limit',
			];
		case 'clientError':
			return [`HTTP Status: ${error.status}`, `Client error (Error code: ${error.code})`];
		case 'serverError': {
			const statusDetail = `HTTP Status: ${error.status}`;
			return error.code ? [statusDetail, `Error code: ${error.code}`] : [statusDetail];
		}
		case 'parseError': {
			const preview = error.body.slice(0, 200).replace(/\n/g, ' ');
			return ['Could not parse server response', `Response preview: ${preview}`];
		}
		default:
			return [];
	}
}

export async function parseApiResponse<T>(
	response: Response,
): Promise<{ok: true; data: T} | {ok: false; error: ApiError}> {
	if (response.ok) {
		try {
			const data = (await response.json()) as T;
			return {ok: true, data};
		} catch (e) {
			const body = await response.text().catch(() => '');
			return {ok: false, error: {type: 'parseError', body, parseError: String(e)}};
		}
	}

	if (response.status === 401) {
		return {ok: false, error: {type: 'unauthorized'}};
	}

	const bodyText = await response.text().catch(() => '');
	const parsed = parseJson(bodyText);
	const body = isJsonObject(parsed) ? parsed : {};

	if (response.status === 403) {
		return {
			ok: false,
			error: {
				type: 'forbidden',
				code: typeof body['code'] === 'string' ? body['code'] : 'FORBIDDEN',
				message: typeof body['message'] === 'string' ? body['message'] : bodyText || 'Forbidden',
				details: Object.fromEntries(
					Object.entries(body).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v] as const] : [])),
				),
			},
		};
	}

	if (response.status === 404) {
		return {
			ok: false,
			error: {
				type: 'notFound',
				code: typeof body['code'] === 'string' ? body['code'] : 'NOT_FOUND',
				message: typeof body['message'] === 'string' ? body['message'] : 'The requested resource was not found.',
			},
		};
	}

	if (response.status === 400) {
		const errors: Array<ValidationError> = [];
		const errorList = Array.isArray(body['errors']) ? body['errors'] : [];
		for (const e of errorList) {
			if (typeof e !== 'object' || e === null || Array.isArray(e)) {
				continue;
			}
			const errObj = e as {[key: string]: JsonValue};
			errors.push({
				path: typeof errObj['path'] === 'string' ? errObj['path'] : '',
				message: typeof errObj['message'] === 'string' ? errObj['message'] : '',
				code: typeof errObj['code'] === 'string' ? errObj['code'] : '',
			});
		}
		return {
			ok: false,
			error: {
				type: 'badRequest',
				code: typeof body['code'] === 'string' ? body['code'] : 'BAD_REQUEST',
				message: typeof body['message'] === 'string' ? body['message'] : 'Bad request',
				errors,
			},
		};
	}

	if (response.status === 429) {
		const retryAfterHeader = response.headers.get('retry-after');
		const retryAfter = retryAfterHeader ? parseFloat(retryAfterHeader) : 60;
		return {
			ok: false,
			error: {
				type: 'rateLimited',
				code: (body['code'] as string) ?? 'RATE_LIMITED',
				message: (body['message'] as string) ?? 'Rate limited',
				retryAfter,
				isGlobal: (body['global'] as boolean) ?? false,
			},
		};
	}

	if (response.status >= 500) {
		return {
			ok: false,
			error: {
				type: 'serverError',
				status: response.status,
				code: (body['code'] as string) ?? null,
				message: (body['message'] as string) ?? (bodyText || 'Server error'),
			},
		};
	}

	return {
		ok: false,
		error: {
			type: 'clientError',
			status: response.status,
			code: (body['code'] as string) ?? 'CLIENT_ERROR',
			message: (body['message'] as string) ?? (bodyText || `HTTP ${response.status}`),
		},
	};
}
