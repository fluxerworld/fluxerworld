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

import {buildEndpointUrl, validateOutboundEndpointUrl} from '@fluxer/hono/src/security/OutboundEndpoint';
import {describe, expect, test} from 'vitest';

describe('OutboundEndpoint', () => {
	test('validates and normalises a safe endpoint', () => {
		const endpoint = validateOutboundEndpointUrl('https://api.example.com/v1', {
			name: 'test.endpoint',
			allowHttp: false,
			allowLocalhost: false,
			allowPrivateIpLiterals: false,
		});

		expect(buildEndpointUrl(endpoint, '/users/@me')).toBe('https://api.example.com/v1/users/@me');
	});

	test('rejects localhost when not allowed', () => {
		expect(() =>
			validateOutboundEndpointUrl('http://localhost:8088', {
				name: 'test.endpoint',
				allowHttp: true,
				allowLocalhost: false,
				allowPrivateIpLiterals: true,
			}),
		).toThrow('cannot use localhost');
	});

	test('rejects private IP literals when not allowed', () => {
		expect(() =>
			validateOutboundEndpointUrl('http://192.168.1.8:8080', {
				name: 'test.endpoint',
				allowHttp: true,
				allowLocalhost: true,
				allowPrivateIpLiterals: false,
			}),
		).toThrow('private or special IP literals');
	});

	test('rejects absolute outbound paths', () => {
		const endpoint = validateOutboundEndpointUrl('https://api.example.com', {
			name: 'test.endpoint',
			allowHttp: false,
			allowLocalhost: false,
			allowPrivateIpLiterals: false,
		});

		expect(() => buildEndpointUrl(endpoint, 'https://evil.example.com')).toThrow('Outbound path must be relative');
	});
});
