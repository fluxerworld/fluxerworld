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

import {JsonValueSchema} from '@fluxer/queue/src/types/JsonTypes';
import {z} from 'zod';

export const EnqueueRequestSchema = z.object({
	task_type: z.string().min(1).max(256),
	payload: JsonValueSchema,
	priority: z.number().int().min(0).max(100).default(0),
	run_at: z.iso.datetime().optional(),
	max_attempts: z.number().int().min(1).max(100).default(3),
	deduplication_id: z.string().max(256).optional(),
});

export type EnqueueRequest = z.infer<typeof EnqueueRequestSchema>;

export const DequeueQuerySchema = z.object({
	task_types: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(1),
	wait_time_ms: z.coerce.number().int().min(0).max(30000).default(0),
	visibility_timeout_ms: z.coerce.number().int().min(1000).max(43200000).optional(),
});

export type DequeueQuery = z.infer<typeof DequeueQuerySchema>;

export const AckRequestSchema = z.object({
	receipt: z.string().uuid(),
});

export type AckRequest = z.infer<typeof AckRequestSchema>;

export const NackRequestSchema = z.object({
	receipt: z.string().uuid(),
	error: z.string().max(4096).optional(),
});

export type NackRequest = z.infer<typeof NackRequestSchema>;

export const VisibilityRequestSchema = z.object({
	receipt: z.string().uuid(),
	timeout_ms: z.number().int().min(1000).max(43200000),
});

export type VisibilityRequest = z.infer<typeof VisibilityRequestSchema>;

export const UpsertCronRequestSchema = z.object({
	id: z.string().min(1).max(256),
	task_type: z.string().min(1).max(256),
	payload: JsonValueSchema,
	cron_expression: z.string().min(1).max(256),
	enabled: z.boolean().default(true),
});

export type UpsertCronRequest = z.infer<typeof UpsertCronRequestSchema>;

export const RetryJobParamsSchema = z.object({
	job_id: z.string().uuid(),
});

export type RetryJobParams = z.infer<typeof RetryJobParamsSchema>;

export const DeleteJobParamsSchema = z.object({
	job_id: z.string().uuid(),
});

export type DeleteJobParams = z.infer<typeof DeleteJobParamsSchema>;
