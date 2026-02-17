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

import {Config} from '@fluxer/api/src/Config';
import {createNcmecApiConfig, NcmecReporter} from '@fluxer/api/src/csam/NcmecReporter';
import {
	INVALID_REPORT_XML,
	SAMPLE_FILE_DETAILS_XML,
	SAMPLE_REPORT_XML,
} from '@fluxer/api/src/test/fixtures/ncmec/NcmecXmlFixtures';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

const TEST_BASE_URL = 'https://exttest.cybertip.org/ispws';
const TEST_USERNAME = 'usr123';
const TEST_PASSWORD = 'pswd123';

describe('NcmecReporter', () => {
	let originalConfig: {
		enabled: boolean;
		baseUrl?: string;
		username?: string;
		password?: string;
	};

	beforeEach(() => {
		originalConfig = {
			enabled: Config.ncmec.enabled,
			baseUrl: Config.ncmec.baseUrl,
			username: Config.ncmec.username,
			password: Config.ncmec.password,
		};

		Config.ncmec.enabled = true;
		Config.ncmec.baseUrl = TEST_BASE_URL;
		Config.ncmec.username = TEST_USERNAME;
		Config.ncmec.password = TEST_PASSWORD;
	});

	afterEach(() => {
		Config.ncmec.enabled = originalConfig.enabled;
		Config.ncmec.baseUrl = originalConfig.baseUrl;
		Config.ncmec.username = originalConfig.username;
		Config.ncmec.password = originalConfig.password;
	});

	test('submitReport returns the report ID when the XML response is successful', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		const reportId = await reporter.submitReport(SAMPLE_REPORT_XML);

		expect(reportId).toMatch(/^\d+$/);
	});

	test('uploadEvidence returns file metadata from the XML response', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		const reportId = await reporter.submitReport(SAMPLE_REPORT_XML);
		const result = await reporter.uploadEvidence(reportId, new Uint8Array([1, 2, 3]), 'evidence.zip');

		expect(result.fileId).toMatch(/^file-\d+$/);
		expect(result.md5).toBe('fafa5efeaf3cbe3b23b2748d13e629a1');
	});

	test('submitFileDetails posts XML to /fileinfo and succeeds', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		const reportId = await reporter.submitReport(SAMPLE_REPORT_XML);
		const {fileId} = await reporter.uploadEvidence(reportId, new Uint8Array([4, 5, 6]), 'evidence.zip');
		await reporter.submitFileDetails(SAMPLE_FILE_DETAILS_XML(reportId, fileId));
	});

	test('finish returns normalized file IDs even when multiple entries exist', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		const reportId = await reporter.submitReport(SAMPLE_REPORT_XML);
		const firstUpload = await reporter.uploadEvidence(reportId, new Uint8Array([7]), 'file-a.zip');
		const secondUpload = await reporter.uploadEvidence(reportId, new Uint8Array([8]), 'file-b.zip');
		const result = await reporter.finish(reportId);

		expect(result.reportId).toBe(reportId);
		expect(result.fileIds).toEqual([firstUpload.fileId, secondUpload.fileId]);
	});

	test('retract succeeds when NCMEC responds with responseCode 0', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		const reportId = await reporter.submitReport(SAMPLE_REPORT_XML);
		await expect(reporter.retract(reportId)).resolves.toBeUndefined();
	});

	test('submitReport throws when the XML response contains a non-zero responseCode', async () => {
		const reporter = new NcmecReporter({config: createNcmecApiConfig(), fetch});
		await expect(reporter.submitReport(INVALID_REPORT_XML)).rejects.toThrow('responseCode 1000');
	});
});
