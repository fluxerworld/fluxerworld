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

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {IVirusHashCache} from '@fluxer/virus_scan/src/cache/IVirusHashCache';
import type {IVirusScanFailureReporter} from '@fluxer/virus_scan/src/failures/IVirusScanFailureReporter';
import {NoopVirusScanFailureReporter} from '@fluxer/virus_scan/src/failures/NoopVirusScanFailureReporter';
import type {IVirusScanProvider} from '@fluxer/virus_scan/src/IVirusScanProvider';
import type {IVirusScanService} from '@fluxer/virus_scan/src/IVirusScanService';
import type {VirusScanResult} from '@fluxer/virus_scan/src/VirusScanResult';

export interface VirusScanConfig {
	failOpen: boolean;
	cachedThreatLabel?: string;
}

export interface VirusScanServiceDependencies {
	provider: IVirusScanProvider;
	virusHashCache: IVirusHashCache;
	logger: LoggerInterface;
	config: VirusScanConfig;
	failureReporter?: IVirusScanFailureReporter;
}

export class VirusScanService implements IVirusScanService {
	private readonly cachedThreatLabel: string;
	private readonly failureReporter: IVirusScanFailureReporter;

	constructor(private dependencies: VirusScanServiceDependencies) {
		this.cachedThreatLabel = dependencies.config.cachedThreatLabel ?? 'Cached virus signature';
		this.failureReporter = dependencies.failureReporter ?? new NoopVirusScanFailureReporter();
	}

	async initialize(): Promise<void> {
		await this.failureReporter.initialize();
	}

	async scanFile(filePath: string): Promise<VirusScanResult> {
		const buffer = await fs.readFile(filePath);
		return this.scanBuffer(buffer, path.basename(filePath));
	}

	async scanBuffer(buffer: Buffer, filename: string): Promise<VirusScanResult> {
		const fileHash = this.createFileHash(buffer);
		const isCachedVirus = await this.dependencies.virusHashCache.isKnownVirusHash(fileHash);
		if (isCachedVirus) {
			return {
				isClean: false,
				threat: this.cachedThreatLabel,
				fileHash,
			};
		}

		try {
			const scanResult = await this.dependencies.provider.scanBuffer(buffer);
			if (scanResult.isClean) {
				return {
					isClean: true,
					fileHash,
				};
			}

			if (!scanResult.threat) {
				throw new Error('Virus scan provider returned infected status without threat name');
			}

			await this.dependencies.virusHashCache.cacheVirusHash(fileHash);
			return {
				isClean: false,
				threat: scanResult.threat,
				fileHash,
			};
		} catch (error) {
			this.dependencies.logger.error(
				{
					error: this.describeError(error),
					filename,
					fileHash,
				},
				'Virus scan failed',
			);
			await this.reportScanFailure(error, filename, fileHash);

			if (this.dependencies.config.failOpen) {
				return {
					isClean: true,
					fileHash,
				};
			}

			throw new Error(`Virus scan failed: ${this.describeError(error)}`);
		}
	}

	private createFileHash(buffer: Buffer): string {
		return crypto.createHash('sha256').update(buffer).digest('hex');
	}

	private describeError(error: unknown): string {
		if (typeof error === 'string') {
			return error;
		}
		if (error instanceof Error) {
			return error.message;
		}
		return 'Unknown error';
	}

	private async reportScanFailure(error: unknown, filename: string, fileHash: string): Promise<void> {
		try {
			await this.failureReporter.reportFailure({
				error,
				filename,
				fileHash,
				failOpen: this.dependencies.config.failOpen,
			});
		} catch (reportError) {
			this.dependencies.logger.warn(
				{
					error: this.describeError(reportError),
					filename,
					fileHash,
				},
				'Failed to report virus scan failure',
			);
		}
	}
}
