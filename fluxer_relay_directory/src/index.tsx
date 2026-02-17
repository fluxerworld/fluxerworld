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

import {createApp} from '@app/App';
import type {BootstrapRelayConfig} from '@app/Config';
import {Config} from '@app/Config';
import {createDatabase} from '@app/database/Database';
import {Logger} from '@app/Logger';
import type {IRelayRepository, RelayInfo} from '@app/repositories/RelayRepository';
import {serve} from '@hono/node-server';

function loadBootstrapRelays(repository: IRelayRepository, bootstrapRelays: Array<BootstrapRelayConfig>): void {
	for (const bootstrapRelay of bootstrapRelays) {
		const existingRelay = repository.getRelay(bootstrapRelay.id);

		if (existingRelay) {
			Logger.debug({relay_id: bootstrapRelay.id}, 'Bootstrap relay already exists, skipping');
			continue;
		}

		const now = new Date().toISOString();
		const relayInfo: RelayInfo = {
			id: bootstrapRelay.id,
			name: bootstrapRelay.id,
			url: bootstrapRelay.url,
			latitude: bootstrapRelay.lat,
			longitude: bootstrapRelay.lon,
			region: bootstrapRelay.region,
			capacity: bootstrapRelay.capacity,
			current_connections: 0,
			public_key: bootstrapRelay.public_key ?? '',
			registered_at: now,
			last_seen_at: now,
			healthy: true,
			failed_checks: 0,
		};

		repository.saveRelay(relayInfo);
		Logger.info(
			{
				relay_id: bootstrapRelay.id,
				url: bootstrapRelay.url,
				region: bootstrapRelay.region,
			},
			'Registered bootstrap relay',
		);
	}
}

function main(): void {
	Logger.info(
		{
			host: Config.server.host,
			port: Config.server.port,
			database_path: Config.database.path,
		},
		'Starting Fluxer Relay Directory',
	);

	const db = createDatabase(Config.database.path);
	Logger.info({path: Config.database.path}, 'Database initialized');

	const {app, repository, shutdown} = createApp({
		db,
		healthCheckConfig: Config.health_check,
		logger: Logger,
	});

	if (Config.bootstrap_relays.length > 0) {
		Logger.info({count: Config.bootstrap_relays.length}, 'Loading bootstrap relays from config');
		loadBootstrapRelays(repository, Config.bootstrap_relays);
	}

	const server = serve({
		fetch: app.fetch,
		hostname: Config.server.host,
		port: Config.server.port,
	});

	Logger.info(
		{
			host: Config.server.host,
			port: Config.server.port,
		},
		'Fluxer Relay Directory listening',
	);

	function gracefulShutdown(signal: string): void {
		Logger.info({signal}, 'Received shutdown signal');

		shutdown();

		server.close(() => {
			Logger.info('HTTP server closed');
		});

		db.close();
		Logger.info('Database connection closed');

		process.exit(0);
	}

	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

main();
