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
import type {IVirusScanService} from '@fluxer/virus_scan/src/IVirusScanService';
import type {VirusScanResult} from '@fluxer/virus_scan/src/VirusScanResult';
import {vi} from 'vitest';

export interface MockVirusScanServiceConfig {
	shouldFailInitialize?: boolean;
	shouldFailScan?: boolean;
	isClean?: boolean;
	threat?: string;
	fileHash?: string;
	isHashCached?: boolean;
}

export class MockVirusScanService implements IVirusScanService {
	readonly initializeSpy = vi.fn();
	readonly scanFileSpy = vi.fn();
	readonly scanBufferSpy = vi.fn();
	readonly isVirusHashCachedSpy = vi.fn();
	readonly cacheVirusHashSpy = vi.fn();

	private config: MockVirusScanServiceConfig;

	constructor(config: MockVirusScanServiceConfig = {}) {
		this.config = config;
	}

	configure(config: MockVirusScanServiceConfig): void {
		this.config = {...this.config, ...config};
	}

	async initialize(): Promise<void> {
		this.initializeSpy();
		if (this.config.shouldFailInitialize) {
			throw new Error('Mock virus scan initialization failure');
		}
	}

	async scanFile(filePath: string): Promise<VirusScanResult> {
		this.scanFileSpy(filePath);
		if (this.config.shouldFailScan) {
			throw new Error('Mock virus scan failure');
		}
		return {
			isClean: this.config.isClean ?? true,
			threat: this.config.threat,
			fileHash: this.config.fileHash ?? randomUUID(),
		};
	}

	async scanBuffer(buffer: Buffer, filename: string): Promise<VirusScanResult> {
		this.scanBufferSpy(buffer, filename);
		if (this.config.shouldFailScan) {
			throw new Error('Mock virus scan failure');
		}
		return {
			isClean: this.config.isClean ?? true,
			threat: this.config.threat,
			fileHash: this.config.fileHash ?? randomUUID(),
		};
	}

	async isVirusHashCached(fileHash: string): Promise<boolean> {
		this.isVirusHashCachedSpy(fileHash);
		return this.config.isHashCached ?? false;
	}

	async cacheVirusHash(fileHash: string): Promise<void> {
		this.cacheVirusHashSpy(fileHash);
	}

	reset(): void {
		this.config = {};
		this.initializeSpy.mockClear();
		this.scanFileSpy.mockClear();
		this.scanBufferSpy.mockClear();
		this.isVirusHashCachedSpy.mockClear();
		this.cacheVirusHashSpy.mockClear();
	}
}
