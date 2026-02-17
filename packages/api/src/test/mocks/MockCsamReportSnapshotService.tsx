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

import type {CreateSnapshotParams} from '@fluxer/api/src/csam/CsamReportSnapshotService';
import type {ICsamReportSnapshotService} from '@fluxer/api/src/csam/ICsamReportSnapshotService';
import {vi} from 'vitest';

export interface MockCsamReportSnapshotServiceConfig {
	shouldFail?: boolean;
	reportId?: bigint;
}

export interface StoredSnapshot {
	reportId: bigint;
	params: CreateSnapshotParams;
}

export class MockCsamReportSnapshotService implements ICsamReportSnapshotService {
	readonly createSnapshotSpy = vi.fn();
	private config: MockCsamReportSnapshotServiceConfig;
	private snapshots: Array<StoredSnapshot> = [];
	private nextReportId = 1000000000000000000n;

	constructor(config: MockCsamReportSnapshotServiceConfig = {}) {
		this.config = config;
	}

	configure(config: MockCsamReportSnapshotServiceConfig): void {
		this.config = {...this.config, ...config};
	}

	async createSnapshot(params: CreateSnapshotParams): Promise<bigint> {
		this.createSnapshotSpy(params);
		if (this.config.shouldFail) {
			throw new Error('Mock snapshot service failure');
		}
		const reportId = this.config.reportId ?? this.nextReportId++;
		this.snapshots.push({reportId, params});
		return reportId;
	}

	getSnapshots(): ReadonlyArray<StoredSnapshot> {
		return [...this.snapshots];
	}

	reset(): void {
		this.config = {};
		this.snapshots = [];
		this.nextReportId = 1000000000000000000n;
		this.createSnapshotSpy.mockClear();
	}
}
