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

import {ipBanCache} from '@fluxer/api/src/middleware/IpBanMiddleware';
import {beforeEach, describe, expect, it} from 'vitest';

beforeEach(() => {
	ipBanCache.resetCaches();
});

describe('IpBanCache', () => {
	it('blocks IPv4-mapped IPv6 when a single IPv4 address is banned', () => {
		ipBanCache.ban('127.0.0.1');

		expect(ipBanCache.isBanned('127.0.0.1')).toBe(true);
		expect(ipBanCache.isBanned('::ffff:7f00:1')).toBe(true);
	});

	it('blocks IPv4-mapped IPv6 when an IPv4 range is banned', () => {
		ipBanCache.ban('127.0.0.0/24');

		expect(ipBanCache.isBanned('127.0.0.5')).toBe(true);
		expect(ipBanCache.isBanned('::ffff:7f00:5')).toBe(true);
	});

	it('blocks IPv4 clients when the IPv4-mapped IPv6 range is banned', () => {
		ipBanCache.ban('::ffff:0:0/96');

		expect(ipBanCache.isBanned('::ffff:127.0.0.1')).toBe(true);
		expect(ipBanCache.isBanned('127.0.0.1')).toBe(true);
	});
});
