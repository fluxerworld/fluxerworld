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

import type {CassandraParams, PreparedQuery} from '@fluxer/cassandra/src/CassandraTypes';
import {type Logger, NoopLogger} from '@fluxer/cassandra/src/Logger';
import cassandra from 'cassandra-driver';

export interface CassandraConfig {
	hosts: Array<string>;
	keyspace: string;
	localDc: string;
	username?: string | undefined;
	password?: string | undefined;
}

export interface CassandraClientOptions {
	logger?: Logger | undefined;
}

export interface CassandraExecuteOptions {
	prepare?: boolean | undefined;
}

export interface CassandraBatchOptions {
	prepare?: boolean | undefined;
}

export interface ICassandraClient {
	connect(): Promise<void>;
	shutdown(): Promise<void>;
	isConnected(): boolean;
	execute<P extends CassandraParams>(
		query: PreparedQuery<P>,
		options?: CassandraExecuteOptions,
	): Promise<cassandra.types.ResultSet>;
	batch(queries: Array<PreparedQuery>, options?: CassandraBatchOptions): Promise<void>;
	getNativeClient(): cassandra.Client;
	setLogger(logger: Logger): void;
}

interface DefaultClientState {
	client: CassandraClient | null;
	logger: Logger;
}

const defaultClientState: DefaultClientState = {
	client: null,
	logger: NoopLogger,
};

export class CassandraClient implements ICassandraClient {
	private readonly config: CassandraConfig;
	private logger: Logger;
	private client: cassandra.Client | null;

	public constructor(config: CassandraConfig, options: CassandraClientOptions = {}) {
		this.config = {
			hosts: [...config.hosts],
			keyspace: config.keyspace,
			localDc: config.localDc,
			username: config.username,
			password: config.password,
		};
		this.logger = options.logger ?? NoopLogger;
		this.client = null;
	}

	public async connect(): Promise<void> {
		if (this.client !== null) {
			return;
		}

		const authProvider = this.config.username
			? new cassandra.auth.PlainTextAuthProvider(this.config.username, this.config.password ?? '')
			: undefined;

		const client = new cassandra.Client({
			contactPoints: this.config.hosts,
			keyspace: this.config.keyspace,
			localDataCenter: this.config.localDc,
			encoding: {
				map: Map,
				set: Set,
				useBigIntAsLong: true,
				useBigIntAsVarint: true,
			},
			...(authProvider ? {authProvider} : {}),
		});

		await client.connect();
		this.client = client;
		this.logger.info(
			{
				hosts: this.config.hosts,
				keyspace: this.config.keyspace,
				local_dc: this.config.localDc,
			},
			'Connected to Cassandra',
		);
	}

	public async shutdown(): Promise<void> {
		if (this.client === null) {
			return;
		}

		const activeClient = this.client;
		this.client = null;
		await activeClient.shutdown();
		this.logger.info({}, 'Cassandra connection closed');
	}

	public isConnected(): boolean {
		return this.client !== null;
	}

	public async execute<P extends CassandraParams>(
		query: PreparedQuery<P>,
		options: CassandraExecuteOptions = {},
	): Promise<cassandra.types.ResultSet> {
		return this.getNativeClient().execute(query.cql, query.params, {
			prepare: options.prepare ?? true,
		});
	}

	public async batch(queries: Array<PreparedQuery>, options: CassandraBatchOptions = {}): Promise<void> {
		if (queries.length === 0) {
			return;
		}

		const batch = queries.map((query) => ({query: query.cql, params: query.params}));
		await this.getNativeClient().batch(batch, {
			prepare: options.prepare ?? true,
		});
	}

	public getNativeClient(): cassandra.Client {
		if (this.client === null) {
			throw new Error('Cassandra client is not connected. Call connect() first.');
		}

		return this.client;
	}

	public setLogger(logger: Logger): void {
		this.logger = logger;
	}
}

export function createCassandraClient(config: CassandraConfig, options: CassandraClientOptions = {}): CassandraClient {
	const logger = options.logger ?? defaultClientState.logger;
	return new CassandraClient(config, {logger});
}

export function setLogger(loggerInstance: Logger): void {
	defaultClientState.logger = loggerInstance;
	if (defaultClientState.client !== null) {
		defaultClientState.client.setLogger(loggerInstance);
	}
}

export function getLogger(): Logger {
	return defaultClientState.logger;
}

export async function initCassandra(config: CassandraConfig): Promise<void> {
	if (defaultClientState.client !== null) {
		await defaultClientState.client.shutdown();
	}

	const client = new CassandraClient(config, {logger: defaultClientState.logger});
	await client.connect();
	defaultClientState.client = client;
}

export async function shutdownCassandra(): Promise<void> {
	if (defaultClientState.client === null) {
		return;
	}

	await defaultClientState.client.shutdown();
	defaultClientState.client = null;
}

export function getDefaultCassandraClient(): ICassandraClient {
	if (defaultClientState.client === null) {
		throw new Error('Cassandra client is not initialized. Call initCassandra() first.');
	}

	return defaultClientState.client;
}

export function getClient(): cassandra.Client {
	return getDefaultCassandraClient().getNativeClient();
}
