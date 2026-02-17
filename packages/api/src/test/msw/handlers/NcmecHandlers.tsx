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

import {HttpResponse, http} from 'msw';

const NCMEC_BASE_URL = 'https://exttest.cybertip.org/ispws';

type SubmissionRecord = {
	reportId: string;
	fileIds: Array<string>;
	retracted: boolean;
};

let reportCounter = 4564654;
let fileCounter = 1;
let requestCounter = 1;
const submissions = new Map<string, SubmissionRecord>();

export function resetNcmecState(): void {
	reportCounter = 4564654;
	fileCounter = 1;
	requestCounter = 1;
	submissions.clear();
}

export function createNcmecHandlers() {
	return [
		http.get(`${NCMEC_BASE_URL}/status`, ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>0</responseCode>
    <responseDescription>Remote User : test-user, Remote Ip : 127.0.0.1</responseDescription>
</reportResponse>`,
			);
		}),
		http.get(`${NCMEC_BASE_URL}/xsd`, () => {
			return HttpResponse.text('<schema></schema>', {status: 200});
		}),
		http.post(`${NCMEC_BASE_URL}/submit`, async ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			if (!hasXmlContentType(request)) {
				return xmlResponse(reportErrorResponse(1001, 'Invalid content type'));
			}
			const body = await request.text();
			if (!isValidReportXml(body)) {
				return xmlResponse(reportErrorResponse(1000, 'Invalid report XML'));
			}
			const reportId = String(reportCounter++);
			submissions.set(reportId, {reportId, fileIds: [], retracted: false});
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>0</responseCode>
    <responseDescription>Success</responseDescription>
    <reportId>${reportId}</reportId>
</reportResponse>`,
			);
		}),
		http.post(`${NCMEC_BASE_URL}/upload`, async ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			const form = await request.formData();
			const reportId = String(form.get('id') ?? '');
			const file = form.get('file');
			if (!reportId || !file || !submissions.has(reportId)) {
				return xmlResponse(reportErrorResponse(1002, 'Unknown report'));
			}
			const record = submissions.get(reportId)!;
			const fileId = `file-${fileCounter++}`;
			record.fileIds.push(fileId);
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>0</responseCode>
    <responseDescription>Success</responseDescription>
    <reportId>${reportId}</reportId>
    <fileId>${fileId}</fileId>
    <hash>fafa5efeaf3cbe3b23b2748d13e629a1</hash>
</reportResponse>`,
			);
		}),
		http.post(`${NCMEC_BASE_URL}/fileinfo`, async ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			if (!hasXmlContentType(request)) {
				return xmlResponse(reportErrorResponse(1001, 'Invalid content type'));
			}
			const body = await request.text();
			const reportId = extractXmlTag(body, 'reportId');
			const fileId = extractXmlTag(body, 'fileId');
			if (!reportId || !fileId || !submissions.has(reportId)) {
				return xmlResponse(reportErrorResponse(1002, 'Unknown report'));
			}
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>0</responseCode>
    <responseDescription>Success</responseDescription>
    <reportId>${reportId}</reportId>
</reportResponse>`,
			);
		}),
		http.post(`${NCMEC_BASE_URL}/finish`, async ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			const form = await request.formData();
			const reportId = String(form.get('id') ?? '');
			const record = submissions.get(reportId);
			if (!record || record.retracted) {
				return xmlResponse(reportErrorResponse(1002, 'Unknown report'));
			}
			const files = record.fileIds.map((id) => `        <fileId>${id}</fileId>`).join('\n');
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportDoneResponse>
    <responseCode>0</responseCode>
    <reportId>${reportId}</reportId>
    <files>
${files}
    </files>
</reportDoneResponse>`,
			);
		}),
		http.post(`${NCMEC_BASE_URL}/retract`, async ({request}) => {
			if (!hasBasicAuth(request)) {
				return HttpResponse.text('', {status: 401});
			}
			const form = await request.formData();
			const reportId = String(form.get('id') ?? '');
			const record = submissions.get(reportId);
			if (!record) {
				return xmlResponse(reportErrorResponse(1002, 'Unknown report'));
			}
			record.retracted = true;
			return xmlResponse(
				`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>0</responseCode>
    <responseDescription>Success</responseDescription>
    <reportId>${reportId}</reportId>
</reportResponse>`,
			);
		}),
	];
}

function xmlResponse(body: string) {
	return HttpResponse.text(body, {
		status: 200,
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'Request-ID': `req-${requestCounter++}`,
		},
	});
}

function reportErrorResponse(code: number, description: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<reportResponse>
    <responseCode>${code}</responseCode>
    <responseDescription>${description}</responseDescription>
</reportResponse>`;
}

function hasXmlContentType(request: Request): boolean {
	const contentType = request.headers.get('content-type') ?? '';
	return contentType.toLowerCase().includes('text/xml');
}

function hasBasicAuth(request: Request): boolean {
	const auth = request.headers.get('authorization') ?? '';
	return auth.toLowerCase().startsWith('basic ');
}

function isValidReportXml(body: string): boolean {
	return body.includes('<report') && body.includes('<incidentSummary>') && body.includes('<incidentType>');
}

function extractXmlTag(body: string, tag: string): string | null {
	const match = body.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
	return match?.[1] ?? null;
}
