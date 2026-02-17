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

export interface QueueConfig {
	dataDir: string;
	snapshotEveryMs: number;
	snapshotAfterOps: number;
	snapshotZstdLevel: number;
	defaultVisibilityTimeoutMs: number;
	visibilityTimeoutBackoffMs: number;
	maxReceiveBatch: number;
	commandBuffer: number;
}

export const defaultQueueConfig: QueueConfig = {
	dataDir: './data/queue',
	snapshotEveryMs: 2000,
	snapshotAfterOps: 50000,
	snapshotZstdLevel: 3,
	defaultVisibilityTimeoutMs: 30000,
	visibilityTimeoutBackoffMs: 10000,
	maxReceiveBatch: 100,
	commandBuffer: 8192,
};
