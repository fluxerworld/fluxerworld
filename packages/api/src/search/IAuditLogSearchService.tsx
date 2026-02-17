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

import type {AdminAuditLog} from '@fluxer/api/src/admin/IAdminRepository';
import type {
	ISearchAdapter as SchemaISearchAdapter,
	SearchResult as SchemaSearchResult,
} from '@fluxer/schema/src/contracts/search/SearchAdapterTypes';
import type {AuditLogSearchFilters, SearchableAuditLog} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';

export interface IAuditLogSearchService extends SchemaISearchAdapter<AuditLogSearchFilters, SearchableAuditLog> {
	indexAuditLog(log: AdminAuditLog): Promise<void>;
	indexAuditLogs(logs: Array<AdminAuditLog>): Promise<void>;
	deleteAuditLog(logId: bigint): Promise<void>;
	searchAuditLogs(
		query: string,
		filters: AuditLogSearchFilters,
		options?: {limit?: number; offset?: number},
	): Promise<SchemaSearchResult<SearchableAuditLog>>;
}
