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

import {Config} from '@app/Config';
import {shutdownInstrumentation} from '@app/Instrument';
import {Logger} from '@app/Logger';
import {createAPIApp} from '@fluxer/api/src/App';
import {initializeConfig} from '@fluxer/api/src/Config';
import {initializeLogger} from '@fluxer/api/src/Logger';
import {isTelemetryActive} from '@fluxer/api/src/Telemetry';
import {createServer, setupGracefulShutdown} from '@fluxer/hono/src/Server';
import {setUser} from '@fluxer/sentry/src/Sentry';

async function main(): Promise<void> {
	initializeConfig(Config);
	initializeLogger(Logger);

	const {app, initialize, shutdown} = await createAPIApp({
		config: Config,
		logger: Logger,
		setSentryUser: setUser,
		isTelemetryActive,
	});

	await initialize();

	process.on('uncaughtException', (error) => {
		Logger.fatal({error}, 'Uncaught exception');
		process.exit(1);
	});

	process.on('unhandledRejection', (reason) => {
		Logger.fatal({reason}, 'Unhandled rejection');
		process.exit(1);
	});

	const server = createServer(app, {port: Config.port});

	Logger.info({port: Config.port}, `Starting Fluxer API on port ${Config.port}`);

	setupGracefulShutdown(
		async () => {
			await shutdownInstrumentation();
			await shutdown();
			await new Promise<void>((resolve) => {
				server.close(() => resolve());
			});
		},
		{logger: Logger, timeoutMs: 30000},
	);
}

main().catch((err) => {
	Logger.fatal({error: err}, 'Failed to start Fluxer API');
	process.exit(1);
});
