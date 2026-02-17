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

import {withSpan} from '@fluxer/api/src/telemetry/Tracing';
import {
	ScheduledMessageExecutor,
	type SendScheduledMessageParams,
} from '@fluxer/api/src/worker/executors/ScheduledMessageExecutor';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import type {WorkerTaskHelpers} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	userId: z.string(),
	scheduledMessageId: z.string(),
	expectedScheduledAt: z.string(),
});

export async function sendScheduledMessage(payload: unknown, helpers: WorkerTaskHelpers): Promise<void> {
	const validated = PayloadSchema.parse(payload) as SendScheduledMessageParams;
	const start = Date.now();

	try {
		const result = await withSpan(
			{
				name: 'fluxer.message.scheduled.execute',
				attributes: {
					user_id: validated.userId,
					scheduled_message_id: validated.scheduledMessageId,
				},
			},
			async () => {
				const deps = getWorkerDependencies();
				const executor = new ScheduledMessageExecutor(deps, helpers.logger);
				return await executor.execute(validated);
			},
		);

		recordCounter({
			name: 'fluxer.messages.scheduled_executed',
			dimensions: {status: 'success'},
			value: 1,
		});

		recordHistogram({
			name: 'fluxer.message.scheduled_execution.latency',
			valueMs: Date.now() - start,
		});

		return result;
	} catch (error) {
		recordCounter({
			name: 'fluxer.messages.scheduled_executed',
			dimensions: {
				status: 'error',
				error_type: error instanceof Error ? error.name : 'unknown',
			},
			value: 1,
		});

		recordHistogram({
			name: 'fluxer.message.scheduled_execution.latency',
			valueMs: Date.now() - start,
		});

		throw error;
	}
}
