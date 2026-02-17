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

import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {MessageShredRequest} from '@fluxer/schema/src/domains/admin/AdminMessageSchemas';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import type {WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';

export type MessageShredStatusCacheEntry = {
	status: 'in_progress' | 'completed' | 'failed';
	requested: number;
	total: number;
	processed: number;
	skipped: number;
	started_at?: string;
	completed_at?: string;
	failed_at?: string;
	error?: string;
};

export type MessageShredStatusResult =
	| MessageShredStatusCacheEntry
	| {
			status: 'not_found';
	  };

interface AdminMessageShredServiceDeps {
	workerService: IWorkerService;
	cacheService: ICacheService;
	snowflakeService: SnowflakeService;
	auditService: AdminAuditService;
}

interface QueueMessageShredJobPayload extends WorkerJobPayload {
	job_id: string;
	admin_user_id: string;
	target_user_id: string;
	entries: Array<{channel_id: string; message_id: string}>;
}

export class AdminMessageShredService {
	constructor(private readonly deps: AdminMessageShredServiceDeps) {}

	async queueMessageShred(
		data: MessageShredRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<{success: true; job_id: string; requested: number}> {
		return await withBusinessSpan(
			'fluxer.admin.message_shred_queue',
			'fluxer.admin.messages.shred_queued',
			{
				user_id: data.user_id.toString(),
				entry_count: data.entries.length.toString(),
			},
			async () => {
				if (data.entries.length === 0) {
					throw InputValidationError.fromCode('entries', ValidationErrorCodes.AT_LEAST_ONE_ENTRY_IS_REQUIRED);
				}

				const jobId = (await this.deps.snowflakeService.generate()).toString();
				const payload: QueueMessageShredJobPayload = {
					job_id: jobId,
					admin_user_id: adminUserId.toString(),
					target_user_id: data.user_id.toString(),
					entries: data.entries.map((entry) => ({
						channel_id: entry.channel_id.toString(),
						message_id: entry.message_id.toString(),
					})),
				};

				await this.deps.workerService.addJob('messageShred', payload, {
					jobKey: `message_shred_${data.user_id.toString()}_${jobId}`,
					maxAttempts: 1,
				});

				Logger.debug({target_user_id: data.user_id, job_id: jobId}, 'Queued message shred job');

				const metadata = new Map<string, string>([
					['user_id', data.user_id.toString()],
					['job_id', jobId],
					['requested_entries', data.entries.length.toString()],
				]);

				await this.deps.auditService.createAuditLog({
					adminUserId,
					targetType: 'message_shred',
					targetId: data.user_id,
					action: 'queue_message_shred',
					auditLogReason,
					metadata,
				});

				recordCounter({
					name: 'fluxer.admin.messages.shred_queued_count',
					value: data.entries.length,
					dimensions: {
						user_id: data.user_id.toString(),
					},
				});

				return {
					success: true,
					job_id: jobId,
					requested: data.entries.length,
				};
			},
		);
	}

	async getMessageShredStatus(jobId: string): Promise<MessageShredStatusResult> {
		const statusKey = `message_shred_status:${jobId}`;
		const status = await this.deps.cacheService.get<MessageShredStatusCacheEntry>(statusKey);

		if (!status) {
			return {
				status: 'not_found',
			};
		}

		return status;
	}
}
