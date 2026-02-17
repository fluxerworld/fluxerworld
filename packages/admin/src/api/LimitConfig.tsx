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

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {LimitConfigGetResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

type LimitConfigResponse = z.infer<typeof LimitConfigGetResponse>;
type LimitRule = LimitConfigResponse['limit_config']['rules'][number];

export async function getLimitConfig(config: Config, session: Session): Promise<ApiResult<LimitConfigResponse>> {
	const client = new ApiClient(config, session);
	return client.post<LimitConfigResponse>('/admin/limit-config/get', {});
}

export async function updateLimitConfig(
	config: Config,
	session: Session,
	limitConfigJsonValue: string,
): Promise<ApiResult<LimitConfigResponse>> {
	const client = new ApiClient(config, session);
	return client.post<LimitConfigResponse>('/admin/limit-config/update', `{"limit_config":${limitConfigJsonValue}}`);
}

export function getDefaultValue(response: LimitConfigResponse, ruleId: string, limitKey: string): number | null {
	const ruleDefaults = response.defaults[ruleId];
	if (!ruleDefaults) {
		return null;
	}
	const value = ruleDefaults[limitKey];
	return value !== undefined ? value : null;
}

export function isModified(rule: LimitRule, limitKey: string): boolean {
	return rule.modifiedFields?.includes(limitKey) ?? false;
}

export function getKeysByCategory(response: LimitConfigResponse): Record<string, Array<string>> {
	const result: Record<string, Array<string>> = {};

	for (const key of response.limit_keys) {
		const meta = response.metadata[key];
		if (meta) {
			const category = meta.category;
			if (!result[category]) {
				result[category] = [];
			}
			result[category].push(key);
		}
	}

	return result;
}
