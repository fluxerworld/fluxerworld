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

import {throwKVRequiredError} from '@fluxer/rate_limit/src/KVRequiredError';
import {describe, expect, it} from 'vitest';

describe('throwKVRequiredError', () => {
	it('should throw an error with the service name', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: 'fluxer_api',
				configPath: 'internal.kv.url',
			}),
		).toThrow('fluxer_api running in standalone mode requires KV-backed rate limiting');
	});

	it('should include the config path in the error message', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: 'TestService',
				configPath: 'config.kv.connection_string',
			}),
		).toThrow('config.kv.connection_string is not set');
	});

	it('should include the default hint when fluxerServerHint is not provided', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: 'TestService',
				configPath: 'internal.kv',
			}),
		).toThrow(
			'If running in fluxer_server mode, ensure setInjectedKVProvider() is called before service initialization',
		);
	});

	it('should include custom hint when fluxerServerHint is provided', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: 'fluxer_gateway',
				configPath: 'internal.kv.url',
				fluxerServerHint: 'the gateway is initialized after KV setup',
			}),
		).toThrow('If running in fluxer_server mode, ensure the gateway is initialized after KV setup');
	});

	it('should construct complete error message with all parts', () => {
		let errorMessage = '';
		try {
			throwKVRequiredError({
				serviceName: 'fluxer_admin',
				configPath: 'admin.kv.endpoint',
				fluxerServerHint: 'KV is properly configured',
			});
		} catch (error) {
			if (error instanceof Error) {
				errorMessage = error.message;
			}
		}

		expect(errorMessage).toContain('fluxer_admin running in standalone mode requires KV-backed rate limiting');
		expect(errorMessage).toContain('admin.kv.endpoint is not set');
		expect(errorMessage).toContain(
			'Standalone services MUST have internal.kv configured for distributed rate limiting',
		);
		expect(errorMessage).toContain('If running in fluxer_server mode, ensure KV is properly configured');
	});

	it('should always throw (never return)', () => {
		const fn = () =>
			throwKVRequiredError({
				serviceName: 'test',
				configPath: 'test.path',
			});

		expect(fn).toThrow(Error);
	});

	it('should handle empty service name', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: '',
				configPath: 'internal.kv',
			}),
		).toThrow('running in standalone mode requires KV-backed rate limiting');
	});

	it('should handle empty config path', () => {
		expect(() =>
			throwKVRequiredError({
				serviceName: 'TestService',
				configPath: '',
			}),
		).toThrow('is not set');
	});
});
