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

import type {MasterConfig} from '@fluxer/config/src/MasterZodSchema.generated';
import {
	extractBaseServiceConfig,
	extractBuildInfoConfig,
	extractKVClientConfig,
	extractRateLimit,
} from '@fluxer/config/src/ServiceConfigSlices';
import {describe, expect, test} from 'vitest';

function createMasterStub(overrides: Partial<MasterConfig> = {}): MasterConfig {
	return {
		env: 'development',
		telemetry: {enabled: false, otlp_endpoint: 'http://localhost:4318', api_key: '', trace_sampling_ratio: 1},
		sentry: {enabled: false, dsn: ''},
		internal: {
			kv: 'redis://127.0.0.1:6379/0',
			media_proxy: 'http://localhost:8088/media',
		},
		services: {} as MasterConfig['services'],
		...overrides,
	} as MasterConfig;
}

describe('extractBaseServiceConfig', () => {
	test('returns env, telemetry, and sentry from master config', () => {
		const master = createMasterStub({env: 'production'});
		const result = extractBaseServiceConfig(master);
		expect(result).toEqual({
			env: 'production',
			telemetry: master.telemetry,
			sentry: master.sentry,
		});
	});
});

describe('extractKVClientConfig', () => {
	test('returns kvUrl', () => {
		const master = createMasterStub();
		const result = extractKVClientConfig(master);
		expect(result).toEqual({
			kvUrl: 'redis://127.0.0.1:6379/0',
		});
	});

	test('throws when internal is missing', () => {
		const master = createMasterStub();
		(master as Record<string, unknown>).internal = undefined;
		expect(() => extractKVClientConfig(master)).toThrow('internal configuration is required');
	});
});

describe('extractBuildInfoConfig', () => {
	test('returns releaseChannel and buildTimestamp', () => {
		const result = extractBuildInfoConfig();
		expect(result).toHaveProperty('releaseChannel');
		expect(result).toHaveProperty('buildTimestamp');
		expect(typeof result.releaseChannel).toBe('string');
		expect(typeof result.buildTimestamp).toBe('string');
	});
});

describe('extractRateLimit', () => {
	test('returns undefined for null input', () => {
		expect(extractRateLimit(null)).toBeUndefined();
	});

	test('returns undefined for undefined input', () => {
		expect(extractRateLimit(undefined)).toBeUndefined();
	});

	test('returns undefined when limit is missing', () => {
		expect(extractRateLimit({window_ms: 60000})).toBeUndefined();
	});

	test('returns undefined when window_ms is missing', () => {
		expect(extractRateLimit({limit: 100})).toBeUndefined();
	});

	test('returns normalised object for valid input', () => {
		const result = extractRateLimit({limit: 100, window_ms: 60000});
		expect(result).toEqual({limit: 100, windowMs: 60000});
	});
});
