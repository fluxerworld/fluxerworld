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

import type {ReportID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {NcmecReporter} from '@fluxer/api/src/csam/NcmecReporter';
import {fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {CsamEvidencePackageRow, NcmecSubmissionRow} from '@fluxer/api/src/database/types/CsamTypes';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type {IARSubmission} from '@fluxer/api/src/report/IReportRepository';
import type {ReportRepository} from '@fluxer/api/src/report/ReportRepository';
import {CsamEvidencePackages, NcmecSubmissions} from '@fluxer/api/src/Tables';
import {CATEGORY_CHILD_SAFETY} from '@fluxer/constants/src/ReportCategories';
import {NcmecAlreadySubmittedError} from '@fluxer/errors/src/domains/moderation/NcmecAlreadySubmittedError';
import {NcmecSubmissionFailedError} from '@fluxer/errors/src/domains/moderation/NcmecSubmissionFailedError';
import {UnknownReportError} from '@fluxer/errors/src/domains/moderation/UnknownReportError';
import {XMLBuilder} from 'fast-xml-parser';

export type NcmecSubmissionStatus = 'not_submitted' | 'submitted' | 'failed';

export interface NcmecSubmissionStatusResponse {
	status: NcmecSubmissionStatus;
	ncmec_report_id: string | null;
	submitted_at: string | null;
	submitted_by_admin_id: string | null;
	failure_reason: string | null;
}

export interface NcmecSubmitResult {
	success: boolean;
	ncmec_report_id: string | null;
	error: string | null;
}

interface NcmecSubmissionServiceDeps {
	reportRepository: ReportRepository;
	ncmecApi: NcmecReporter;
	storageService: IStorageService;
}

const GET_SUBMISSION_QUERY = NcmecSubmissions.select({
	where: NcmecSubmissions.where.eq('report_id'),
	limit: 1,
});

const GET_EVIDENCE_PACKAGE_QUERY = CsamEvidencePackages.select({
	where: CsamEvidencePackages.where.eq('report_id'),
	limit: 1,
});

export class NcmecSubmissionService {
	constructor(private readonly deps: NcmecSubmissionServiceDeps) {}

	async getSubmissionStatus(reportId: ReportID): Promise<NcmecSubmissionStatusResponse> {
		await this.requireChildSafetyReport(reportId);

		const submission = await fetchOne<NcmecSubmissionRow>(GET_SUBMISSION_QUERY.bind({report_id: BigInt(reportId)}));
		if (!submission) {
			return {
				status: 'not_submitted',
				ncmec_report_id: null,
				submitted_at: null,
				submitted_by_admin_id: null,
				failure_reason: null,
			};
		}

		return {
			status: submission.status as NcmecSubmissionStatus,
			ncmec_report_id: submission.ncmec_report_id,
			submitted_at: submission.submitted_at?.toISOString() ?? null,
			submitted_by_admin_id: submission.submitted_by_admin_id?.toString() ?? null,
			failure_reason: submission.failure_reason,
		};
	}

	async submitToNcmec(reportId: ReportID, adminUserId: UserID): Promise<NcmecSubmitResult> {
		const report = await this.requireChildSafetyReport(reportId);

		const existingSubmission = await fetchOne<NcmecSubmissionRow>(
			GET_SUBMISSION_QUERY.bind({report_id: BigInt(reportId)}),
		);
		if (existingSubmission?.status === 'submitted') {
			throw new NcmecAlreadySubmittedError();
		}

		const evidencePackage = await fetchOne<CsamEvidencePackageRow>(
			GET_EVIDENCE_PACKAGE_QUERY.bind({report_id: BigInt(reportId)}),
		);

		const reportXml = buildSimpleNcmecReportXml(report);
		let ncmecReportId: string | null = null;

		try {
			ncmecReportId = await this.deps.ncmecApi.submitReport(reportXml);

			if (evidencePackage?.evidence_zip_key) {
				const evidenceBuffer = await this.deps.storageService.readObject(
					Config.s3.buckets.reports,
					evidencePackage.evidence_zip_key,
				);
				await this.deps.ncmecApi.uploadEvidence(ncmecReportId, new Uint8Array(evidenceBuffer), 'evidence.zip');
			}

			await this.deps.ncmecApi.finish(ncmecReportId);

			await this.writeSubmissionRow({
				reportId,
				adminUserId,
				existingCreatedAt: existingSubmission?.created_at ?? null,
				status: 'submitted',
				ncmecReportId,
				failureReason: null,
				submittedAt: new Date(),
			});

			Logger.info(
				{reportId: reportId.toString(), adminUserId: adminUserId.toString()},
				'NCMEC report submitted successfully',
			);

			return {success: true, ncmec_report_id: ncmecReportId, error: null};
		} catch (error) {
			if (ncmecReportId) {
				try {
					await this.deps.ncmecApi.retract(ncmecReportId);
				} catch (retractError) {
					Logger.warn(
						{error: retractError, reportId: reportId.toString()},
						'Failed to retract failed NCMEC submission',
					);
				}
			}

			const errorMessage = error instanceof Error ? error.message : 'Unknown error';

			await this.writeSubmissionRow({
				reportId,
				adminUserId,
				existingCreatedAt: existingSubmission?.created_at ?? null,
				status: 'failed',
				ncmecReportId: null,
				failureReason: errorMessage,
				submittedAt: null,
			});

			Logger.error(
				{error, reportId: reportId.toString(), adminUserId: adminUserId.toString()},
				'NCMEC report submission failed',
			);
			throw new NcmecSubmissionFailedError(errorMessage);
		}
	}

	private async requireChildSafetyReport(reportId: ReportID): Promise<IARSubmission> {
		const report = await this.deps.reportRepository.getReport(reportId);
		if (!report || report.category !== CATEGORY_CHILD_SAFETY) {
			throw new UnknownReportError();
		}
		return report;
	}

	private async writeSubmissionRow(args: {
		reportId: ReportID;
		adminUserId: UserID;
		existingCreatedAt: Date | null;
		status: 'submitted' | 'failed';
		ncmecReportId: string | null;
		failureReason: string | null;
		submittedAt: Date | null;
	}): Promise<void> {
		const now = new Date();
		const row: NcmecSubmissionRow = {
			report_id: BigInt(args.reportId),
			status: args.status,
			ncmec_report_id: args.ncmecReportId,
			submitted_at: args.submittedAt,
			submitted_by_admin_id: BigInt(args.adminUserId),
			failure_reason: args.failureReason,
			created_at: args.existingCreatedAt ?? now,
			updated_at: now,
		};

		await upsertOne(NcmecSubmissions.insert(row));
	}
}

function buildSimpleNcmecReportXml(report: IARSubmission): string {
	const schemaRoot = (Config.ncmec.baseUrl ?? 'https://report.cybertip.org/ispws').replace(/\/+$/, '');
	const schemaLocation = `${schemaRoot}/xsd`;

	const incidentSummary: Record<string, unknown> = {
		incidentType: 'Child Pornography (possession, manufacture, and distribution)',
		incidentDateTime: report.reportedAt.toISOString(),
	};

	if (report.additionalInfo) {
		incidentSummary.additionalInfo = report.additionalInfo;
	}

	const reportingPerson: Record<string, unknown> = {};
	if (report.reporterEmail) reportingPerson.email = report.reporterEmail;

	const {firstName, lastName} = splitName(report.reporterFullLegalName);
	if (firstName) reportingPerson.firstName = firstName;
	if (lastName) reportingPerson.lastName = lastName;

	const reportNode: Record<string, unknown> = {
		'@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
		'@_xsi:noNamespaceSchemaLocation': schemaLocation,
		incidentSummary,
	};

	if (Object.keys(reportingPerson).length > 0) {
		reportNode.reporter = {reportingPerson};
	}

	const builder = new XMLBuilder({
		attributeNamePrefix: '@_',
		format: false,
		ignoreAttributes: false,
		suppressEmptyNode: true,
	});

	return `<?xml version="1.0" encoding="UTF-8"?>${builder.build({report: reportNode})}`;
}

function splitName(fullName: string | null): {firstName?: string; lastName?: string} {
	const trimmed = (fullName ?? '').trim();
	if (!trimmed) return {};

	const parts = trimmed.split(/\s+/);
	if (parts.length === 1) return {firstName: parts[0]};

	const [firstName, ...rest] = parts;
	return {firstName, lastName: rest.join(' ')};
}
