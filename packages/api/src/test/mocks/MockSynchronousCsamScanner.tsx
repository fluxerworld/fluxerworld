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
import type {PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {ISynchronousCsamScanner} from '@fluxer/api/src/csam/ISynchronousCsamScanner';
import type {
	ScanBase64Params,
	ScanMediaParams,
	SynchronousCsamScanResult,
} from '@fluxer/api/src/csam/SynchronousCsamScanner';
import {vi} from 'vitest';

export interface MockSynchronousCsamScannerConfig {
	shouldMatch?: boolean;
	matchResult?: PhotoDnaMatchResult;
	omitMatchResult?: boolean;
	shouldFail?: boolean;
}

export interface ScanCall {
	readonly type: 'media' | 'base64';
	readonly contentType: string;
}

function createDefaultMatchResult(): PhotoDnaMatchResult {
	return {
		isMatch: true,
		trackingId: randomUUID(),
		matchDetails: [
			{
				source: 'test-database',
				violations: ['CSAM'],
				matchDistance: 0.01,
				matchId: randomUUID(),
			},
		],
		timestamp: new Date().toISOString(),
	};
}

export class MockSynchronousCsamScanner implements ISynchronousCsamScanner {
	readonly scanMediaSpy = vi.fn();
	readonly scanBase64Spy = vi.fn();

	private config: MockSynchronousCsamScannerConfig;
	private scanCalls: Array<ScanCall> = [];

	constructor(config: MockSynchronousCsamScannerConfig = {}) {
		this.config = config;
	}

	configure(config: MockSynchronousCsamScannerConfig): void {
		this.config = {...this.config, ...config};
	}

	async scanMedia(params: ScanMediaParams): Promise<SynchronousCsamScanResult> {
		this.scanMediaSpy(params);
		this.scanCalls.push({type: 'media', contentType: params.contentType ?? 'unknown'});

		if (this.config.shouldFail) {
			throw new Error('Mock CSAM scan failure');
		}

		if (this.config.shouldMatch) {
			if (this.config.omitMatchResult) {
				return {isMatch: true};
			}
			return {
				isMatch: true,
				matchResult: this.config.matchResult ?? createDefaultMatchResult(),
			};
		}
		return {isMatch: false};
	}

	async scanBase64(params: ScanBase64Params): Promise<SynchronousCsamScanResult> {
		this.scanBase64Spy(params);
		this.scanCalls.push({type: 'base64', contentType: params.mimeType});

		if (this.config.shouldFail) {
			throw new Error('Mock CSAM scan failure');
		}

		if (this.config.shouldMatch) {
			if (this.config.omitMatchResult) {
				return {isMatch: true};
			}
			return {
				isMatch: true,
				matchResult: this.config.matchResult ?? createDefaultMatchResult(),
			};
		}
		return {isMatch: false};
	}

	getScanCalls(): Array<ScanCall> {
		return [...this.scanCalls];
	}

	reset(): void {
		this.config = {};
		this.scanCalls = [];
		this.scanMediaSpy.mockClear();
		this.scanBase64Spy.mockClear();
	}
}
