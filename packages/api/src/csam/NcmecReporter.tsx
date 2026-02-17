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
import {Logger} from '@fluxer/api/src/Logger';
import {recordNcmecSubmission} from '@fluxer/api/src/telemetry/CsamTelemetry';
import {XMLParser} from 'fast-xml-parser';

type NcmecTelemetryOperation = 'report' | 'evidence' | 'fileinfo' | 'finish' | 'retract';

export type NcmecApiConfig =
	| {enabled: true; baseUrl: string; username: string; password: string}
	| {enabled: false; baseUrl: null; username: null; password: null};

export interface NcmecApiDeps {
	config: NcmecApiConfig;
	fetch: typeof fetch;
}

export class NcmecRequestError extends Error {
	constructor(
		message: string,
		public readonly httpStatus: number,
		public readonly responseCode: number | null,
		public readonly responseDescription: string | null,
		public readonly requestId: string | null,
		public readonly body: string | null,
	) {
		super(message);
	}
}

type ReportResponse = {
	responseCode?: number;
	responseDescription?: string;
	reportId?: string;
	fileId?: string;
	hash?: string;
};

type ReportDoneResponse = {
	responseCode?: number;
	reportId?: string;
	files?: {fileId?: string | Array<string>};
};

export class NcmecReporter {
	private readonly parser = new XMLParser({
		ignoreAttributes: true,
		attributeNamePrefix: '@_',
		removeNSPrefix: true,
		parseTagValue: true,
		trimValues: true,
	});

	constructor(private readonly deps: NcmecApiDeps) {}

	async submitReport(reportXml: string): Promise<string> {
		return this.withTelemetry('report', async () => {
			const {res, text} = await this.request('/submit', {
				method: 'POST',
				headers: {'Content-Type': 'text/xml; charset=utf-8'},
				body: reportXml,
			});

			const parsed = this.parseReportResponse(text);
			this.ensureOk(res, parsed, text);

			const reportId = normaliseResponseId(parsed.reportId);
			if (!reportId) {
				throw this.makeError('NCMEC /submit returned no reportId.', res, parsed, text);
			}

			return reportId;
		});
	}

	async uploadEvidence(
		reportId: string,
		buffer: Uint8Array,
		filename: string,
	): Promise<{fileId: string; md5: string | null}> {
		return this.withTelemetry('evidence', async () => {
			const form = new FormData();
			form.append('id', reportId);
			form.append('file', new Blob([buffer as any]), filename);

			const {res, text} = await this.request('/upload', {method: 'POST', body: form});

			const parsed = this.parseReportResponse(text);
			this.ensureOk(res, parsed, text);

			const fileId = normaliseResponseId(parsed.fileId);
			if (!fileId) {
				throw this.makeError('NCMEC /upload returned no fileId.', res, parsed, text);
			}

			return {fileId, md5: normaliseResponseId(parsed.hash)};
		});
	}

	async submitFileDetails(fileDetailsXml: string): Promise<void> {
		await this.withTelemetry('fileinfo', async () => {
			const {res, text} = await this.request('/fileinfo', {
				method: 'POST',
				headers: {'Content-Type': 'text/xml; charset=utf-8'},
				body: fileDetailsXml,
			});

			const parsed = this.parseReportResponse(text);
			this.ensureOk(res, parsed, text);
		});
	}

	async finish(requestReportId: string): Promise<{reportId: string; fileIds: Array<string>}> {
		return this.withTelemetry('finish', async () => {
			const form = new FormData();
			form.append('id', requestReportId);

			const {res, text} = await this.request('/finish', {method: 'POST', body: form});

			const parsed = this.parseReportDoneResponse(text);
			this.ensureOk(res, parsed, text);

			const responseReportId = normaliseResponseId(parsed.reportId);
			if (!responseReportId) {
				throw this.makeError('NCMEC /finish returned no reportId.', res, parsed, text);
			}

			const raw = parsed.files?.fileId;
			const fileIds = (Array.isArray(raw) ? raw : raw ? [raw] : [])
				.map((value) => normaliseResponseId(value))
				.filter((value): value is string => Boolean(value));
			return {reportId: responseReportId, fileIds};
		});
	}

	async retract(reportId: string): Promise<void> {
		await this.withTelemetry('retract', async () => {
			const form = new FormData();
			form.append('id', reportId);

			const {res, text} = await this.request('/retract', {method: 'POST', body: form});

			const parsed = this.parseReportResponse(text);
			this.ensureOk(res, parsed, text);
		});
	}

	private async request(path: string, init: RequestInit): Promise<{res: Response; text: string}> {
		const cfg = this.requireEnabledConfig();

		const res = await this.deps.fetch(`${cfg.baseUrl}${path}`, {
			...init,
			headers: {
				Authorization: basicAuth(cfg.username, cfg.password),
				...(init.headers ?? {}),
			},
		});

		const text = await res.text().catch(() => '');
		return {res, text};
	}

	private parseReportResponse(xml: string): ReportResponse {
		const parsed = this.safeParse(xml);
		return (parsed?.reportResponse ?? {}) as ReportResponse;
	}

	private parseReportDoneResponse(xml: string): ReportDoneResponse {
		const parsed = this.safeParse(xml);
		return (parsed?.reportDoneResponse ?? {}) as ReportDoneResponse;
	}

	private safeParse(xml: string): any | null {
		if (!xml) return null;
		try {
			return this.parser.parse(xml);
		} catch {
			return null;
		}
	}

	private ensureOk(res: Response, parsed: {responseCode?: number; responseDescription?: string}, body: string): void {
		const requestId = res.headers.get('Request-ID');
		const responseCode = parsed?.responseCode ?? null;
		const responseDescription = parsed?.responseDescription ?? null;

		if (res.ok && responseCode === 0) return;

		const message =
			responseCode !== null
				? `NCMEC request failed (http ${res.status}, responseCode ${responseCode}).`
				: `NCMEC request failed (http ${res.status}).`;

		Logger.warn(
			{status: res.status, responseCode, responseDescription, requestId, body: body || '<no body>'},
			'NCMEC request failed',
		);

		throw new NcmecRequestError(message, res.status, responseCode, responseDescription, requestId, body || null);
	}

	private makeError(
		message: string,
		res: Response,
		parsed: {responseCode?: number; responseDescription?: string},
		body: string,
	): NcmecRequestError {
		return new NcmecRequestError(
			message,
			res.status,
			parsed?.responseCode ?? null,
			parsed?.responseDescription ?? null,
			res.headers.get('Request-ID'),
			body || null,
		);
	}

	private requireEnabledConfig(): Extract<NcmecApiConfig, {enabled: true}> {
		const cfg = this.deps.config;
		if (!cfg.enabled) throw new Error('NCMEC reporting is disabled.');
		return cfg;
	}

	private async withTelemetry<T>(operation: NcmecTelemetryOperation, fn: () => Promise<T>): Promise<T> {
		if (!this.deps.config.enabled) {
			recordNcmecSubmission({operation, status: 'disabled'});
			throw new Error('NCMEC reporting is disabled.');
		}

		try {
			const result = await fn();
			recordNcmecSubmission({operation, status: 'success'});
			return result;
		} catch (error) {
			recordNcmecSubmission({operation, status: 'error'});
			Logger.error({error, operation}, 'NCMEC operation failed');
			throw error;
		}
	}
}

export function createNcmecApiConfig(): NcmecApiConfig {
	if (!Config.ncmec.enabled) {
		return {enabled: false, baseUrl: null, username: null, password: null};
	}

	return {
		enabled: true,
		baseUrl: normaliseBaseUrl(Config.ncmec.baseUrl),
		username: normaliseRequiredValue(Config.ncmec.username, 'NCMEC username'),
		password: normaliseRequiredValue(Config.ncmec.password, 'NCMEC password'),
	};
}

export function createNcmecApi(): NcmecReporter {
	return new NcmecReporter({config: createNcmecApiConfig(), fetch});
}

function basicAuth(username: string, password: string): string {
	return `Basic ${Buffer.from(`${username}:${password}`, 'utf-8').toString('base64')}`;
}

function normaliseBaseUrl(rawUrl: string | undefined | null): string {
	const trimmed = (rawUrl ?? '').trim();
	if (!trimmed) throw new Error('NCMEC base URL is required when reporting is enabled.');
	return trimmed.replace(/\/+$/, '');
}

function normaliseRequiredValue(value: string | undefined | null, label: string): string {
	const trimmed = (value ?? '').trim();
	if (!trimmed) throw new Error(`${label} is required when reporting is enabled.`);
	return trimmed;
}

function normaliseResponseId(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed ? trimmed : null;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : null;
	}
	return null;
}
