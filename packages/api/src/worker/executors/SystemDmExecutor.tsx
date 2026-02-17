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

import {type ChannelID, createGuildID, createUserID, type GuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {MessageRequest} from '@fluxer/api/src/channel/MessageTypes';
import {createRequestCache, type RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {getUserSearchService} from '@fluxer/api/src/SearchFactory';
import {collectSystemDmTargets, type SystemDmTargetFilters} from '@fluxer/api/src/system_dm/TargetFinder';
import {UserChannelService} from '@fluxer/api/src/user/services/UserChannelService';
import type {WorkerDependencies} from '@fluxer/api/src/worker/WorkerDependencies';

export interface WorkerLogger {
	debug(message: string, extra?: object): void;
	info(message: string, extra?: object): void;
	warn(message: string, extra?: object): void;
	error(message: string, extra?: object): void;
}

export interface SendSystemDmParams {
	job_id: string;
}

export class SystemDmExecutor {
	private readonly systemUserId = createUserID(0n);
	private readonly userChannelService: UserChannelService;

	constructor(
		private readonly deps: WorkerDependencies,
		private readonly logger: WorkerLogger,
	) {
		this.userChannelService = new UserChannelService(
			this.deps.userRepository,
			this.deps.userRepository,
			this.deps.userRepository,
			this.deps.channelService,
			this.deps.channelRepository,
			this.deps.gatewayService,
			this.deps.mediaService,
			this.deps.snowflakeService,
			this.deps.userPermissionUtils,
			this.deps.limitConfigService,
		);
	}

	async execute(params: SendSystemDmParams): Promise<void> {
		const jobId = this.parseJobId(params.job_id);
		if (jobId === null) {
			this.logger.warn('Invalid system DM job id', {payload: params});
			return;
		}

		const job = await this.deps.systemDmJobRepository.getJob(jobId);
		if (!job) {
			this.logger.warn('System DM job missing', {jobId: jobId.toString()});
			return;
		}

		if (job.status !== 'approved') {
			this.logger.warn('Skipping system DM job in unexpected state', {jobId: jobId.toString(), status: job.status});
			return;
		}

		await this.deps.systemDmJobRepository.patchJob(jobId, {status: 'running', updated_at: new Date()});

		const userSearchService = getUserSearchService();
		if (!userSearchService) {
			await this.failJob(jobId, 'User search service unavailable');
			return;
		}

		const systemUser = await this.deps.userRepository.findUnique(this.systemUserId);
		if (!systemUser) {
			await this.failJob(jobId, 'System user not found');
			return;
		}

		const filters: SystemDmTargetFilters = {
			...(job.registration_start != null && {registrationStart: job.registration_start}),
			...(job.registration_end != null && {registrationEnd: job.registration_end}),
			excludedGuildIds: this.convertExcludedGuildIds(job.excluded_guild_ids),
		};

		const recipients = await collectSystemDmTargets(
			{userRepository: this.deps.userRepository, userSearchService},
			filters,
		);

		if (recipients.length === 0) {
			await this.completeJob(jobId, job.sent_count, job.failed_count, job.last_error);
			return;
		}

		const requestCache = createRequestCache();
		let sentCount = job.sent_count;
		let failedCount = job.failed_count;
		let lastError = job.last_error;

		for (const recipientId of recipients) {
			const channelId = await this.ensureDmChannel(recipientId, requestCache);
			try {
				const messageRequest: MessageRequest = {
					content: job.content,
				};

				await this.deps.channelService.messages.sendMessage({
					user: systemUser,
					channelId,
					data: messageRequest,
					requestCache,
				});
				sentCount += 1;
			} catch (error) {
				failedCount += 1;
				lastError = error instanceof Error ? error.message : 'Failed to send system DM';
				this.logger.warn('System DM send failed', {jobId: jobId.toString(), error});
			}

			await this.deps.systemDmJobRepository.patchJob(jobId, {
				sent_count: sentCount,
				failed_count: failedCount,
				last_error: lastError,
				updated_at: new Date(),
			});
		}

		await this.completeJob(jobId, sentCount, failedCount, lastError);
		requestCache.clear();
	}

	private async ensureDmChannel(recipientId: UserID, requestCache: RequestCache): Promise<ChannelID> {
		const channel = await this.userChannelService.ensureDmOpenForBothUsers({
			userId: this.systemUserId,
			recipientId,
			userCacheService: this.deps.userCacheService,
			requestCache,
		});
		return channel.id;
	}

	private convertExcludedGuildIds(value?: ReadonlySet<string>): Set<GuildID> {
		const result = new Set<GuildID>();
		if (!value) {
			return result;
		}
		for (const id of value) {
			try {
				result.add(createGuildID(BigInt(id)));
			} catch (error) {
				this.logger.warn('Failed to convert excluded guild ID', {
					guildId: id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return result;
	}

	private async completeJob(jobId: bigint, sentCount: number, failedCount: number, lastError: string | null) {
		await this.deps.systemDmJobRepository.patchJob(jobId, {
			status: 'completed',
			sent_count: sentCount,
			failed_count: failedCount,
			last_error: lastError,
			updated_at: new Date(),
		});
	}

	private async failJob(jobId: bigint, reason: string) {
		await this.deps.systemDmJobRepository.patchJob(jobId, {
			status: 'failed',
			last_error: reason,
			updated_at: new Date(),
		});
	}

	private parseJobId(value: string): bigint | null {
		try {
			return BigInt(value);
		} catch {
			return null;
		}
	}
}
