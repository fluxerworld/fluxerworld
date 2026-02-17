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

import type {SystemDmJobRepository} from '@fluxer/api/src/admin/repositories/SystemDmJobRepository';
import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import {createGuildID, type GuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {SystemDmJobRow} from '@fluxer/api/src/database/types/SystemDmJobTypes';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import {getUserSearchService} from '@fluxer/api/src/SearchFactory';
import {collectSystemDmTargets, type SystemDmTargetFilters} from '@fluxer/api/src/system_dm/TargetFinder';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {SystemDmJobResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

const JOB_TYPE = 'system_dm';
const JOB_KEY_PREFIX = 'system_dm_job_';

interface CreateJobInput {
	content: string;
	registrationStart?: Date;
	registrationEnd?: Date;
	excludedGuildIds: Array<GuildID>;
}

export class SystemDmService {
	constructor(
		private readonly userRepository: IUserRepository,
		private readonly jobRepository: SystemDmJobRepository,
		private readonly auditService: AdminAuditService,
		private readonly workerService: IWorkerService,
		private readonly snowflakeService: SnowflakeService,
	) {}

	private ensureSearchService() {
		const service = getUserSearchService();
		if (!service) {
			throw new Error('Search service is not enabled');
		}
		return service;
	}

	async createJob(
		data: CreateJobInput,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<SystemDmJobResponse> {
		const searchService = this.ensureSearchService();
		const targets = await collectSystemDmTargets(
			{userRepository: this.userRepository, userSearchService: searchService},
			{
				registrationStart: data.registrationStart,
				registrationEnd: data.registrationEnd,
				excludedGuildIds: new Set(data.excludedGuildIds),
			},
		);

		const now = new Date();
		const jobId = await this.snowflakeService.generate();

		const job: SystemDmJobRow = {
			job_type: JOB_TYPE,
			job_id: jobId,
			admin_user_id: adminUserId,
			status: 'pending',
			content: data.content,
			registration_start: data.registrationStart ?? null,
			registration_end: data.registrationEnd ?? null,
			excluded_guild_ids: new Set(data.excludedGuildIds.map((id) => id.toString())),
			target_count: targets.length,
			sent_count: 0,
			failed_count: 0,
			last_error: null,
			worker_job_key: null,
			created_at: now,
			updated_at: now,
			approved_by: null,
			approved_at: null,
		};

		await this.jobRepository.createJob(job);

		const metadata = new Map<string, string>([
			['target_count', targets.length.toString()],
			['content_length', data.content.length.toString()],
		]);
		if (data.registrationStart) {
			metadata.set('registration_start', data.registrationStart.toISOString());
		}
		if (data.registrationEnd) {
			metadata.set('registration_end', data.registrationEnd.toISOString());
		}
		if (data.excludedGuildIds.length > 0) {
			metadata.set('excluded_guild_ids', data.excludedGuildIds.map((id) => id.toString()).join(','));
		}

		await this.auditService.createAuditLog({
			adminUserId,
			targetType: 'system_dm_job',
			targetId: jobId,
			action: 'system_dm_job.create',
			auditLogReason,
			metadata,
		});

		return this.toResponse(job);
	}

	async listJobs(
		limit: number,
		beforeJobId?: bigint,
	): Promise<{jobs: Array<SystemDmJobResponse>; next_cursor: string | null}> {
		const jobs = await this.jobRepository.listJobs(limit, beforeJobId);
		const responses = jobs.map((job) => this.toResponse(job));
		const nextCursor =
			jobs.length === limit && jobs[jobs.length - 1].job_id ? jobs[jobs.length - 1].job_id.toString() : null;
		return {jobs: responses, next_cursor: nextCursor};
	}

	async getJob(jobId: bigint): Promise<SystemDmJobResponse | null> {
		const job = await this.jobRepository.getJob(jobId);
		return job ? this.toResponse(job) : null;
	}

	async approveJob(jobId: bigint, adminUserId: UserID, auditLogReason: string | null): Promise<SystemDmJobResponse> {
		const job = await this.jobRepository.getJob(jobId);
		if (!job) {
			throw InputValidationError.fromCode('job_id', ValidationErrorCodes.JOB_NOT_FOUND);
		}
		if (job.status !== 'pending') {
			throw InputValidationError.fromCode('job_id', ValidationErrorCodes.JOB_IS_ALREADY_PROCESSED);
		}

		const searchService = this.ensureSearchService();
		const filters: SystemDmTargetFilters = {
			registrationStart: job.registration_start ?? undefined,
			registrationEnd: job.registration_end ?? undefined,
			excludedGuildIds: this.convertExcludedGuildIds(job.excluded_guild_ids),
		};
		const targets = await collectSystemDmTargets(
			{
				userRepository: this.userRepository,
				userSearchService: searchService,
			},
			filters,
		);

		const now = new Date();
		const jobKey = JOB_KEY_PREFIX + jobId.toString();

		await this.jobRepository.patchJob(jobId, {
			status: 'approved',
			approved_by: adminUserId,
			approved_at: now,
			target_count: targets.length,
			worker_job_key: jobKey,
			updated_at: now,
		});

		const metadata = new Map<string, string>([
			['target_count', targets.length.toString()],
			['worker_job_key', jobKey],
		]);
		if (job.excluded_guild_ids && job.excluded_guild_ids.size > 0) {
			metadata.set('excluded_guild_ids', Array.from(job.excluded_guild_ids).join(','));
		}

		await this.auditService.createAuditLog({
			adminUserId,
			targetType: 'system_dm_job',
			targetId: jobId,
			action: 'system_dm_job.approve',
			auditLogReason,
			metadata,
		});

		await this.workerService.addJob(
			'sendSystemDm',
			{job_id: jobId.toString()},
			{
				jobKey,
				maxAttempts: 3,
			},
		);

		const updatedJob = await this.jobRepository.getJob(jobId);
		if (!updatedJob) {
			throw new Error('Failed to reload job after approval');
		}
		return this.toResponse(updatedJob);
	}

	private toResponse(job: SystemDmJobRow): SystemDmJobResponse {
		return {
			job_id: job.job_id.toString(),
			status: job.status,
			content: job.content,
			target_count: job.target_count,
			sent_count: job.sent_count,
			failed_count: job.failed_count,
			created_at: job.created_at.toISOString(),
			approved_at: job.approved_at?.toISOString() ?? null,
			registration_start: job.registration_start?.toISOString() ?? null,
			registration_end: job.registration_end?.toISOString() ?? null,
			excluded_guild_ids: Array.from(job.excluded_guild_ids ?? []),
			last_error: job.last_error,
		};
	}

	private convertExcludedGuildIds(values?: ReadonlySet<string>): Set<GuildID> {
		const parsed = new Set<GuildID>();
		if (!values) {
			return parsed;
		}

		for (const value of values) {
			try {
				parsed.add(createGuildID(BigInt(value)));
			} catch (error) {
				Logger.debug({value, error}, 'Failed to parse excluded guild ID, skipping invalid value');
			}
		}

		return parsed;
	}
}
