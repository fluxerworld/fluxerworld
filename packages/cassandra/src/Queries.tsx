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

import type {ConditionalQueryResult, PreparedQuery} from '@fluxer/cassandra/src/CassandraTypes';
import type {ICassandraClient} from '@fluxer/cassandra/src/Client';
import {getDefaultCassandraClient, getLogger} from '@fluxer/cassandra/src/Client';
import {type Logger, NoopLogger} from '@fluxer/cassandra/src/Logger';

export interface ICassandraQueryExecutor {
	fetchMany<Row>(query: PreparedQuery): Promise<Array<Row>>;
	fetchOne<Row>(query: PreparedQuery): Promise<Row | null>;
	execute(query: PreparedQuery): Promise<void>;
	executeBatch(queries: Array<PreparedQuery>): Promise<void>;
	executeConditional(query: PreparedQuery): Promise<ConditionalQueryResult>;
}

export class CassandraQueryExecutor implements ICassandraQueryExecutor {
	private readonly client: ICassandraClient;
	private readonly logger: Logger;

	public constructor(client: ICassandraClient, logger: Logger = NoopLogger) {
		this.client = client;
		this.logger = logger;
	}

	public async fetchMany<Row>(query: PreparedQuery): Promise<Array<Row>> {
		const result = await this.runQuery(
			'query',
			query,
			async () => {
				return this.client.execute(query);
			},
			{},
		);

		return CassandraQueryExecutor.validateRows<Row>(result.rows);
	}

	public async fetchOne<Row>(query: PreparedQuery): Promise<Row | null> {
		const rows = await this.fetchMany<Row>(query);
		return rows[0] ?? null;
	}

	public async execute(query: PreparedQuery): Promise<void> {
		await this.runQuery(
			'execute',
			query,
			async () => {
				await this.client.execute(query);
			},
			{},
		);
	}

	public async executeBatch(queries: Array<PreparedQuery>): Promise<void> {
		if (queries.length === 0) {
			return;
		}

		const start = Date.now();
		try {
			await this.client.batch(queries);
			const durationMs = Date.now() - start;
			this.logger.debug(
				{
					query_count: queries.length,
					duration_ms: durationMs,
				},
				'batch execute',
			);
		} catch (error) {
			const durationMs = Date.now() - start;
			this.logger.error(
				{
					query_count: queries.length,
					duration_ms: durationMs,
					error,
				},
				'batch execute error',
			);
			throw error;
		}
	}

	public async executeConditional(query: PreparedQuery): Promise<ConditionalQueryResult> {
		const result = await this.runQuery(
			'conditional',
			query,
			async () => {
				return this.client.execute(query);
			},
			{},
		);

		const applied = result.rows[0]?.['[applied]'] !== false;
		return {applied};
	}

	private async runQuery<T>(
		action: string,
		query: PreparedQuery,
		runner: () => Promise<T>,
		context: Record<string, unknown>,
	): Promise<T> {
		const start = Date.now();
		try {
			const result = await runner();
			const durationMs = Date.now() - start;
			this.logger.debug(
				{
					action,
					cql: query.cql,
					params: query.params,
					duration_ms: durationMs,
					...context,
				},
				'action success',
			);
			return result;
		} catch (error) {
			const durationMs = Date.now() - start;
			this.logger.error(
				{
					action,
					cql: query.cql,
					params: query.params,
					duration_ms: durationMs,
					error,
				},
				'action error',
			);
			throw error;
		}
	}

	private static validateRows<Row>(rows: unknown): Array<Row> {
		if (!Array.isArray(rows)) {
			throw new Error('Expected Cassandra row array result');
		}

		for (const row of rows) {
			if (row === null || typeof row !== 'object') {
				throw new Error('Expected Cassandra rows to contain objects');
			}
		}

		return rows as Array<Row>;
	}
}

function createDefaultQueryExecutor(): CassandraQueryExecutor {
	return new CassandraQueryExecutor(getDefaultCassandraClient(), getLogger());
}

export async function fetchMany<Row>(query: PreparedQuery): Promise<Array<Row>> {
	return createDefaultQueryExecutor().fetchMany<Row>(query);
}

export async function fetchOne<Row>(query: PreparedQuery): Promise<Row | null> {
	return createDefaultQueryExecutor().fetchOne<Row>(query);
}

export async function execute(query: PreparedQuery): Promise<void> {
	await createDefaultQueryExecutor().execute(query);
}

export async function executeBatch(queries: Array<PreparedQuery>): Promise<void> {
	await createDefaultQueryExecutor().executeBatch(queries);
}

export async function executeConditional(query: PreparedQuery): Promise<ConditionalQueryResult> {
	return createDefaultQueryExecutor().executeConditional(query);
}
