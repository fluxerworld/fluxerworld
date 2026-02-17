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

import {formatRfc3339Timestamp, parseRfc3339TimestampToMs} from '@fluxer/time/src/Rfc3339Timestamp';
import {describe, expect, it} from 'vitest';

describe('parseRfc3339TimestampToMs', () => {
	it('parses a valid timestamp', () => {
		const timestamp = '2024-06-15T12:30:45.000Z';
		const result = parseRfc3339TimestampToMs(timestamp);
		expect(result).toBe(new Date(timestamp).getTime());
	});

	it('parses timestamps with timezone offsets', () => {
		const timestamp = '2024-06-15T12:30:45+05:30';
		const result = parseRfc3339TimestampToMs(timestamp);
		expect(result).toBe(new Date(timestamp).getTime());
	});

	it('throws for invalid timestamps', () => {
		expect(() => parseRfc3339TimestampToMs('not-a-date')).toThrow('Invalid RFC3339 timestamp: not-a-date');
	});
});

describe('formatRfc3339Timestamp', () => {
	it('formats milliseconds as RFC3339', () => {
		expect(formatRfc3339Timestamp(1718454645000)).toBe('2024-06-15T12:30:45.000Z');
	});

	it('preserves millisecond precision', () => {
		expect(formatRfc3339Timestamp(1718454645123)).toBe('2024-06-15T12:30:45.123Z');
	});

	it('throws for non-finite inputs', () => {
		expect(() => formatRfc3339Timestamp(Number.NaN)).toThrow('Invalid timestamp milliseconds: NaN');
	});

	it('roundtrips with parser', () => {
		const originalTimestampMs = 1718451045500;
		const timestamp = formatRfc3339Timestamp(originalTimestampMs);
		const parsedTimestampMs = parseRfc3339TimestampToMs(timestamp);

		expect(parsedTimestampMs).toBe(originalTimestampMs);
	});
});
