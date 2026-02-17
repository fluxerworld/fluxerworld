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

import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import {extractBaseServiceConfig} from '@fluxer/config/src/ServiceConfigSlices';

const master = await loadConfig();

export const Config = {
	...extractBaseServiceConfig(master),
	port: master.services.queue.port,
	dataDir: master.services.queue.data_dir,
	snapshotEveryMs: master.services.queue.snapshot_every_ms,
	snapshotAfterOps: master.services.queue.snapshot_after_ops,
	snapshotZstdLevel: master.services.queue.snapshot_zstd_level,
	defaultVisibilityTimeoutMs: master.services.queue.default_visibility_timeout_ms,
	visibilityTimeoutBackoffMs: master.services.queue.visibility_timeout_backoff_ms,
	maxReceiveBatch: master.services.queue.max_receive_batch,
	commandBuffer: master.services.queue.command_buffer,
	rateLimit: master.services.queue.rate_limit ?? null,
	secret: master.services.queue.secret,
};

export type Config = typeof Config;
