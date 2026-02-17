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

import type {HttpErrorType} from '@fluxer/http_client/src/HttpError';

const NETWORK_ERROR_CODES = new Set([
	'ENOTFOUND',
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
]);

const NETWORK_ERROR_MESSAGE_FRAGMENTS = [
	'ENOTFOUND',
	'ECONNREFUSED',
	'ECONNRESET',
	'ETIMEDOUT',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'fetch failed',
] as const;

interface NodeErrorLike {
	code?: unknown;
	cause?: unknown;
}

interface NodeCauseLike {
	code?: unknown;
}

export interface ClassifiedRequestError {
	message: string;
	isNetworkError: boolean;
	errorType: HttpErrorType;
}

export interface RequestSignalContext {
	signal: AbortSignal;
	cleanup(): void;
}

function isNodeErrorLike(error: unknown): error is NodeErrorLike {
	return typeof error === 'object' && error !== null;
}

function resolveErrorCode(error: unknown): string | undefined {
	if (!isNodeErrorLike(error)) {
		return undefined;
	}

	if (typeof error.code === 'string') {
		return error.code;
	}

	if (!isNodeErrorLike(error.cause)) {
		return undefined;
	}

	const cause: NodeCauseLike = error.cause;
	if (typeof cause.code === 'string') {
		return cause.code;
	}

	return undefined;
}

export function buildRequestHeaders(
	defaultHeaders: Record<string, string>,
	requestHeaders?: Record<string, string>,
): Record<string, string> {
	if (!requestHeaders) {
		return {...defaultHeaders};
	}
	return {...defaultHeaders, ...requestHeaders};
}

export function resolveRequestBody(body: unknown, headers: Record<string, string>): string | undefined {
	if (body === null || body === undefined) {
		return undefined;
	}

	if (typeof body === 'string') {
		return body;
	}

	if (!headers['Content-Type'] && !headers['content-type']) {
		headers['Content-Type'] = 'application/json';
	}
	return JSON.stringify(body);
}

export function createRequestSignal(timeoutMs: number, inputSignal?: AbortSignal): RequestSignalContext {
	const timeoutController = new AbortController();
	const combinedController = new AbortController();
	const attachedListeners: Array<{signal: AbortSignal; listener: () => void}> = [];

	const timeoutId = setTimeout(() => {
		timeoutController.abort('Request timed out');
	}, timeoutMs);

	function abortWithReason(reason: unknown): void {
		if (!combinedController.signal.aborted) {
			combinedController.abort(reason);
		}
	}

	function attachSignal(signal: AbortSignal): void {
		if (signal.aborted) {
			abortWithReason(signal.reason);
			return;
		}

		const listener = () => {
			abortWithReason(signal.reason);
		};

		signal.addEventListener('abort', listener, {once: true});
		attachedListeners.push({signal, listener});
	}

	if (inputSignal) {
		attachSignal(inputSignal);
	}
	attachSignal(timeoutController.signal);

	function cleanup(): void {
		clearTimeout(timeoutId);
		for (const attachedListener of attachedListeners) {
			attachedListener.signal.removeEventListener('abort', attachedListener.listener);
		}
	}

	return {
		signal: combinedController.signal,
		cleanup,
	};
}

export function classifyRequestError(error: unknown): ClassifiedRequestError {
	const message = error instanceof Error ? error.message : 'Request failed';
	if (error instanceof Error && error.name === 'AbortError') {
		return {
			message,
			isNetworkError: false,
			errorType: 'aborted',
		};
	}

	const errorCode = resolveErrorCode(error);
	const containsNetworkErrorMessage = NETWORK_ERROR_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
	const isNetworkError =
		(errorCode !== undefined && NETWORK_ERROR_CODES.has(errorCode)) ||
		containsNetworkErrorMessage ||
		error instanceof TypeError;

	if (isNetworkError) {
		return {
			message,
			isNetworkError: true,
			errorType: 'network_error',
		};
	}

	return {
		message,
		isNetworkError: false,
		errorType: 'unknown',
	};
}

export function statusToMetricLabel(status: number): string {
	if (status >= 200 && status < 300) {
		return '2xx';
	}
	return status.toString();
}
