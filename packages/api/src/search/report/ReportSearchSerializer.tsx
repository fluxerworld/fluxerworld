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

import type {IARSubmission} from '@fluxer/api/src/report/IReportRepository';
import type {SearchableReport} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

export function convertToSearchableReport(report: IARSubmission): SearchableReport {
	const createdAt = Math.floor(snowflakeToDate(BigInt(report.reportId)).getTime() / 1000);
	const reportedAt = Math.floor(report.reportedAt.getTime() / 1000);
	const resolvedAt = report.resolvedAt ? Math.floor(report.resolvedAt.getTime() / 1000) : null;

	return {
		id: report.reportId.toString(),
		reporterId: report.reporterId ? report.reporterId.toString() : 'anonymous',
		reportedAt,
		status: report.status,
		reportType: report.reportType,
		category: report.category,
		additionalInfo: report.additionalInfo,
		reportedUserId: report.reportedUserId?.toString() || null,
		reportedGuildId: report.reportedGuildId?.toString() || null,
		reportedGuildName: report.reportedGuildName,
		reportedMessageId: report.reportedMessageId?.toString() || null,
		reportedChannelId: report.reportedChannelId?.toString() || null,
		reportedChannelName: report.reportedChannelName,
		guildContextId: report.guildContextId?.toString() || null,
		resolvedAt,
		resolvedByAdminId: report.resolvedByAdminId?.toString() || null,
		publicComment: report.publicComment,
		createdAt,
	};
}
