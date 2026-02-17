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

import type {UserID} from '@fluxer/api/src/BrandedTypes';

export type SystemDmJobStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed';
export interface SystemDmJobRow {
	job_type: string;
	job_id: bigint;
	admin_user_id: UserID;
	status: SystemDmJobStatus;
	content: string;
	registration_start: Date | null;
	registration_end: Date | null;
	excluded_guild_ids: ReadonlySet<string>;
	target_count: number;
	sent_count: number;
	failed_count: number;
	last_error: string | null;
	worker_job_key: string | null;
	created_at: Date;
	updated_at: Date;
	approved_by: UserID | null;
	approved_at: Date | null;
}

export const SYSTEM_DM_JOB_COLUMNS = [
	'job_type',
	'job_id',
	'admin_user_id',
	'status',
	'content',
	'registration_start',
	'registration_end',
	'excluded_guild_ids',
	'target_count',
	'sent_count',
	'failed_count',
	'last_error',
	'worker_job_key',
	'created_at',
	'updated_at',
	'approved_by',
	'approved_at',
] as const satisfies ReadonlyArray<keyof SystemDmJobRow>;
