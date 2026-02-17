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
	CassandraClient,
	type CassandraClientOptions,
	type CassandraConfig,
	type ICassandraClient,
} from '@fluxer/cassandra/src/Client';
import {type Logger, NoopLogger} from '@fluxer/cassandra/src/Logger';
import {CassandraQueryExecutor, type ICassandraQueryExecutor} from '@fluxer/cassandra/src/Queries';

export interface CassandraRuntimeOptions {
	logger?: Logger | undefined;
}

export interface ICassandraRuntime {
	client: ICassandraClient;
	queries: ICassandraQueryExecutor;
	connect(): Promise<void>;
	shutdown(): Promise<void>;
}

export class CassandraRuntime implements ICassandraRuntime {
	public readonly client: CassandraClient;
	public readonly queries: CassandraQueryExecutor;

	public constructor(config: CassandraConfig, options: CassandraRuntimeOptions = {}) {
		const logger = options.logger ?? NoopLogger;
		const clientOptions: CassandraClientOptions = {logger};
		this.client = new CassandraClient(config, clientOptions);
		this.queries = new CassandraQueryExecutor(this.client, logger);
	}

	public async connect(): Promise<void> {
		await this.client.connect();
	}

	public async shutdown(): Promise<void> {
		await this.client.shutdown();
	}
}

export function createCassandraRuntime(
	config: CassandraConfig,
	options: CassandraRuntimeOptions = {},
): CassandraRuntime {
	return new CassandraRuntime(config, options);
}
