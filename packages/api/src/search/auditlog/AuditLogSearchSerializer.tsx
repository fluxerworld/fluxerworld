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
import type {SearchableAuditLog} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

export function convertToSearchableAuditLog(log: AdminAuditLog): SearchableAuditLog {
	const createdAt = Math.floor(snowflakeToDate(BigInt(log.logId)).getTime() / 1000);

	return {
		id: log.logId.toString(),
		logId: log.logId.toString(),
		adminUserId: log.adminUserId.toString(),
		targetType: log.targetType,
		targetId: log.targetId.toString(),
		action: log.action,
		auditLogReason: log.auditLogReason,
		createdAt,
	};
}
