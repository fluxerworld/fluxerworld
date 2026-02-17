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

import type {CsamResourceType} from '@fluxer/api/src/csam/CsamTypes';
import {recordCounter, recordHistogram} from '@fluxer/api/src/Telemetry';

export type CsamScanStatus = 'success' | 'error' | 'skipped' | 'disabled';
export type CsamApiStatus = 'success' | 'error' | 'timeout';
export type NcmecSubmissionStatus = 'success' | 'error' | 'disabled';
export type EvidenceStorageStatus = 'success' | 'error';

export function recordCsamScan(params: {
	resourceType: CsamResourceType;
	mediaType: string;
	status: CsamScanStatus;
}): void {
	recordCounter({
		name: 'fluxer.csam.scans.total',
		dimensions: {
			resource_type: params.resourceType,
			media_type: params.mediaType,
			status: params.status,
		},
	});
}

export function recordCsamScanDuration(params: {resourceType: CsamResourceType; durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.csam.scan.duration_ms',
		valueMs: params.durationMs,
		dimensions: {
			resource_type: params.resourceType,
		},
	});
}

export function recordCsamMatch(params: {resourceType: CsamResourceType; source: string; matchCount: number}): void {
	recordCounter({
		name: 'fluxer.csam.matches.total',
		value: params.matchCount,
		dimensions: {
			resource_type: params.resourceType,
			source: params.source,
		},
	});
}

export function recordPhotoDnaApiCall(params: {
	operation: 'hash' | 'match';
	status: CsamApiStatus;
	hashCount?: number;
}): void {
	recordCounter({
		name: 'fluxer.csam.photodna.api.total',
		dimensions: {
			operation: params.operation,
			status: params.status,
			hash_count: String(params.hashCount ?? 0),
		},
	});
}

export function recordPhotoDnaApiDuration(params: {operation: 'hash' | 'match'; durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.csam.photodna.api.duration_ms',
		valueMs: params.durationMs,
		dimensions: {
			operation: params.operation,
		},
	});
}

export type NcmecSubmissionOperation = 'report' | 'evidence' | 'fileinfo' | 'finish' | 'retract';

export function recordNcmecSubmission(params: {
	operation: NcmecSubmissionOperation;
	status: NcmecSubmissionStatus;
}): void {
	recordCounter({
		name: 'fluxer.csam.ncmec.submissions',
		dimensions: {
			operation: params.operation,
			status: params.status,
		},
	});
}

export function recordCsamEvidenceStorage(params: {
	status: EvidenceStorageStatus;
	evidenceType: 'package' | 'attachment' | 'frame';
}): void {
	recordCounter({
		name: 'fluxer.csam.evidence.stored',
		dimensions: {
			status: params.status,
			evidence_type: params.evidenceType,
		},
	});
}

export function recordCsamQueueProcessed(params: {status: 'success' | 'error' | 'timeout'; batchSize: number}): void {
	recordCounter({
		name: 'fluxer.csam.queue.processed',
		dimensions: {
			status: params.status,
			batch_size: String(params.batchSize),
		},
	});
}

export function recordCsamQueueWaitTime(params: {waitTimeMs: number}): void {
	recordHistogram({
		name: 'fluxer.csam.queue.wait_time_ms',
		valueMs: params.waitTimeMs,
	});
}

export function recordCsamQueueDepth(params: {depth: number}): void {
	recordCounter({
		name: 'fluxer.csam.queue.depth',
		value: params.depth,
	});
}

export type ArachnidApiStatus = 'success' | 'error' | 'timeout';

export function recordArachnidApiCall(params: {status: ArachnidApiStatus}): void {
	recordCounter({
		name: 'fluxer.csam.arachnid.api.total',
		dimensions: {
			status: params.status,
		},
	});
}

export function recordArachnidApiDuration(params: {durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.csam.arachnid.api.duration_ms',
		valueMs: params.durationMs,
	});
}
