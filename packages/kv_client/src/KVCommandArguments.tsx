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

import {KVClientError, KVClientErrorCode} from '@fluxer/kv_client/src/KVClientError';

export interface KVSetOptions {
	ttlSeconds?: number;
	useNx: boolean;
}

export interface KVRangeByScoreOptions {
	limit?: {
		offset: number;
		count: number;
	};
}

export function parseSetArguments(args: Array<string | number>): KVSetOptions {
	let ttlSeconds: number | undefined;
	let useNx = false;
	let index = 0;

	while (index < args.length) {
		const current = args[index];
		const flag = typeof current === 'string' ? current.toUpperCase() : null;

		if (flag === 'EX') {
			if (ttlSeconds !== undefined) {
				throw createInvalidArgumentError('set supports EX only once');
			}

			ttlSeconds = parseNumberArgument(args[index + 1], 'EX value');
			index += 2;
			continue;
		}

		if (flag === 'NX') {
			if (useNx) {
				throw createInvalidArgumentError('set supports NX only once');
			}

			useNx = true;
			index += 1;
			continue;
		}

		throw createInvalidArgumentError(`set received unsupported argument: ${String(current)}`);
	}

	return {
		ttlSeconds,
		useNx,
	};
}

export function createStringEntriesFromPairs(args: Array<string>): Array<{key: string; value: string}> {
	if (args.length % 2 !== 0) {
		throw createInvalidArgumentError('mset requires key/value pairs');
	}

	const entries: Array<{key: string; value: string}> = [];
	for (let index = 0; index < args.length; index += 2) {
		entries.push({
			key: args[index],
			value: args[index + 1],
		});
	}

	return entries;
}

export function createZSetMembersFromScorePairs(
	scoreMembers: Array<number | string>,
): Array<{score: number; value: string}> {
	if (scoreMembers.length % 2 !== 0) {
		throw createInvalidArgumentError('zadd requires score/member pairs');
	}

	const members: Array<{score: number; value: string}> = [];
	for (let index = 0; index < scoreMembers.length; index += 2) {
		const rawScore = scoreMembers[index];
		const rawMember = scoreMembers[index + 1];

		if (typeof rawMember !== 'string') {
			throw createInvalidArgumentError('zadd member must be a string');
		}

		members.push({
			score: parseFiniteNumber(rawScore, 'zadd score'),
			value: rawMember,
		});
	}

	return members;
}

export function normalizeScoreBound(score: string | number): string | number {
	if (score === '-inf' || score === '+inf') {
		return score;
	}

	return parseNumberArgument(score, 'score');
}

export function parseRangeByScoreArguments(args: Array<string | number>): KVRangeByScoreOptions {
	let index = 0;
	let limit: {offset: number; count: number} | undefined;

	while (index < args.length) {
		const token = args[index];
		const keyword = typeof token === 'string' ? token.toUpperCase() : null;

		if (keyword === 'LIMIT') {
			if (limit) {
				throw createInvalidArgumentError('zrangebyscore supports LIMIT only once');
			}

			const offset = parseNonNegativeInteger(args[index + 1], 'LIMIT offset');
			const count = parseNonNegativeInteger(args[index + 2], 'LIMIT count');
			limit = {offset, count};
			index += 3;
			continue;
		}

		throw createInvalidArgumentError(`zrangebyscore received unsupported argument: ${String(token)}`);
	}

	return {limit};
}

function parseNumberArgument(value: string | number | undefined, label: string): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	throw createInvalidArgumentError(`${label} must be a finite number`);
}

function parseFiniteNumber(value: string | number, label: string): number {
	const parsed = parseNumberArgument(value, label);
	if (!Number.isFinite(parsed)) {
		throw createInvalidArgumentError(`${label} must be finite`);
	}

	return parsed;
}

function parseNonNegativeInteger(value: string | number | undefined, label: string): number {
	const parsed = parseNumberArgument(value, label);

	if (!Number.isInteger(parsed) || parsed < 0) {
		throw createInvalidArgumentError(`${label} must be a non-negative integer`);
	}

	return parsed;
}

function createInvalidArgumentError(message: string): KVClientError {
	return new KVClientError({
		code: KVClientErrorCode.INVALID_ARGUMENT,
		message,
	});
}
