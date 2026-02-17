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

import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {ChannelID, GuildID, ReportID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createReportID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {makeAttachmentCdnKey} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {MessageAttachment} from '@fluxer/api/src/database/types/MessageTypes';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {createRequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {IARMessageContext, IARSubmission} from '@fluxer/api/src/report/IReportRepository';
import type {ReportService} from '@fluxer/api/src/report/ReportService';
import {getReportSearchService} from '@fluxer/api/src/SearchFactory';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import type {SearchReportsRequest} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {seconds} from 'itty-time';

interface AdminReportServiceDeps {
	reportService: ReportService;
	userRepository: IUserRepository;
	emailService: IEmailService;
	storageService: IStorageService;
	auditService: AdminAuditService;
	userCacheService: UserCacheService;
}

export class AdminReportService {
	constructor(private readonly deps: AdminReportServiceDeps) {}

	async listReports(status: number, limit?: number, offset?: number) {
		const {reportService} = this.deps;
		const requestedLimit = limit || 50;
		const currentOffset = offset || 0;

		const reports = await reportService.listReportsByStatus(status, requestedLimit, currentOffset);
		const requestCache = createRequestCache();
		const reportResponses = await Promise.all(
			reports.map((report: IARSubmission) => this.mapReportToResponse(report, false, requestCache)),
		);

		return {
			reports: reportResponses,
		};
	}

	async getReport(reportId: ReportID) {
		const {reportService} = this.deps;
		const report = await reportService.getReport(reportId);
		const requestCache = createRequestCache();
		return this.mapReportToResponse(report, true, requestCache);
	}

	async resolveReport(
		reportId: ReportID,
		adminUserId: UserID,
		publicComment: string | null,
		auditLogReason: string | null,
	) {
		const {reportService, userRepository, emailService, auditService} = this.deps;
		const resolvedReport = await reportService.resolveReport(reportId, adminUserId, publicComment, auditLogReason);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'report',
			targetId: BigInt(reportId),
			action: 'resolve_report',
			auditLogReason,
			metadata: new Map([
				['report_id', reportId.toString()],
				['report_type', resolvedReport.reportType.toString()],
			]),
		});

		if (resolvedReport.reporterId && publicComment) {
			const reporter = await userRepository.findUnique(resolvedReport.reporterId);
			if (reporter?.email) {
				await emailService.sendReportResolvedEmail(
					reporter.email,
					reporter.username,
					reportId.toString(),
					publicComment,
					reporter.locale,
				);
			}
		}

		return {
			report_id: resolvedReport.reportId.toString(),
			status: resolvedReport.status,
			resolved_at: resolvedReport.resolvedAt?.toISOString() ?? null,
			public_comment: resolvedReport.publicComment,
		};
	}

	async searchReports(data: SearchReportsRequest) {
		const reportSearchService = getReportSearchService();
		if (!reportSearchService) {
			throw new Error('Search is not enabled');
		}

		const filters: Record<string, string | number> = {};
		if (data.reporter_id !== undefined) {
			filters['reporterId'] = data.reporter_id.toString();
		}
		if (data.status !== undefined) {
			filters['status'] = data.status;
		}
		if (data.report_type !== undefined) {
			filters['reportType'] = data.report_type;
		}
		if (data.category !== undefined) {
			filters['category'] = data.category;
		}
		if (data.reported_user_id !== undefined) {
			filters['reportedUserId'] = data.reported_user_id.toString();
		}
		if (data.reported_guild_id !== undefined) {
			filters['reportedGuildId'] = data.reported_guild_id.toString();
		}
		if (data.reported_channel_id !== undefined) {
			filters['reportedChannelId'] = data.reported_channel_id.toString();
		}
		if (data.guild_context_id !== undefined) {
			filters['guildContextId'] = data.guild_context_id.toString();
		}
		if (data.resolved_by_admin_id !== undefined) {
			filters['resolvedByAdminId'] = data.resolved_by_admin_id.toString();
		}
		if (data.sort_by) {
			filters['sortBy'] = data.sort_by;
		}
		if (data.sort_order) {
			filters['sortOrder'] = data.sort_order;
		}

		const {hits, total} = await reportSearchService.searchReports(data.query || '', filters, {
			limit: data.limit,
			offset: data.offset,
		});

		const requestCache = createRequestCache();
		const orderedReports = await this.loadReportsInSearchOrder(hits.map((hit) => createReportID(BigInt(hit.id))));
		const reports = await Promise.all(
			orderedReports.map((report) => this.mapReportToResponse(report, false, requestCache)),
		);

		return {
			reports,
			total,
			offset: data.offset,
			limit: data.limit,
		};
	}

	private async loadReportsInSearchOrder(reportIds: Array<ReportID>): Promise<Array<IARSubmission>> {
		const reports = await Promise.all(
			reportIds.map(async (reportId) => {
				try {
					return await this.deps.reportService.getReport(reportId);
				} catch (_error) {
					return null;
				}
			}),
		);
		return reports.filter((report): report is IARSubmission => report !== null);
	}

	private async mapReportToResponse(report: IARSubmission, includeContext: boolean, requestCache: RequestCache) {
		const reporterInfo = await this.buildUserTag(report.reporterId, requestCache);
		const reportedUserInfo = await this.buildUserTag(report.reportedUserId, requestCache);

		const baseResponse = {
			report_id: report.reportId.toString(),
			reporter_id: report.reporterId?.toString() ?? null,
			reporter_tag: reporterInfo?.tag ?? null,
			reporter_username: reporterInfo?.username ?? null,
			reporter_discriminator: reporterInfo?.discriminator ?? null,
			reporter_email: report.reporterEmail,
			reporter_full_legal_name: report.reporterFullLegalName,
			reporter_country_of_residence: report.reporterCountryOfResidence,
			reported_at: report.reportedAt.toISOString(),
			status: report.status,
			report_type: report.reportType,
			category: report.category,
			additional_info: report.additionalInfo,
			reported_user_id: report.reportedUserId?.toString() ?? null,
			reported_user_tag: reportedUserInfo?.tag ?? null,
			reported_user_username: reportedUserInfo?.username ?? null,
			reported_user_discriminator: reportedUserInfo?.discriminator ?? null,
			reported_user_avatar_hash: report.reportedUserAvatarHash,
			reported_guild_id: report.reportedGuildId?.toString() ?? null,
			reported_guild_name: report.reportedGuildName,
			reported_message_id: report.reportedMessageId?.toString() ?? null,
			reported_channel_id: report.reportedChannelId?.toString() ?? null,
			reported_channel_name: report.reportedChannelName,
			reported_guild_invite_code: report.reportedGuildInviteCode,
			resolved_at: report.resolvedAt?.toISOString() ?? null,
			resolved_by_admin_id: report.resolvedByAdminId?.toString() ?? null,
			public_comment: report.publicComment,
		};

		if (!includeContext) {
			return baseResponse;
		}

		const messageContext =
			report.messageContext && report.messageContext.length > 0
				? await Promise.all(
						report.messageContext.map((message) =>
							this.mapReportMessageContextToResponse(
								message,
								report.reportedChannelId ?? null,
								report.reportedGuildId ?? report.guildContextId ?? null,
							),
						),
					)
				: [];
		const mutualDmChannelId = await this.getMutualDmChannelId(report);

		return {
			...baseResponse,
			mutual_dm_channel_id: mutualDmChannelId,
			message_context: messageContext,
		};
	}

	private async getMutualDmChannelId(report: IARSubmission): Promise<string | null> {
		if (report.reportType !== 1 || !report.reporterId || !report.reportedUserId) {
			return null;
		}

		const mutualDmChannel = await this.deps.userRepository.findExistingDmState(
			report.reporterId,
			report.reportedUserId,
		);
		return mutualDmChannel ? mutualDmChannel.id.toString() : null;
	}

	private async mapReportMessageContextToResponse(
		message: IARMessageContext,
		fallbackChannelId: ChannelID | null,
		fallbackGuildId: GuildID | null,
	) {
		const channelId = message.channelId ?? fallbackChannelId;
		const attachments =
			message.attachments && message.attachments.length > 0
				? (
						await Promise.all(
							message.attachments.map((attachment) => this.mapReportAttachmentToResponse(attachment, channelId)),
						)
					).filter((attachment): attachment is {filename: string; url: string} => attachment !== null)
				: [];

		return {
			id: message.messageId.toString(),
			channel_id: channelId ? channelId.toString() : '',
			guild_id: fallbackGuildId ? fallbackGuildId.toString() : null,
			content: message.content ?? '',
			timestamp: message.timestamp.toISOString(),
			attachments,
			author_id: message.authorId.toString(),
			author_username: message.authorUsername,
			author_discriminator: message.authorDiscriminator.toString().padStart(4, '0'),
		};
	}

	private async mapReportAttachmentToResponse(
		attachment: MessageAttachment,
		channelId: ChannelID | null,
	): Promise<{filename: string; url: string} | null> {
		if (!attachment || attachment.attachment_id == null || !attachment.filename || !channelId) {
			return null;
		}

		const {storageService} = this.deps;
		const attachmentId = attachment.attachment_id;
		const filename = String(attachment.filename);
		const key = makeAttachmentCdnKey(channelId, attachmentId, filename);

		try {
			const url = await storageService.getPresignedDownloadURL({
				bucket: Config.s3.buckets.reports,
				key,
				expiresIn: seconds('5 minutes'),
			});
			return {filename, url};
		} catch (error) {
			Logger.error(
				{error, attachmentId, filename, channelId},
				'Failed to generate presigned URL for report attachment',
			);
		}
		return null;
	}

	private async buildUserTag(userId: UserID | null, requestCache: RequestCache): Promise<UserTagInfo | null> {
		if (!userId) {
			return null;
		}

		try {
			const user = await this.deps.userCacheService.getUserPartialResponse(userId, requestCache);
			const discriminator = user.discriminator?.padStart(4, '0') ?? '0000';
			return {tag: `${user.username}#${discriminator}`, username: user.username, discriminator};
		} catch (error) {
			Logger.warn({userId: userId.toString(), error}, 'Failed to resolve user tag for report');
			return null;
		}
	}
}

interface UserTagInfo {
	tag: string;
	username: string;
	discriminator: string;
}
