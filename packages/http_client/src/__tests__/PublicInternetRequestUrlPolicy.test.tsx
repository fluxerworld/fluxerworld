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

import type {RequestUrlValidationContext} from '@fluxer/http_client/src/HttpClientTypes';
import {createPublicInternetRequestUrlPolicy} from '@fluxer/http_client/src/PublicInternetRequestUrlPolicy';
import {describe, expect, it, vi} from 'vitest';

function createContext(overrides?: Partial<RequestUrlValidationContext>): RequestUrlValidationContext {
	return {
		phase: 'initial',
		redirectCount: 0,
		...overrides,
	};
}

describe('createPublicInternetRequestUrlPolicy', () => {
	it('blocks non-http protocols', async () => {
		const policy = createPublicInternetRequestUrlPolicy();

		await expect(policy.validate(new URL('ftp://example.com/file.txt'), createContext())).rejects.toThrow(
			'Only HTTP and HTTPS protocols are allowed',
		);
	});

	it('blocks hostnames that are not FQDNs', async () => {
		const lookupHost = vi.fn(async () => ['93.184.216.34']);
		const policy = createPublicInternetRequestUrlPolicy({lookupHost});

		await expect(policy.validate(new URL('https://localhost/path'), createContext())).rejects.toThrow(
			'Hostname is not a valid FQDN',
		);
		expect(lookupHost).not.toHaveBeenCalled();
	});

	it('blocks internal IPv4 literal addresses', async () => {
		const policy = createPublicInternetRequestUrlPolicy();

		await expect(policy.validate(new URL('http://127.0.0.1/admin'), createContext())).rejects.toThrow(
			'IP address is in an internal or special-use range',
		);
	});

	it('blocks internal IPv6 literal addresses', async () => {
		const policy = createPublicInternetRequestUrlPolicy();

		await expect(policy.validate(new URL('http://[::1]/admin'), createContext())).rejects.toThrow(
			'IP address is in an internal or special-use range',
		);
	});

	it('blocks IPv4-mapped IPv6 loopback literals', async () => {
		const policy = createPublicInternetRequestUrlPolicy();

		await expect(policy.validate(new URL('http://[::ffff:7f00:1]/admin'), createContext())).rejects.toThrow(
			'IP address is in an internal or special-use range',
		);
	});

	it('blocks FQDNs that resolve to internal addresses', async () => {
		const policy = createPublicInternetRequestUrlPolicy({
			lookupHost: async () => ['10.0.0.5'],
		});

		await expect(policy.validate(new URL('https://cdn.example.com/image.png'), createContext())).rejects.toThrow(
			'Hostname resolved to disallowed address',
		);
	});

	it('allows FQDNs that resolve only to public addresses', async () => {
		const policy = createPublicInternetRequestUrlPolicy({
			lookupHost: async () => ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'],
		});

		await expect(policy.validate(new URL('https://example.com/image.png'), createContext())).resolves.toBeUndefined();
	});
});
