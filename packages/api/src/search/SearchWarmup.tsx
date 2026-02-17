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

import type {GuildID, ReportID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IGuildDataRepository} from '@fluxer/api/src/guild/repositories/IGuildDataRepository';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {IReportRepository} from '@fluxer/api/src/report/IReportRepository';
import {
	getAuditLogSearchService,
	getGuildSearchService,
	getReportSearchService,
	getUserSearchService,
} from '@fluxer/api/src/SearchFactory';
import type {IGuildSearchService} from '@fluxer/api/src/search/IGuildSearchService';
import type {IReportSearchService} from '@fluxer/api/src/search/IReportSearchService';
import type {IUserSearchService} from '@fluxer/api/src/search/IUserSearchService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';

const BATCH_SIZE = 100;

export interface SearchWarmupDeps {
	userRepository: IUserRepository;
	guildRepository: IGuildDataRepository;
	reportRepository: IReportRepository;
	logger: ILogger;
}

export async function warmupAdminSearchIndexes(deps: SearchWarmupDeps): Promise<void> {
	const {userRepository, guildRepository, reportRepository, logger} = deps;

	const guildSearchService = getGuildSearchService();
	const userSearchService = getUserSearchService();
	const reportSearchService = getReportSearchService();
	const auditLogSearchService = getAuditLogSearchService();

	if (!guildSearchService && !userSearchService && !reportSearchService && !auditLogSearchService) {
		logger.info('No search services available, skipping warmup');
		return;
	}

	logger.info('Starting admin search index warmup');

	if (guildSearchService) {
		const testResult = await guildSearchService.searchGuilds('', {}, {limit: 1});
		if (testResult.total === 0) {
			logger.info('Guild index is empty, populating from database');
			await warmupGuilds(guildRepository, guildSearchService, logger);
		} else {
			logger.info({total: testResult.total}, 'Guild index already populated, skipping warmup');
		}
	}

	if (userSearchService && 'indexUser' in userSearchService) {
		const testResult = await userSearchService.searchUsers('', {}, {limit: 1});
		if (testResult.total === 0) {
			logger.info('User index is empty, populating from database');
			await warmupUsers(userRepository, userSearchService, logger);
		} else {
			logger.info({total: testResult.total}, 'User index already populated, skipping warmup');
		}
	}

	if (reportSearchService) {
		const testResult = await reportSearchService.search('', {}, {limit: 1});
		if (testResult.total === 0) {
			logger.info('Report index is empty, populating from database');
			await warmupReports(reportRepository, reportSearchService, logger);
		} else {
			logger.info({total: testResult.total}, 'Report index already populated, skipping warmup');
		}
	}

	logger.info('Admin search index warmup complete');
}

async function warmupGuilds(
	guildRepository: IGuildDataRepository,
	guildSearchService: IGuildSearchService,
	logger: ILogger,
): Promise<void> {
	let lastGuildId: GuildID | undefined;
	let hasMore = true;
	let totalIndexed = 0;

	while (hasMore) {
		const guilds = await guildRepository.listAllGuildsPaginated(BATCH_SIZE, lastGuildId);

		if (guilds.length > 0) {
			await guildSearchService.indexGuilds(guilds);
			totalIndexed += guilds.length;
			lastGuildId = guilds[guilds.length - 1]!.id;
			logger.debug({count: guilds.length, total: totalIndexed}, 'Indexed guild batch');
		}

		hasMore = guilds.length === BATCH_SIZE;
	}

	logger.info({total: totalIndexed}, 'Guild warmup complete');
}

async function warmupUsers(
	userRepository: IUserRepository,
	userSearchService: IUserSearchService,
	logger: ILogger,
): Promise<void> {
	let lastUserId: UserID | undefined;
	let hasMore = true;
	let totalIndexed = 0;

	while (hasMore) {
		const users = await userRepository.listAllUsersPaginated(BATCH_SIZE, lastUserId);

		if (users.length > 0) {
			await userSearchService.indexUsers(users);
			totalIndexed += users.length;
			lastUserId = users[users.length - 1]!.id;
			logger.debug({count: users.length, total: totalIndexed}, 'Indexed user batch');
		}

		hasMore = users.length === BATCH_SIZE;
	}

	logger.info({total: totalIndexed}, 'User warmup complete');
}

async function warmupReports(
	reportRepository: IReportRepository,
	reportSearchService: IReportSearchService,
	logger: ILogger,
): Promise<void> {
	let lastReportId: ReportID | undefined;
	let hasMore = true;
	let totalIndexed = 0;

	while (hasMore) {
		const reports = await reportRepository.listAllReportsPaginated(BATCH_SIZE, lastReportId);

		if (reports.length > 0) {
			if ('indexReports' in reportSearchService) {
				await reportSearchService.indexReports(reports);
			}
			totalIndexed += reports.length;
			lastReportId = reports[reports.length - 1]!.reportId;
			logger.debug({count: reports.length, total: totalIndexed}, 'Indexed report batch');
		}

		hasMore = reports.length === BATCH_SIZE;
	}

	logger.info({total: totalIndexed}, 'Report warmup complete');
}
