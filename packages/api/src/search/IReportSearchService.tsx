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

import type {GuildID, MessageID, ReportID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IARSubmission} from '@fluxer/api/src/report/IReportRepository';
import type {
	ISearchAdapter as SchemaISearchAdapter,
	SearchResult as SchemaSearchResult,
} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {ReportSearchFilters, SearchableReport} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

export interface IReportSearchService extends SchemaISearchAdapter<ReportSearchFilters, SearchableReport> {
	indexReport(report: IARSubmission): Promise<void>;
	indexReports(reports: Array<IARSubmission>): Promise<void>;
	updateReport(report: IARSubmission): Promise<void>;
	deleteReport(reportId: ReportID): Promise<void>;
	deleteReports(reportIds: Array<ReportID>): Promise<void>;
	searchReports(
		query: string,
		filters: ReportSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByReporter(
		reporterId: UserID,
		limit?: number,
		offset?: number,
	): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByStatus(status: number, limit?: number, offset?: number): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByType(reportType: number, limit?: number, offset?: number): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByReportedUser(
		reportedUserId: UserID,
		limit?: number,
		offset?: number,
	): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByReportedGuild(
		reportedGuildId: GuildID,
		limit?: number,
		offset?: number,
	): Promise<SchemaSearchResult<SearchableReport>>;
	listReportsByReportedMessage(
		reportedMessageId: MessageID,
		limit?: number,
		offset?: number,
	): Promise<SchemaSearchResult<SearchableReport>>;
}
