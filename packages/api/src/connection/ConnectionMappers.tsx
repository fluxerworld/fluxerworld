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

import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {ConnectionResponse} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';

export function mapConnectionToResponse(row: UserConnectionRow): ConnectionResponse {
	return {
		id: row.connection_id,
		type: row.connection_type,
		name: row.name,
		verified: row.verified,
		visibility_flags: row.visibility_flags,
		sort_order: row.sort_order,
	};
}
