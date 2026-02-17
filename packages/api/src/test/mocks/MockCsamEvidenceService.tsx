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

import {randomUUID} from 'node:crypto';
import type {
	ICsamEvidenceService,
	StoreEvidenceArgs,
	StoreEvidenceResult,
} from '@fluxer/api/src/csam/ICsamEvidenceService';
import {vi} from 'vitest';

export interface MockCsamEvidenceServiceConfig {
	shouldFail?: boolean;
	integrityHash?: string;
	evidenceZipKey?: string;
	assetCopyKey?: string;
}

export class MockCsamEvidenceService implements ICsamEvidenceService {
	readonly storeEvidenceSpy = vi.fn();
	private config: MockCsamEvidenceServiceConfig;
	private storedEvidence: Array<{args: StoreEvidenceArgs; result: StoreEvidenceResult; timestamp: Date}> = [];

	constructor(config: MockCsamEvidenceServiceConfig = {}) {
		this.config = config;
	}

	configure(config: MockCsamEvidenceServiceConfig): void {
		this.config = {...this.config, ...config};
	}

	async storeEvidence(args: StoreEvidenceArgs): Promise<StoreEvidenceResult> {
		this.storeEvidenceSpy(args);

		if (this.config.shouldFail) {
			throw new Error('Mock evidence service failure');
		}

		const result: StoreEvidenceResult = {
			integrityHash: this.config.integrityHash ?? `integrity-${randomUUID()}`,
			evidenceZipKey: this.config.evidenceZipKey ?? `evidence/report-${args.reportId}/evidence.zip`,
			assetCopyKey: this.config.assetCopyKey ?? `evidence/report-${args.reportId}/asset-copy.dat`,
		};

		this.storedEvidence.push({args, result, timestamp: new Date()});

		return result;
	}

	getStoredEvidence(): Array<{args: StoreEvidenceArgs; result: StoreEvidenceResult; timestamp: Date}> {
		return [...this.storedEvidence];
	}

	reset(): void {
		this.config = {};
		this.storedEvidence = [];
		this.storeEvidenceSpy.mockClear();
	}
}
