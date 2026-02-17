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

import type {ChannelID, MessageID} from '@fluxer/api/src/BrandedTypes';
import {createChannelID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {withSpan} from '@fluxer/api/src/telemetry/Tracing';
import {chunkArray, createBulkDeleteDispatcher} from '@fluxer/api/src/worker/tasks/utils/MessageDeletion';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {seconds} from 'itty-time';
import {z} from 'zod';

const PayloadSchema = z.object({
	job_id: z.string().min(1),
	admin_user_id: z.string().min(1),
	target_user_id: z.string().min(1),
	entries: z.array(
		z.object({
			channel_id: z.string(),
			message_id: z.string(),
		}),
	),
});

const INPUT_SLICE_SIZE = 500;
const VALIDATION_CHUNK_SIZE = 25;
const DELETION_CHUNK_SIZE = 10;
const STATUS_TTL_SECONDS = seconds('1 hour');

const messageShredTask: WorkerTaskHandler = async (payload, helpers) => {
	const data = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: data}, 'Processing messageShred task');

	const start = Date.now();
	const targetUserIdStr = data.target_user_id;

	return await withSpan(
		{
			name: 'fluxer.worker.message_shred',
			attributes: {job_id: data.job_id, target_user_id: targetUserIdStr},
		},
		async () => {
			try {
				const {kvClient, channelRepository, gatewayService} = getWorkerDependencies();
				const progressKey = `message_shred_status:${data.job_id}`;
				const requestedEntries = data.entries.length;
				const startedAt = new Date().toISOString();

				let skippedCount = 0;
				let processedCount = 0;
				let totalValidCount = 0;

				const persistStatus = async (
					status: 'in_progress' | 'completed' | 'failed',
					extra?: {completed_at?: string; failed_at?: string; error?: string},
				) => {
					await kvClient.set(
						progressKey,
						JSON.stringify({
							status,
							requested: requestedEntries,
							total: totalValidCount,
							processed: processedCount,
							skipped: skippedCount,
							started_at: startedAt,
							...extra,
						}),
						'EX',
						STATUS_TTL_SECONDS,
					);
				};

				await persistStatus('in_progress');

				const authorId = createUserID(BigInt(data.target_user_id));
				const seen = new Set<string>();

				const bulkDeleteDispatcher = createBulkDeleteDispatcher({
					channelRepository,
					gatewayService,
					batchSize: DELETION_CHUNK_SIZE,
				});

				const processSlice = async (entriesSlice: Array<{channel_id: string; message_id: string}>) => {
					const typedSlice: Array<{channelId: ChannelID; messageId: MessageID}> = [];

					for (const entry of entriesSlice) {
						const key = `${entry.channel_id}:${entry.message_id}`;
						if (seen.has(key)) {
							skippedCount += 1;
							continue;
						}

						seen.add(key);

						try {
							typedSlice.push({
								channelId: createChannelID(BigInt(entry.channel_id)),
								messageId: createMessageID(BigInt(entry.message_id)),
							});
						} catch (error) {
							skippedCount += 1;
							helpers.logger.warn({error, entry}, 'Skipping malformed entry in message shred job');
						}
					}

					if (typedSlice.length === 0) {
						return;
					}

					for (const validationChunk of chunkArray(typedSlice, VALIDATION_CHUNK_SIZE)) {
						const existenceChecks = validationChunk.map(
							({channelId, messageId}: {channelId: ChannelID; messageId: MessageID}) =>
								channelRepository.messages.authorHasMessage(authorId, channelId, messageId),
						);

						const results = await Promise.all(existenceChecks);
						const deletableChunk: Array<{channelId: ChannelID; messageId: MessageID}> = [];

						for (let i = 0; i < validationChunk.length; i++) {
							if (results[i]) {
								deletableChunk.push(validationChunk[i]!);
							} else {
								skippedCount += 1;
							}
						}

						if (deletableChunk.length === 0) {
							await persistStatus('in_progress');
							continue;
						}

						totalValidCount += deletableChunk.length;
						await persistStatus('in_progress');

						for (const deletionChunk of chunkArray(deletableChunk, DELETION_CHUNK_SIZE)) {
							await Promise.all(
								deletionChunk.map(({channelId, messageId}: {channelId: ChannelID; messageId: MessageID}) =>
									channelRepository.deleteMessage(channelId, messageId, authorId),
								),
							);

							processedCount += deletionChunk.length;
							await persistStatus('in_progress');

							for (const {channelId, messageId} of deletionChunk) {
								bulkDeleteDispatcher.track(channelId, messageId);
							}

							await bulkDeleteDispatcher.flush(true);
						}
					}
				};

				for (const entriesSlice of chunkArray(data.entries, INPUT_SLICE_SIZE)) {
					await processSlice(entriesSlice);
				}

				await persistStatus('completed', {
					completed_at: new Date().toISOString(),
				});
				await bulkDeleteDispatcher.flush(true);

				const duration = Date.now() - start;

				recordCounter({
					name: 'fluxer.worker.messages.shred_processed',
					dimensions: {
						status: 'success',
						job_id: data.job_id,
						target_user_id: targetUserIdStr,
					},
					value: processedCount,
				});

				recordHistogram({
					name: 'fluxer.worker.message_shred.duration',
					valueMs: duration,
					dimensions: {
						job_id: data.job_id,
						target_user_id: targetUserIdStr,
					},
				});

				recordHistogram({
					name: 'fluxer.worker.message_shred.processed_count',
					valueMs: processedCount,
					dimensions: {
						target_user_id: targetUserIdStr,
					},
				});

				recordHistogram({
					name: 'fluxer.worker.message_shred.skipped_count',
					valueMs: skippedCount,
					dimensions: {
						target_user_id: targetUserIdStr,
					},
				});
			} catch (error) {
				recordCounter({
					name: 'fluxer.worker.messages.shred_processed',
					dimensions: {
						status: 'error',
						job_id: data.job_id,
						target_user_id: targetUserIdStr,
						error_type: error instanceof Error ? error.name : 'unknown',
					},
				});

				throw error;
			}
		},
	);
};

export default messageShredTask;
