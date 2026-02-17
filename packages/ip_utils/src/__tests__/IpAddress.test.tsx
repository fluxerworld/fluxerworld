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

import {isValidIp, normalizeIpString, parseIpAddress} from '@fluxer/ip_utils/src/IpAddress';
import {describe, expect, it} from 'vitest';

describe('normalizeIpString', () => {
	describe('ipv4 addresses', () => {
		it('normalizes standard values', () => {
			expect(normalizeIpString('192.168.1.1')).toBe('192.168.1.1');
			expect(normalizeIpString('10.0.0.1')).toBe('10.0.0.1');
			expect(normalizeIpString('172.16.0.1')).toBe('172.16.0.1');
		});

		it('trims whitespace', () => {
			expect(normalizeIpString('  192.168.1.1  ')).toBe('192.168.1.1');
			expect(normalizeIpString('\t10.0.0.1\n')).toBe('10.0.0.1');
		});
	});

	describe('ipv6 addresses', () => {
		it('normalizes standard values', () => {
			expect(normalizeIpString('2001:db8::1')).toBe('2001:db8::1');
			expect(normalizeIpString('::1')).toBe('::1');
			expect(normalizeIpString('::')).toBe('::');
		});

		it('strips brackets and zone identifiers', () => {
			expect(normalizeIpString('[2001:db8::1]')).toBe('2001:db8::1');
			expect(normalizeIpString('fe80::1%eth0')).toBe('fe80::1');
			expect(normalizeIpString('[fe80::1%en0]')).toBe('fe80::1');
		});

		it('normalizes case and compact form', () => {
			expect(normalizeIpString('2001:DB8::1')).toBe('2001:db8::1');
			expect(normalizeIpString('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
		});

		it('normalizes ipv4-mapped ipv6 addresses', () => {
			expect(normalizeIpString('::ffff:192.0.2.1')).toBe('::ffff:c000:201');
		});
	});

	describe('edge cases', () => {
		it('handles empty and invalid values', () => {
			expect(normalizeIpString('')).toBe('');
			expect(normalizeIpString('   ')).toBe('');
			expect(normalizeIpString('not-an-ip')).toBe('not-an-ip');
		});

		it('does not strip brackets from host-port formats', () => {
			expect(normalizeIpString('[2001:db8::1]:8080')).toBe('[2001:db8::1]:8080');
		});

		it('returns input value when url parsing fails', () => {
			const OriginalURL = globalThis.URL;
			globalThis.URL = class extends OriginalURL {
				constructor(input: string | URL, base?: string | URL) {
					if (typeof input === 'string' && input.includes('[2001:db8::ffff]')) {
						throw new Error('Simulated URL parsing failure');
					}
					super(input, base);
				}
			} as typeof URL;

			try {
				expect(normalizeIpString('2001:db8::ffff')).toBe('2001:db8::ffff');
			} finally {
				globalThis.URL = OriginalURL;
			}
		});
	});
});

describe('parseIpAddress', () => {
	it('parses valid ip values', () => {
		expect(parseIpAddress('192.168.1.1')).toEqual({
			raw: '192.168.1.1',
			normalized: '192.168.1.1',
			family: 'ipv4',
		});
		expect(parseIpAddress('[2001:DB8::1]')).toEqual({
			raw: '[2001:DB8::1]',
			normalized: '2001:db8::1',
			family: 'ipv6',
		});
	});

	it('returns null for invalid values', () => {
		expect(parseIpAddress('not-an-ip')).toBeNull();
		expect(parseIpAddress('')).toBeNull();
	});
});

describe('isValidIp', () => {
	it('accepts valid values', () => {
		expect(isValidIp('192.168.1.1')).toBe(true);
		expect(isValidIp('[::1]')).toBe(true);
		expect(isValidIp('fe80::1%eth0')).toBe(true);
	});

	it('rejects invalid values', () => {
		expect(isValidIp('256.256.256.256')).toBe(false);
		expect(isValidIp('gggg::1')).toBe(false);
		expect(isValidIp('example.com')).toBe(false);
	});
});
