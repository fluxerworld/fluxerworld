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

import type {DatabaseSync} from 'node:sqlite';
import {RelayController} from '@app/controllers/RelayController';
import type {RelayDirectoryEnv} from '@app/middleware/ServiceMiddleware';
import {initializeServices, ServiceMiddleware} from '@app/middleware/ServiceMiddleware';
import type {IRelayRepository} from '@app/repositories/RelayRepository';
import type {HealthCheckConfig} from '@app/services/HealthCheckService';
import {HealthCheckService} from '@app/services/HealthCheckService';
import {applyMiddlewareStack} from '@fluxer/hono/src/middleware/MiddlewareStack';
import {Hono} from 'hono';
import type {Logger} from 'pino';

export interface AppDependencies {
	db: DatabaseSync;
	healthCheckConfig: HealthCheckConfig;
	logger: Logger;
}

export interface AppResult {
	app: Hono<RelayDirectoryEnv>;
	healthCheckService: HealthCheckService;
	repository: IRelayRepository;
	shutdown: () => void;
}

export function createApp(deps: AppDependencies): AppResult {
	const {db, healthCheckConfig, logger} = deps;

	const {repository} = initializeServices({db});

	const healthCheckService = new HealthCheckService(repository, healthCheckConfig, logger);

	const app = new Hono<RelayDirectoryEnv>({strict: true});

	applyMiddlewareStack(app, {
		requestId: {},
		logger: {
			log: (data) => {
				logger.info(
					{
						method: data.method,
						path: data.path,
						status: data.status,
						durationMs: data.durationMs,
					},
					'Request completed',
				);
			},
			skip: ['/_health'],
		},
	});

	app.use('*', ServiceMiddleware);

	app.onError((err, ctx) => {
		logger.error({error: err, path: ctx.req.path}, 'Request error');
		return ctx.json({error: 'Internal server error', code: 'INTERNAL_ERROR'}, 500);
	});

	RelayController(app);

	healthCheckService.start();

	function shutdown(): void {
		healthCheckService.stop();
	}

	return {app, healthCheckService, repository, shutdown};
}
