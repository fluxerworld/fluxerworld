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

import {FLUXER_EPOCH, TIMESTAMP_SHIFT} from '@fluxer/snowflake/src/Snowflake';
import {ms} from 'itty-time';

export const SNOWFLAKE_BUCKET_SIZE_MS = BigInt(ms('10 days'));

function getRelativeTimestampForBucket(snowflake: bigint | null): bigint {
	if (snowflake == null) {
		return BigInt(Date.now()) - FLUXER_EPOCH;
	}

	return snowflake >> TIMESTAMP_SHIFT;
}

function createBucketRange(startBucket: number, endBucket: number): Array<number> {
	if (endBucket < startBucket) {
		return [];
	}

	const size = endBucket - startBucket + 1;
	const range = new Array<number>(size);

	for (let index = 0; index < size; index += 1) {
		range[index] = startBucket + index;
	}

	return range;
}

export function makeBucket(snowflake: bigint | null): number {
	const timestamp = getRelativeTimestampForBucket(snowflake);
	return Math.floor(Number(timestamp / SNOWFLAKE_BUCKET_SIZE_MS));
}

export function makeBucketString(snowflake: string | null): number {
	if (snowflake == null) {
		return makeBucket(null);
	}

	return makeBucket(BigInt(snowflake));
}

export function makeBuckets(startId: bigint | null, endId: bigint | null = null): Array<number> {
	const startBucket = makeBucket(startId);
	const endBucket = makeBucket(endId);
	return createBucketRange(startBucket, endBucket);
}

export function makeBucketsString(startId: string | null, endId: string | null = null): Array<number> {
	const startBigInt = startId != null ? BigInt(startId) : null;
	const endBigInt = endId != null ? BigInt(endId) : null;
	return makeBuckets(startBigInt, endBigInt);
}
