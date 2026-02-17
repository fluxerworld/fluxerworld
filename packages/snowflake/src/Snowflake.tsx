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

import {FLUXER_EPOCH as FLUXER_EPOCH_NUMBER} from '@fluxer/constants/src/Core';

export const FLUXER_EPOCH = BigInt(FLUXER_EPOCH_NUMBER);

export const WORKER_ID_BITS = 10n;
export const SEQUENCE_BITS = 12n;

const WORKER_ID_SHIFT = SEQUENCE_BITS;

export const TIMESTAMP_SHIFT = WORKER_ID_BITS + SEQUENCE_BITS;

export const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n;
export const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const MAX_FUTURE_DRIFT_MS = 86400000;

export interface SnowflakeGeneratorOptions {
	workerId?: number;
	now?: () => number;
}

export interface CreateSnowflakeOptions {
	timestamp: number | bigint;
	workerId?: number;
	sequence?: number;
}

export interface SnowflakeParts {
	timestamp: Date;
	workerId: number;
	sequence: number;
}

interface SnowflakeBitParts {
	relativeTimestamp: bigint;
	workerId: bigint;
	sequence: bigint;
}

interface ResolvedSnowflakeGeneratorOptions {
	workerId: number;
	now: () => number;
}

function resolveSnowflakeGeneratorOptions(
	workerIdOrOptions: number | SnowflakeGeneratorOptions | undefined,
): ResolvedSnowflakeGeneratorOptions {
	if (typeof workerIdOrOptions === 'number') {
		return {
			workerId: workerIdOrOptions,
			now: Date.now,
		};
	}

	if (workerIdOrOptions == null) {
		return {
			workerId: 0,
			now: Date.now,
		};
	}

	return {
		workerId: workerIdOrOptions.workerId ?? 0,
		now: workerIdOrOptions.now ?? Date.now,
	};
}

function assertValidWorkerId(workerId: number): bigint {
	if (!Number.isInteger(workerId)) {
		throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
	}

	const workerIdBigInt = BigInt(workerId);
	if (workerIdBigInt < 0n || workerIdBigInt > MAX_WORKER_ID) {
		throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
	}

	return workerIdBigInt;
}

function assertValidSequence(sequence: number): bigint {
	if (!Number.isInteger(sequence)) {
		throw new Error(`Sequence must be between 0 and ${MAX_SEQUENCE}`);
	}

	const sequenceBigInt = BigInt(sequence);
	if (sequenceBigInt < 0n || sequenceBigInt > MAX_SEQUENCE) {
		throw new Error(`Sequence must be between 0 and ${MAX_SEQUENCE}`);
	}

	return sequenceBigInt;
}

function toRelativeTimestamp(timestamp: number | bigint): bigint {
	const timestampBigInt = BigInt(timestamp);
	const relativeTimestamp = timestampBigInt - FLUXER_EPOCH;

	if (relativeTimestamp < 0n) {
		throw new Error('Timestamp must be on or after the Fluxer epoch');
	}

	return relativeTimestamp;
}

function toEpochTimestamp(relativeTimestamp: bigint): bigint {
	return relativeTimestamp + FLUXER_EPOCH;
}

function toSnowflakeBitParts(snowflake: bigint): SnowflakeBitParts {
	return {
		relativeTimestamp: snowflake >> TIMESTAMP_SHIFT,
		workerId: (snowflake >> WORKER_ID_SHIFT) & MAX_WORKER_ID,
		sequence: snowflake & MAX_SEQUENCE,
	};
}

function createSnowflakeBigInt(relativeTimestamp: bigint, workerId: bigint, sequence: bigint): bigint {
	return (relativeTimestamp << TIMESTAMP_SHIFT) | (workerId << WORKER_ID_SHIFT) | sequence;
}

function getTimestampFromNow(now: () => number): bigint {
	return BigInt(now()) - FLUXER_EPOCH;
}

export class SnowflakeGenerator {
	private readonly workerId: bigint;
	private readonly now: () => number;
	private sequence: bigint = 0n;
	private lastTimestamp: bigint = -1n;

	constructor(workerIdOrOptions: number | SnowflakeGeneratorOptions = 0) {
		const options = resolveSnowflakeGeneratorOptions(workerIdOrOptions);
		this.workerId = assertValidWorkerId(options.workerId);
		this.now = options.now;
	}

	generate(): bigint {
		let timestamp = getTimestampFromNow(this.now);

		if (timestamp < this.lastTimestamp) {
			timestamp = this.lastTimestamp;
		}

		if (timestamp === this.lastTimestamp) {
			this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
			if (this.sequence === 0n) {
				timestamp = this.waitUntilNextTimestamp();
			}
		} else {
			this.sequence = 0n;
		}

		this.lastTimestamp = timestamp;
		return createSnowflakeBigInt(timestamp, this.workerId, this.sequence);
	}

	getWorkerId(): number {
		return Number(this.workerId);
	}

	private waitUntilNextTimestamp(): bigint {
		let timestamp = getTimestampFromNow(this.now);
		while (timestamp <= this.lastTimestamp) {
			timestamp = getTimestampFromNow(this.now);
		}
		return timestamp;
	}
}

let defaultGenerator: SnowflakeGenerator | null = null;

export function createSnowflakeGenerator(options: SnowflakeGeneratorOptions = {}): SnowflakeGenerator {
	return new SnowflakeGenerator(options);
}

export function setDefaultSnowflakeGenerator(options: SnowflakeGeneratorOptions = {}): void {
	defaultGenerator = createSnowflakeGenerator(options);
}

export function resetDefaultSnowflakeGenerator(): void {
	defaultGenerator = null;
}

export function generateSnowflake(workerIdOrOptions?: number | SnowflakeGeneratorOptions): bigint {
	if (workerIdOrOptions !== undefined) {
		return new SnowflakeGenerator(workerIdOrOptions).generate();
	}

	if (!defaultGenerator) {
		defaultGenerator = createSnowflakeGenerator();
	}

	return defaultGenerator.generate();
}

export function createSnowflake(options: CreateSnowflakeOptions): bigint {
	const workerId = assertValidWorkerId(options.workerId ?? 0);
	const sequence = assertValidSequence(options.sequence ?? 0);
	const relativeTimestamp = toRelativeTimestamp(options.timestamp);
	return createSnowflakeBigInt(relativeTimestamp, workerId, sequence);
}

export function createSnowflakeFromTimestamp(timestamp: number | bigint, workerId = 0): bigint {
	return createSnowflake({timestamp, workerId});
}

export function snowflakeToDate(snowflake: bigint): Date {
	const bitParts = toSnowflakeBitParts(snowflake);
	return new Date(Number(toEpochTimestamp(bitParts.relativeTimestamp)));
}

export function parseSnowflake(snowflake: bigint): SnowflakeParts {
	const bitParts = toSnowflakeBitParts(snowflake);

	return {
		timestamp: new Date(Number(toEpochTimestamp(bitParts.relativeTimestamp))),
		workerId: Number(bitParts.workerId),
		sequence: Number(bitParts.sequence),
	};
}

export function isValidSnowflake(value: unknown): value is bigint {
	if (typeof value !== 'bigint') {
		return false;
	}

	if (value < 0n) {
		return false;
	}

	const bitParts = toSnowflakeBitParts(value);
	const timestamp = toEpochTimestamp(bitParts.relativeTimestamp);
	const timestampNumber = Number(timestamp);

	if (timestampNumber < Number(FLUXER_EPOCH)) {
		return false;
	}

	if (timestampNumber > Date.now() + MAX_FUTURE_DRIFT_MS) {
		return false;
	}

	return true;
}
