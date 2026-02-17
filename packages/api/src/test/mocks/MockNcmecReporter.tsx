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
import {vi} from 'vitest';

export interface MockNcmecReporterConfig {
	reportId?: string;
	fileId?: string;
	md5?: string;
	submitShouldFail?: boolean;
	uploadShouldFail?: boolean;
	fileInfoShouldFail?: boolean;
	finishShouldFail?: boolean;
	retractShouldFail?: boolean;
}

export class MockNcmecReporter {
	readonly submitReportSpy = vi.fn();
	readonly uploadEvidenceSpy = vi.fn();
	readonly submitFileDetailsSpy = vi.fn();
	readonly finishSpy = vi.fn();
	readonly retractSpy = vi.fn();

	private config: MockNcmecReporterConfig;
	private createdReports: Array<{reportId: string; payload: string}> = [];
	private uploadedFiles: Array<{reportId: string; filename: string; size: number}> = [];

	constructor(config: MockNcmecReporterConfig = {}) {
		this.config = config;
	}

	configure(config: MockNcmecReporterConfig): void {
		this.config = {...this.config, ...config};
	}

	async submitReport(reportXml: string): Promise<string> {
		this.submitReportSpy(reportXml);

		if (this.config.submitShouldFail) {
			throw new Error('Mock NCMEC report submission failed');
		}

		const reportId = this.config.reportId ?? randomUUID();
		this.createdReports.push({reportId, payload: reportXml});
		return reportId;
	}

	async uploadEvidence(
		reportId: string,
		buffer: Uint8Array,
		filename: string,
	): Promise<{fileId: string; md5: string | null}> {
		this.uploadEvidenceSpy(reportId, filename, buffer);

		if (this.config.uploadShouldFail) {
			throw new Error('Mock NCMEC evidence upload failed');
		}

		const fileId = this.config.fileId ?? randomUUID();
		this.uploadedFiles.push({reportId, filename, size: buffer.byteLength});
		return {fileId, md5: this.config.md5 ?? null};
	}

	async submitFileDetails(fileDetailsXml: string): Promise<void> {
		this.submitFileDetailsSpy(fileDetailsXml);

		if (this.config.fileInfoShouldFail) {
			throw new Error('Mock NCMEC file details submission failed');
		}
	}

	async finish(reportId: string): Promise<{reportId: string; fileIds: Array<string>}> {
		this.finishSpy(reportId);

		if (this.config.finishShouldFail) {
			throw new Error('Mock NCMEC finish failed');
		}

		const fileIds = this.config.fileId ? [this.config.fileId] : [];
		return {reportId, fileIds};
	}

	async retract(reportId: string): Promise<void> {
		this.retractSpy(reportId);

		if (this.config.retractShouldFail) {
			throw new Error('Mock NCMEC retract failed');
		}
	}

	getReports(): Array<{reportId: string; payload: string}> {
		return [...this.createdReports];
	}

	getUploads(): Array<{reportId: string; filename: string; size: number}> {
		return [...this.uploadedFiles];
	}

	reset(): void {
		this.config = {};
		this.createdReports = [];
		this.uploadedFiles = [];
		this.submitReportSpy.mockClear();
		this.uploadEvidenceSpy.mockClear();
		this.submitFileDetailsSpy.mockClear();
		this.finishSpy.mockClear();
		this.retractSpy.mockClear();
	}
}
