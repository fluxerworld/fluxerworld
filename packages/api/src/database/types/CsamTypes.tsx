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

export interface CsamEvidencePackageRow {
	report_id: bigint;
	resource_type: string;
	bucket: string;
	key: string;
	cdn_url: string | null;
	filename: string;
	content_type: string | null;
	channel_id: bigint | null;
	message_id: bigint | null;
	guild_id: bigint | null;
	user_id: bigint | null;
	match_tracking_id: string | null;
	match_details: string | null;
	frames: string | null;
	hashes: string | null;
	context_snapshot: string | null;
	created_at: Date;
	expires_at: Date;
	integrity_sha256: string;
	evidence_zip_key: string;
}

export interface CsamEvidenceLegalHoldRow {
	report_id: bigint;
	held_until: Date | null;
	created_at: Date;
}

export interface CsamScanJobRow {
	job_id: string;
	resource_type: string;
	bucket: string | null;
	key: string | null;
	cdn_url: string | null;
	filename: string | null;
	content_type: string | null;
	channel_id: bigint | null;
	message_id: bigint | null;
	guild_id: bigint | null;
	user_id: bigint | null;
	status: string;
	enqueue_time: Date;
	last_updated: Date;
	match_tracking_id: string | null;
	match_details: string | null;
	hashes: string | null;
	error_message: string | null;
	expires_at: Date;
}

export const CSAM_EVIDENCE_PACKAGE_COLUMNS = [
	'report_id',
	'resource_type',
	'bucket',
	'key',
	'cdn_url',
	'filename',
	'content_type',
	'channel_id',
	'message_id',
	'guild_id',
	'user_id',
	'match_tracking_id',
	'match_details',
	'frames',
	'hashes',
	'context_snapshot',
	'created_at',
	'expires_at',
	'integrity_sha256',
	'evidence_zip_key',
] as const satisfies ReadonlyArray<keyof CsamEvidencePackageRow>;

export const CSAM_EVIDENCE_LEGAL_HOLD_COLUMNS = [
	'report_id',
	'held_until',
	'created_at',
] as const satisfies ReadonlyArray<keyof CsamEvidenceLegalHoldRow>;

export const CSAM_SCAN_JOB_COLUMNS = [
	'job_id',
	'resource_type',
	'bucket',
	'key',
	'cdn_url',
	'filename',
	'content_type',
	'channel_id',
	'message_id',
	'guild_id',
	'user_id',
	'status',
	'enqueue_time',
	'last_updated',
	'match_tracking_id',
	'match_details',
	'hashes',
	'error_message',
	'expires_at',
] as const satisfies ReadonlyArray<keyof CsamScanJobRow>;

export interface CsamEvidenceExpirationRow {
	bucket: string;
	expires_at: Date;
	report_id: bigint;
}

export const CSAM_EVIDENCE_EXPIRATION_COLUMNS = ['bucket', 'expires_at', 'report_id'] as const satisfies ReadonlyArray<
	keyof CsamEvidenceExpirationRow
>;

export interface NcmecSubmissionRow {
	report_id: bigint;
	status: string;
	ncmec_report_id: string | null;
	submitted_at: Date | null;
	submitted_by_admin_id: bigint | null;
	failure_reason: string | null;
	created_at: Date;
	updated_at: Date;
}

export const NCMEC_SUBMISSION_COLUMNS = [
	'report_id',
	'status',
	'ncmec_report_id',
	'submitted_at',
	'submitted_by_admin_id',
	'failure_reason',
	'created_at',
	'updated_at',
] as const satisfies ReadonlyArray<keyof NcmecSubmissionRow>;
