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

import type {IKVPipeline} from '@fluxer/kv_client/src/IKVProvider';
import {createStringEntriesFromPairs} from '@fluxer/kv_client/src/KVCommandArguments';
import type {ChainableCommander} from 'ioredis';

type PipelineExecResult = [Error | null, unknown];

interface KVPipelineOptions {
	createCommander: () => ChainableCommander;
	normalizeError: (command: string, error: unknown) => Error;
	mode: 'pipeline' | 'multi';
}

export class KVPipeline implements IKVPipeline {
	private readonly createCommander: () => ChainableCommander;
	private readonly normalizeError: (command: string, error: unknown) => Error;
	private readonly mode: 'pipeline' | 'multi';
	private commander: ChainableCommander;

	constructor(options: KVPipelineOptions) {
		this.createCommander = options.createCommander;
		this.normalizeError = options.normalizeError;
		this.mode = options.mode;
		this.commander = options.createCommander();
	}

	get(key: string): this {
		this.commander.get(key);
		return this;
	}

	set(key: string, value: string): this {
		this.commander.set(key, value);
		return this;
	}

	setex(key: string, ttlSeconds: number, value: string): this {
		this.commander.setex(key, ttlSeconds, value);
		return this;
	}

	del(key: string): this {
		this.commander.del(key);
		return this;
	}

	expire(key: string, ttlSeconds: number): this {
		this.commander.expire(key, ttlSeconds);
		return this;
	}

	sadd(key: string, ...members: Array<string>): this {
		this.commander.sadd(key, ...members);
		return this;
	}

	srem(key: string, ...members: Array<string>): this {
		this.commander.srem(key, ...members);
		return this;
	}

	zadd(key: string, score: number, value: string): this {
		this.commander.zadd(key, score, value);
		return this;
	}

	zrem(key: string, ...members: Array<string>): this {
		this.commander.zrem(key, ...members);
		return this;
	}

	mset(...args: Array<string>): this {
		const entries = createStringEntriesFromPairs(args);
		if (entries.length === 0) {
			return this;
		}
		const pairs = entries.flatMap((entry) => [entry.key, entry.value]);
		this.commander.mset(...pairs);
		return this;
	}

	async exec(): Promise<Array<PipelineExecResult>> {
		const command = `${this.mode}.exec`;
		try {
			const rawResults = (await this.commander.exec()) as Array<PipelineExecResult> | null;
			this.commander = this.createCommander();

			if (rawResults === null) {
				return [];
			}

			return rawResults.map((result: PipelineExecResult) => {
				const [error, value] = result;
				return [error ? normalizePipelineError(error) : null, value] as PipelineExecResult;
			});
		} catch (error) {
			this.commander = this.createCommander();
			throw this.normalizeError(command, error);
		}
	}
}

function normalizePipelineError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
}
