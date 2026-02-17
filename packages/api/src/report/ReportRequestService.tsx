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

import {createChannelID, createGuildID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import type {User} from '@fluxer/api/src/models/User';
import {type ReportStatus, reportStatusToString} from '@fluxer/api/src/report/IReportRepository';
import type {ReportService} from '@fluxer/api/src/report/ReportService';
import type {
	DsaReportEmailSendRequest,
	DsaReportEmailVerifyRequest,
	DsaReportRequest,
	ReportGuildRequest,
	ReportMessageRequest,
	ReportResponse,
	ReportUserRequest,
	TicketResponse,
} from '@fluxer/schema/src/domains/report/ReportSchemas';

interface ReportUserRequestContext<T> {
	user: User;
	data: T;
}

interface ReportDsaRequestContext<T> {
	data: T;
}

interface ReportRecord {
	reportId: bigint;
	status: ReportStatus;
	reportedAt: Date;
}

export class ReportRequestService {
	constructor(private reportService: ReportService) {}

	async reportMessage({user, data}: ReportUserRequestContext<ReportMessageRequest>): Promise<ReportResponse> {
		const report = await this.reportService.reportMessage(
			this.createReporter(user),
			createChannelID(data.channel_id),
			createMessageID(data.message_id),
			data.category,
			data.additional_info,
		);
		return this.toReportResponse(report);
	}

	async reportUser({user, data}: ReportUserRequestContext<ReportUserRequest>): Promise<ReportResponse> {
		const report = await this.reportService.reportUser(
			this.createReporter(user),
			createUserID(data.user_id),
			data.category,
			data.additional_info,
			data.guild_id ? createGuildID(data.guild_id) : undefined,
		);
		return this.toReportResponse(report);
	}

	async reportGuild({user, data}: ReportUserRequestContext<ReportGuildRequest>): Promise<ReportResponse> {
		const report = await this.reportService.reportGuild(
			this.createReporter(user),
			createGuildID(data.guild_id),
			data.category,
			data.additional_info,
		);
		return this.toReportResponse(report);
	}

	async sendDsaReportVerificationEmail({data}: ReportDsaRequestContext<DsaReportEmailSendRequest>): Promise<void> {
		await this.reportService.sendDsaReportVerificationCode(data.email);
	}

	async verifyDsaReportEmail({data}: ReportDsaRequestContext<DsaReportEmailVerifyRequest>): Promise<TicketResponse> {
		const ticket = await this.reportService.verifyDsaReportEmail(data.email, data.code);
		return {ticket};
	}

	async createDsaReport({data}: ReportDsaRequestContext<DsaReportRequest>): Promise<ReportResponse> {
		const report = await this.reportService.createDsaReport(data);
		return this.toReportResponse(report);
	}

	private createReporter(user: User) {
		return {
			id: user.id,
			email: user.email,
			fullLegalName: null,
			countryOfResidence: null,
		};
	}

	private toReportResponse(report: ReportRecord): ReportResponse {
		return {
			report_id: report.reportId.toString(),
			status: reportStatusToString(report.status),
			reported_at: report.reportedAt.toISOString(),
		};
	}
}
