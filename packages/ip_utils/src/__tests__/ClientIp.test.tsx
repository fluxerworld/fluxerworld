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

import {
	extractClientIp,
	extractClientIpDetails,
	extractClientIpDetailsFromHeaders,
	extractClientIpFromHeaders,
	MissingClientIpError,
	requireClientIp,
} from '@fluxer/ip_utils/src/ClientIp';
import {describe, expect, it} from 'vitest';

describe('extractClientIp', () => {
	it('extracts first x-forwarded-for entry', () => {
		const request = new Request('http://example.com', {
			headers: {'X-Forwarded-For': '192.168.1.1, 10.0.0.1'},
		});

		expect(extractClientIp(request)).toBe('192.168.1.1');
	});

	it('normalizes bracketed and zoned ipv6 from x-forwarded-for', () => {
		const request = new Request('http://example.com', {
			headers: {'X-Forwarded-For': '[fe80::1%eth0]'},
		});

		expect(extractClientIp(request)).toBe('fe80::1');
	});

	it('uses cf-connecting-ip when trusted', () => {
		const request = new Request('http://example.com', {
			headers: {
				'Cf-Connecting-Ip': '203.0.113.50',
				'X-Forwarded-For': '192.168.1.1',
			},
		});

		expect(extractClientIp(request, {trustCfConnectingIp: true})).toBe('203.0.113.50');
		expect(extractClientIp(request, {trustCfConnectingIp: false})).toBe('192.168.1.1');
	});

	it('falls back to x-forwarded-for when trusted cf-connecting-ip is invalid', () => {
		const request = new Request('http://example.com', {
			headers: {
				'Cf-Connecting-Ip': 'not-an-ip',
				'X-Forwarded-For': '192.168.1.1',
			},
		});

		expect(extractClientIp(request, {trustCfConnectingIp: true})).toBe('192.168.1.1');
	});

	it('returns null for missing or invalid headers', () => {
		expect(extractClientIp(new Request('http://example.com'))).toBeNull();
		expect(
			extractClientIp(
				new Request('http://example.com', {
					headers: {'X-Forwarded-For': ''},
				}),
			),
		).toBeNull();
		expect(
			extractClientIp(
				new Request('http://example.com', {
					headers: {'X-Forwarded-For': ',192.168.1.1'},
				}),
			),
		).toBeNull();
		expect(
			extractClientIp(
				new Request('http://example.com', {
					headers: {'X-Forwarded-For': 'not-an-ip'},
				}),
			),
		).toBeNull();
	});
});

describe('extractClientIpDetails', () => {
	it('returns extracted ip and source', () => {
		const xffRequest = new Request('http://example.com', {
			headers: {'X-Forwarded-For': '192.168.1.1'},
		});

		expect(extractClientIpDetails(xffRequest)).toEqual({
			ip: '192.168.1.1',
			source: 'x-forwarded-for',
		});

		const cfRequest = new Request('http://example.com', {
			headers: {
				'Cf-Connecting-Ip': '203.0.113.50',
				'X-Forwarded-For': '192.168.1.1',
			},
		});

		expect(extractClientIpDetails(cfRequest, {trustCfConnectingIp: true})).toEqual({
			ip: '203.0.113.50',
			source: 'cf-connecting-ip',
		});
	});
});

describe('extractClientIpFromHeaders', () => {
	it('extracts from node-style headers', () => {
		const headers = {
			'x-forwarded-for': '192.168.1.1, 10.0.0.1',
		};

		expect(extractClientIpFromHeaders(headers)).toBe('192.168.1.1');
	});

	it('supports case-insensitive keys and array values', () => {
		const headers = {
			'CF-CONNECTING-IP': ['203.0.113.50'],
			'X-Forwarded-For': '192.168.1.1',
		};

		expect(extractClientIpFromHeaders(headers, {trustCfConnectingIp: true})).toBe('203.0.113.50');
		expect(extractClientIpDetailsFromHeaders(headers, {trustCfConnectingIp: true})).toEqual({
			ip: '203.0.113.50',
			source: 'cf-connecting-ip',
		});
	});

	it('returns null for invalid inputs', () => {
		expect(extractClientIpFromHeaders({})).toBeNull();
		expect(extractClientIpFromHeaders({'x-forwarded-for': 'not-an-ip'})).toBeNull();
	});
});

describe('requireClientIp', () => {
	it('returns ip when present', () => {
		const request = new Request('http://example.com', {
			headers: {'X-Forwarded-For': '192.168.1.1'},
		});

		expect(requireClientIp(request)).toBe('192.168.1.1');
	});

	it('throws typed error when missing', () => {
		const request = new Request('http://example.com');
		expect(() => requireClientIp(request)).toThrow(MissingClientIpError);
		expect(() => requireClientIp(request)).toThrow('X-Forwarded-For header is required');
	});
});
