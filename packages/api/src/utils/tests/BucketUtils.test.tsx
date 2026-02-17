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

import {FLUXER_EPOCH} from '@fluxer/constants/src/Core';
import {makeBucket, makeBuckets} from '@fluxer/snowflake/src/SnowflakeBuckets';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

function createSnowflake(timestamp: number): bigint {
	const relativeTimestamp = timestamp - FLUXER_EPOCH;
	return BigInt(relativeTimestamp) << 22n;
}

describe('makeBucket', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns bucket 0 for snowflake at epoch', () => {
		const snowflake = createSnowflake(FLUXER_EPOCH);
		expect(makeBucket(snowflake)).toBe(0);
	});

	it('returns bucket 0 for snowflake within first 10 days', () => {
		const snowflake = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS - 1);
		expect(makeBucket(snowflake)).toBe(0);
	});

	it('returns bucket 1 for snowflake at exactly 10 days', () => {
		const snowflake = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS);
		expect(makeBucket(snowflake)).toBe(1);
	});

	it('returns bucket 2 for snowflake at 20 days', () => {
		const snowflake = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 2);
		expect(makeBucket(snowflake)).toBe(2);
	});

	it('returns current bucket for null snowflake', () => {
		const now = FLUXER_EPOCH + TEN_DAYS_MS * 5 + 1000;
		vi.setSystemTime(now);
		expect(makeBucket(null)).toBe(5);
	});

	it('handles snowflakes far in the future', () => {
		const futureSnowflake = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 1000);
		expect(makeBucket(futureSnowflake)).toBe(1000);
	});

	it('handles minimum snowflake value', () => {
		const minSnowflake = 0n << 22n;
		expect(makeBucket(minSnowflake)).toBe(0);
	});
});

describe('makeBuckets', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns single bucket when start equals end', () => {
		const snowflake = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS);
		expect(makeBuckets(snowflake, snowflake)).toEqual([1]);
	});

	it('returns range of buckets from start to end', () => {
		const start = createSnowflake(FLUXER_EPOCH);
		const end = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 2);
		expect(makeBuckets(start, end)).toEqual([0, 1, 2]);
	});

	it('returns buckets from start to current when end is null', () => {
		const now = FLUXER_EPOCH + TEN_DAYS_MS * 3 + 1000;
		vi.setSystemTime(now);
		const start = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS);
		expect(makeBuckets(start, null)).toEqual([1, 2, 3]);
	});

	it('returns buckets from current to end when start is null', () => {
		const now = FLUXER_EPOCH + TEN_DAYS_MS + 1000;
		vi.setSystemTime(now);
		const end = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 3);
		expect(makeBuckets(null, end)).toEqual([1, 2, 3]);
	});

	it('handles both null (current bucket only)', () => {
		const now = FLUXER_EPOCH + TEN_DAYS_MS * 5 + 1000;
		vi.setSystemTime(now);
		expect(makeBuckets(null, null)).toEqual([5]);
	});

	it('returns many buckets for large time range', () => {
		const start = createSnowflake(FLUXER_EPOCH);
		const end = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 9);
		const buckets = makeBuckets(start, end);
		expect(buckets).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		expect(buckets.length).toBe(10);
	});

	it('handles snowflakes within same bucket', () => {
		const start = createSnowflake(FLUXER_EPOCH + 1000);
		const end = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS - 1000);
		expect(makeBuckets(start, end)).toEqual([0]);
	});

	it('returns ordered buckets from low to high', () => {
		const start = createSnowflake(FLUXER_EPOCH);
		const end = createSnowflake(FLUXER_EPOCH + TEN_DAYS_MS * 5);
		const buckets = makeBuckets(start, end);
		for (let i = 1; i < buckets.length; i++) {
			expect(buckets[i]).toBeGreaterThan(buckets[i - 1]);
		}
	});
});
