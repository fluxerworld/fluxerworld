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

import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {KVCacheProvider} from '@fluxer/cache/src/providers/KVCacheProvider';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {KVClient} from '@fluxer/kv_client/src/KVClient';
import {throwKVRequiredError} from '@fluxer/rate_limit/src/KVRequiredError';
import {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import type {S3RateLimitConfig} from '@fluxer/s3/src/app/S3AppConfigTypes';

interface ResolveS3RateLimitServiceOptions {
	kvUrl?: string;
	rateLimitService?: RateLimitService | null;
	rateLimitConfig?: S3RateLimitConfig | null;
}

export function resolveS3RateLimitService(options: ResolveS3RateLimitServiceOptions): RateLimitService | null {
	const {kvUrl, rateLimitService, rateLimitConfig} = options;

	if (rateLimitService) {
		return rateLimitService;
	}

	if (!rateLimitConfig?.enabled) {
		return null;
	}

	if (!kvUrl) {
		throwKVRequiredError({
			serviceName: 'S3 service',
			configPath: 'kvUrl option',
			fluxerServerHint: 'rateLimitService is passed in as an option',
		});
	}

	const kvProvider = createKVProvider(kvUrl);
	const cacheService: ICacheService = new KVCacheProvider({client: kvProvider});
	return new RateLimitService(cacheService);
}

function createKVProvider(kvUrl: string): IKVProvider {
	return new KVClient({url: kvUrl});
}
