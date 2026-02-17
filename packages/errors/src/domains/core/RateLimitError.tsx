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
import {ThrottledError} from '@fluxer/errors/src/domains/core/ThrottledError';
import type {FluxerErrorData} from '@fluxer/errors/src/FluxerError';

function sanitizeRetryAfter(value: number | undefined | null): number {
	if (value == null || !Number.isFinite(value) || value < 0) {
		return 1;
	}
	return Math.max(1, Math.ceil(value));
}

function sanitizeRetryAfterDecimal(value: number | undefined | null, fallback: number): number {
	if (value == null || !Number.isFinite(value) || value < 0) {
		return fallback;
	}
	return Math.max(0.001, value);
}

function sanitizeResetTime(resetTime: Date): number {
	const timestamp = resetTime.getTime();
	if (!Number.isFinite(timestamp)) {
		return Math.floor(Date.now() / 1000) + 60;
	}
	const resetSeconds = Math.floor(timestamp / 1000);
	const nowSeconds = Math.floor(Date.now() / 1000);
	if (resetSeconds <= nowSeconds) {
		return nowSeconds + 1;
	}
	return resetSeconds;
}

export class RateLimitError extends ThrottledError {
	constructor({
		code = APIErrorCodes.RATE_LIMITED,
		message,
		global = false,
		retryAfter,
		retryAfterDecimal,
		limit,
		resetTime,
	}: {
		code?: string;
		message?: string;
		global?: boolean;
		retryAfter: number;
		retryAfterDecimal?: number;
		limit: number;
		resetTime: Date;
	}) {
		const safeRetryAfter = sanitizeRetryAfter(retryAfter);
		const safeRetryAfterDecimal = sanitizeRetryAfterDecimal(retryAfterDecimal, safeRetryAfter);
		const safeResetTimestamp = sanitizeResetTime(resetTime);
		const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;

		const data: FluxerErrorData = {
			global,
			retry_after: safeRetryAfterDecimal,
		};
		const headers = {
			'X-RateLimit-Global': global ? 'true' : 'false',
			'X-RateLimit-Limit': safeLimit.toString(),
			'X-RateLimit-Remaining': '0',
			'X-RateLimit-Reset': safeResetTimestamp.toString(),
			'Retry-After': safeRetryAfter.toString(),
		};
		super({code, message, data, headers});
	}
}
