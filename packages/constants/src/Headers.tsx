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

export const Headers = {
	CONTENT_TYPE: 'Content-Type',
	CONTENT_LENGTH: 'Content-Length',
	CONTENT_DISPOSITION: 'Content-Disposition',
	AUTHORIZATION: 'Authorization',
	ACCEPT: 'Accept',
	CACHE_CONTROL: 'Cache-Control',
	USER_AGENT: 'User-Agent',

	X_FORWARDED_FOR: 'X-Forwarded-For',
	X_FORWARDED_PROTO: 'X-Forwarded-Proto',
	X_FORWARDED_HOST: 'X-Forwarded-Host',

	X_REQUEST_ID: 'X-Request-ID',

	X_RATELIMIT_LIMIT: 'X-RateLimit-Limit',
	X_RATELIMIT_REMAINING: 'X-RateLimit-Remaining',
	X_RATELIMIT_RESET: 'X-RateLimit-Reset',

	X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
	X_FRAME_OPTIONS: 'X-Frame-Options',
	X_XSS_PROTECTION: 'X-XSS-Protection',

	X_FLUXER_SUDO_MODE_JWT: 'X-Fluxer-Sudo-Mode-JWT',
	X_AUDIT_LOG_REASON: 'X-Audit-Log-Reason',
	X_INTERNAL_API_KEY: 'X-Internal-API-Key',

	X_AMZ_REQUEST_ID: 'x-amz-request-id',
	X_AMZ_ID_2: 'x-amz-id-2',

	X_ACCEL_BUFFERING: 'X-Accel-Buffering',
} as const;

export type HeaderName = ValueOf<typeof Headers>;

export const HeaderValues = {
	NOSNIFF: 'nosniff',
	ATTACHMENT: 'attachment',

	DENY: 'DENY',
	SAMEORIGIN: 'SAMEORIGIN',

	NO: 'no',

	NO_CACHE: 'no-cache',
	NO_STORE: 'no-store',
	PUBLIC: 'public',
	PRIVATE: 'private',
} as const;

export type HeaderValue = ValueOf<typeof HeaderValues>;
