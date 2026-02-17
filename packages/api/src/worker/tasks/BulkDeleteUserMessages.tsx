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

import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {withSpan} from '@fluxer/api/src/telemetry/Tracing';
import {MessageDeletionService} from '@fluxer/api/src/worker/services/MessageDeletionService';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	userId: z.string(),
	scheduledAt: z.number().optional(),
});

const bulkDeleteUserMessages: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing bulkDeleteUserMessages task');

	const userId = createUserID(BigInt(validated.userId));
	const userIdStr = validated.userId;
	const start = Date.now();

	return await withSpan(
		{
			name: 'fluxer.worker.bulk_delete_user_messages',
			attributes: {user_id: userIdStr},
		},
		async () => {
			try {
				const scheduledAtMs = validated.scheduledAt ?? Number.POSITIVE_INFINITY;

				const {channelRepository, gatewayService, userRepository, storageService, purgeQueue} = getWorkerDependencies();

				const user = await userRepository.findUniqueAssert(userId);

				if (!user.pendingBulkMessageDeletionAt) {
					Logger.debug({userId}, 'User has no pending bulk message deletion, skipping (already completed)');
					return;
				}

				const deletionService = new MessageDeletionService({
					channelRepository,
					gatewayService,
					storageService,
					purgeQueue,
				});

				const totalDeleted = await deletionService.deleteUserMessagesBulk(userId, {
					beforeTimestamp: scheduledAtMs,
					onProgress: (deleted) => helpers.logger.debug(`Deleted ${deleted} messages so far`),
				});

				await userRepository.patchUpsert(
					userId,
					{
						pending_bulk_message_deletion_at: null,
						pending_bulk_message_deletion_channel_count: null,
						pending_bulk_message_deletion_message_count: null,
					},
					user.toRow(),
				);

				const duration = Date.now() - start;

				recordCounter({
					name: 'fluxer.worker.messages.bulk_deleted',
					dimensions: {
						status: 'success',
						user_id: userIdStr,
					},
				});

				recordHistogram({
					name: 'fluxer.worker.bulk_delete.duration',
					valueMs: duration,
					dimensions: {
						user_id: userIdStr,
					},
				});

				recordHistogram({
					name: 'fluxer.worker.bulk_delete.count',
					valueMs: totalDeleted,
					dimensions: {
						user_id: userIdStr,
					},
				});

				Logger.debug({userId, totalDeleted}, 'Bulk message deletion completed');
			} catch (error) {
				recordCounter({
					name: 'fluxer.worker.messages.bulk_deleted',
					dimensions: {
						status: 'error',
						user_id: userIdStr,
						error_type: error instanceof Error ? error.name : 'unknown',
					},
				});

				throw error;
			}
		},
	);
};

export default bulkDeleteUserMessages;
