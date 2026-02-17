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

import {assertNonEmptyString} from '@fluxer/rate_limit/src/internal/RateLimitValidation';

const RATE_LIMIT_PREFIX = 'ratelimit';
const BUCKET_NAMESPACE = 'bucket';
const GLOBAL_NAMESPACE = 'global';

export interface IRateLimitKeyFactory {
	getIdentifierKey(identifier: string): string;
	getBucketKey(bucket: string): string;
	getGlobalKey(identifier: string): string;
}

export class RateLimitKeyFactory implements IRateLimitKeyFactory {
	getIdentifierKey(identifier: string): string {
		assertNonEmptyString(identifier, 'identifier');
		return `${RATE_LIMIT_PREFIX}:${identifier}`;
	}

	getBucketKey(bucket: string): string {
		assertNonEmptyString(bucket, 'bucket');
		return `${RATE_LIMIT_PREFIX}:${BUCKET_NAMESPACE}:${bucket}`;
	}

	getGlobalKey(identifier: string): string {
		assertNonEmptyString(identifier, 'identifier');
		return `${RATE_LIMIT_PREFIX}:${GLOBAL_NAMESPACE}:${identifier}`;
	}
}
