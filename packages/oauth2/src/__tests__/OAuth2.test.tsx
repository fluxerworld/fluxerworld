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

import {authorizeUrl, base64EncodeString, generateState, type OAuth2Config} from '@fluxer/oauth2/src/OAuth2';
import {describe, expect, it} from 'vitest';

function createTestConfig(overrides?: Partial<OAuth2Config>): OAuth2Config {
	return {
		clientId: 'test-client-id',
		clientSecret: 'test-client-secret',
		redirectUri: 'https://example.com/callback',
		authorizeEndpoint: 'https://auth.example.com/authorize',
		tokenEndpoint: 'https://auth.example.com/token',
		scope: 'openid profile email',
		...overrides,
	};
}

describe('generateState', () => {
	it('should generate a base64url encoded string', () => {
		const state = generateState();
		expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('should generate a string of appropriate length for 32 bytes', () => {
		const state = generateState();
		expect(state.length).toBe(43);
	});

	it('should generate unique states on each call', () => {
		const state1 = generateState();
		const state2 = generateState();
		const state3 = generateState();
		expect(state1).not.toBe(state2);
		expect(state2).not.toBe(state3);
		expect(state1).not.toBe(state3);
	});

	it('should not contain characters that need URL encoding', () => {
		for (let i = 0; i < 10; i++) {
			const state = generateState();
			expect(state).not.toContain('+');
			expect(state).not.toContain('/');
			expect(state).not.toContain('=');
		}
	});
});

describe('authorizeUrl', () => {
	it('should construct a valid authorization URL with all parameters', () => {
		const config = createTestConfig();
		const state = 'test-state-123';
		const url = authorizeUrl(config, state);
		const parsed = new URL(url);

		expect(parsed.origin).toBe('https://auth.example.com');
		expect(parsed.pathname).toBe('/authorize');
		expect(parsed.searchParams.get('response_type')).toBe('code');
		expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
		expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
		expect(parsed.searchParams.get('scope')).toBe('openid profile email');
		expect(parsed.searchParams.get('state')).toBe('test-state-123');
	});

	it('should handle special characters in scope', () => {
		const config = createTestConfig({scope: 'read:user write:repo'});
		const state = 'test-state';
		const url = authorizeUrl(config, state);
		const parsed = new URL(url);

		expect(parsed.searchParams.get('scope')).toBe('read:user write:repo');
	});

	it('should handle redirect URIs with query parameters', () => {
		const config = createTestConfig({
			redirectUri: 'https://example.com/callback?app=test',
		});
		const state = 'test-state';
		const url = authorizeUrl(config, state);
		const parsed = new URL(url);

		expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback?app=test');
	});

	it('should handle empty scope', () => {
		const config = createTestConfig({scope: ''});
		const state = 'test-state';
		const url = authorizeUrl(config, state);
		const parsed = new URL(url);

		expect(parsed.searchParams.get('scope')).toBe('');
	});

	it('should handle authorize endpoint with existing query parameters', () => {
		const config = createTestConfig({
			authorizeEndpoint: 'https://auth.example.com/authorize?extra=param',
		});
		const state = 'test-state';
		const url = authorizeUrl(config, state);

		expect(url).toContain('authorize?extra=param?');
		expect(url).toContain('response_type=code');
	});

	it('should properly encode special characters in state', () => {
		const config = createTestConfig();
		const state = 'state+with/special=chars';
		const url = authorizeUrl(config, state);
		const parsed = new URL(url);

		expect(parsed.searchParams.get('state')).toBe('state+with/special=chars');
	});
});

describe('base64EncodeString', () => {
	it('should encode a simple string to base64', () => {
		const encoded = base64EncodeString('hello');
		expect(encoded).toBe('aGVsbG8=');
	});

	it('should encode credentials for Basic auth', () => {
		const encoded = base64EncodeString('client_id:client_secret');
		expect(encoded).toBe('Y2xpZW50X2lkOmNsaWVudF9zZWNyZXQ=');
	});

	it('should encode empty string', () => {
		const encoded = base64EncodeString('');
		expect(encoded).toBe('');
	});

	it('should encode unicode characters', () => {
		const encoded = base64EncodeString('hello world');
		expect(encoded).toBe('aGVsbG8gd29ybGQ=');
	});

	it('should encode special characters', () => {
		const encoded = base64EncodeString('user:p@ss!word#123');
		expect(encoded).toBe('dXNlcjpwQHNzIXdvcmQjMTIz');
	});

	it('should produce decodable output', () => {
		const original = 'test-client:test-secret';
		const encoded = base64EncodeString(original);
		const decoded = Buffer.from(encoded, 'base64').toString();
		expect(decoded).toBe(original);
	});
});
