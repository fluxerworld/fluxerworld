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
	ackJob,
	changeVisibility,
	deleteJob,
	dequeueJobs,
	enqueueJob,
	getMetrics,
	getStats,
	healthCheck,
	nackJob,
	retryJob,
	upsertCron,
} from '@fluxer/queue/src/api/Handlers';
import type {AppEnv} from '@fluxer/queue/src/api/QueueApiTypes';
import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';

const MAX_BODY_SIZE = 1024 * 1024;

export function createRoutes(): Hono<AppEnv> {
	const app = new Hono<AppEnv>();

	app.use(
		'*',
		bodyLimit({
			maxSize: MAX_BODY_SIZE,
			onError: (c) => c.text('Error: request body too large', 413),
		}),
	);

	app.get('/_health', healthCheck);

	app.post('/enqueue', enqueueJob);
	app.get('/dequeue', dequeueJobs);
	app.post('/ack', ackJob);
	app.post('/nack', nackJob);
	app.post('/visibility', changeVisibility);

	app.post('/cron', upsertCron);

	app.post('/retry/:job_id', retryJob);
	app.delete('/job/:job_id', deleteJob);

	app.get('/stats', getStats);
	app.get('/metrics', getMetrics);

	return app;
}
