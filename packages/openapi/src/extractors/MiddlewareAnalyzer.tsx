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

import type {ExtractedRoute} from '@fluxer/openapi/src/Types';

export interface SecurityRequirement {
	type: 'bearer' | 'none';
	scopes?: Array<string>;
	description?: string;
}

export interface RateLimitInfo {
	bucket: string;
	configName: string;
}

export function analyzeSecurityRequirements(route: ExtractedRoute): SecurityRequirement {
	if (route.hasLoginRequired || route.hasLoginRequiredAllowSuspicious || route.hasDefaultUserOnly) {
		return {
			type: 'bearer',
			description: route.hasDefaultUserOnly
				? 'Requires authentication (user accounts only, no bots)'
				: route.hasLoginRequiredAllowSuspicious
					? 'Requires authentication (allows accounts with suspicious activity flags)'
					: 'Requires authentication',
		};
	}

	return {type: 'none'};
}

export function analyzeRateLimitConfig(route: ExtractedRoute): RateLimitInfo | null {
	if (!route.rateLimitConfig) {
		return null;
	}

	const configText = route.rateLimitConfig;

	const match = configText.match(/RateLimitConfigs\.(\w+)/);
	if (match) {
		const configName = match[1];
		return {
			bucket: configNameToBucket(configName),
			configName,
		};
	}

	return {
		bucket: 'unknown',
		configName: configText,
	};
}

function configNameToBucket(configName: string): string {
	return configName
		.replace(/_/g, ':')
		.toLowerCase()
		.replace(/^(\w+):(\w+)$/, '$1:$2');
}

export function requiresSudoMode(route: ExtractedRoute): boolean {
	return route.hasSudoMode;
}

export function getRouteDescription(route: ExtractedRoute): string {
	const parts: Array<string> = [];

	if (route.hasSudoMode) {
		parts.push('Requires sudo mode verification.');
	}

	if (route.hasDefaultUserOnly) {
		parts.push('Only available to user accounts (not bots).');
	}

	return parts.join(' ');
}
