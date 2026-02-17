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

import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';

export interface QueueApiEnqueueResponse {
	job_id: string;
	enqueued: boolean;
}

export interface QueueApiJob {
	id: string;
	task_type: string;
	payload: JsonValue | null;
	priority: number;
	run_at: string;
	created_at: string;
	attempts: number;
	max_attempts: number;
	error: string | null;
	deduplication_id: string | null;
}

export interface QueueApiLeasedJob {
	receipt: string;
	visibility_deadline: string;
	job: QueueApiJob;
}

export interface QueueApiStats {
	ready: number;
	processing: number;
	scheduled: number;
	dead_letter: number;
}

export interface QueueApiCronStatus {
	id: string;
	task_type: string;
	cron_expression: string;
	enabled: boolean;
	last_run_at: string | null;
	next_run_at: string;
	last_run_age_ms: number | null;
	is_overdue: boolean;
}

export interface QueueApiStatsResponse {
	queue: QueueApiStats;
	crons: Array<QueueApiCronStatus>;
}

export interface QueueApiMetricsResponse {
	queue: QueueApiStats;
}

export interface QueueApiHealthResponse {
	status: string;
}
