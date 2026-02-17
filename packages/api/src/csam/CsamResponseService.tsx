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
import {Config} from '@fluxer/api/src/Config';
import type {ChannelRepository} from '@fluxer/api/src/channel/ChannelRepository';
import {makeAttachmentCdnKey, makeAttachmentCdnUrl} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import {SYSTEM_USER_ID} from '@fluxer/api/src/constants/Core';
import type {CsamEvidenceService} from '@fluxer/api/src/csam/CsamEvidenceService';
import type {
	AttachmentEvidenceInfo,
	CsamScanJobPayload,
	EvidenceContext,
	FrameSample,
	PhotoDnaMatchResult,
} from '@fluxer/api/src/csam/CsamTypes';
import type {NcmecReporter} from '@fluxer/api/src/csam/NcmecReporter';
import type {UserContactChangeLogRow} from '@fluxer/api/src/database/types/UserTypes';
import type {GuildRepository} from '@fluxer/api/src/guild/repositories/GuildRepository';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Message} from '@fluxer/api/src/models/Message';
import type {User} from '@fluxer/api/src/models/User';
import type {IARMessageContextRow} from '@fluxer/api/src/report/IReportRepository';
import {ReportStatus, ReportType} from '@fluxer/api/src/report/IReportRepository';
import type {ReportRepository} from '@fluxer/api/src/report/ReportRepository';
import type {IReportSearchService} from '@fluxer/api/src/search/IReportSearchService';
import type {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import type {UserContactChangeLogService} from '@fluxer/api/src/user/services/UserContactChangeLogService';
import {CATEGORY_CHILD_SAFETY} from '@fluxer/constants/src/ReportCategories';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

interface CsamResponseServiceDeps {
	channelRepository: ChannelRepository;
	reportRepository: ReportRepository;
	reportSearchService?: IReportSearchService;
	storageService: IStorageService;
	userRepository: UserRepository;
	guildRepository: GuildRepository;
	csamEvidenceService: CsamEvidenceService;
	ncmecReporter: NcmecReporter;
	contactChangeLogService: UserContactChangeLogService;
}

interface CsamResponseArgs {
	reportId: bigint;
	job: CsamScanJobPayload;
	matchResult: PhotoDnaMatchResult;
	frames: Array<FrameSample>;
	hashes: Array<string>;
	message: Message | null;
}

export class CsamResponseService {
	constructor(private readonly deps: CsamResponseServiceDeps) {}

	async handleMatch(args: CsamResponseArgs): Promise<void> {
		const {reportId, job, matchResult, frames, hashes, message} = args;

		const attachmentInfo: Array<AttachmentEvidenceInfo> = message ? await this.copyAttachments(reportId, message) : [];

		const user = job.userId ? await this.deps.userRepository.findUnique(createUserID(BigInt(job.userId))) : null;
		const guild = job.guildId ? await this.deps.guildRepository.findUnique(createGuildID(BigInt(job.guildId))) : null;
		const channel = job.channelId
			? await this.deps.channelRepository.findUnique(createChannelID(BigInt(job.channelId)))
			: null;
		const channelSnapshot = channel ? channel.toRow() : null;

		const contactLogRows: Array<UserContactChangeLogRow> = user
			? await this.deps.contactChangeLogService.listLogs({userId: user.id, limit: 100})
			: [];
		const contactLogSnapshot =
			contactLogRows.length > 0
				? contactLogRows.map((entry) => ({
						eventId: entry.event_id.toString(),
						field: entry.field,
						oldValue: entry.old_value,
						newValue: entry.new_value,
						reason: entry.reason,
						actorUserId: entry.actor_user_id?.toString() ?? null,
						eventAt: entry.event_at ? entry.event_at.toISOString() : null,
					}))
				: null;

		const contextSnapshot: EvidenceContext = {
			message: message ? message.toRow() : null,
			user: user ? user.toRow() : null,
			guild: guild ? guild.toRow() : null,
			channel: channelSnapshot,
			attachments: attachmentInfo,
			contactLogs: contactLogSnapshot,
		};

		const evidenceResult = await this.deps.csamEvidenceService.storeEvidence({
			reportId,
			job,
			matchResult,
			frames,
			hashes,
			context: contextSnapshot,
		});

		const messageContextRows = message ? [this.buildMessageContextRow(message, user)] : null;

		const reportRow = {
			report_id: reportId,
			reporter_id: SYSTEM_USER_ID,
			reporter_email: null,
			reporter_full_legal_name: null,
			reporter_country_of_residence: null,
			reported_at: new Date(),
			status: ReportStatus.PENDING,
			report_type: ReportType.MESSAGE,
			category: CATEGORY_CHILD_SAFETY,
			additional_info: JSON.stringify({
				trackingId: matchResult.trackingId,
				matchDetails: matchResult.matchDetails,
				hashes,
				integrity: evidenceResult.integrityHash,
				evidenceZip: evidenceResult.evidenceZipKey,
			}),
			reported_user_id: job.userId ? createUserID(BigInt(job.userId)) : null,
			reported_user_avatar_hash: user?.avatarHash ?? null,
			reported_guild_id: job.guildId ? createGuildID(BigInt(job.guildId)) : null,
			reported_guild_name: guild?.name ?? null,
			reported_guild_icon_hash: guild?.iconHash ?? null,
			reported_message_id: job.messageId ? createMessageID(BigInt(job.messageId)) : null,
			reported_channel_id: job.channelId ? createChannelID(BigInt(job.channelId)) : null,
			reported_channel_name: channel?.name ?? null,
			message_context: messageContextRows,
			guild_context_id: job.guildId ? createGuildID(BigInt(job.guildId)) : null,
			resolved_at: null,
			resolved_by_admin_id: null,
			public_comment: null,
			audit_log_reason: `PhotoDNA match ${matchResult.trackingId}`,
			reported_guild_invite_code: null,
		};

		const createdReport = await this.deps.reportRepository.createReport(reportRow);

		if (this.deps.reportSearchService && 'indexReport' in this.deps.reportSearchService) {
			await this.deps.reportSearchService.indexReport(createdReport).catch((error) => {
				Logger.error({error, reportId: reportId.toString()}, 'Failed to index CSAM report in search');
			});
		}
	}

	private buildMessageContextRow(message: Message, user: User | null): IARMessageContextRow {
		const timestamp = snowflakeToDate(message.id);
		return {
			message_id: message.id,
			channel_id: message.channelId,
			author_id: message.authorId ?? 0n,
			author_username: user?.username ?? 'unknown',
			author_discriminator: user?.discriminator ?? 0,
			author_avatar_hash: user?.avatarHash ?? null,
			content: message.content,
			timestamp,
			edited_timestamp: message.editedTimestamp,
			type: message.type,
			flags: message.flags,
			mention_everyone: message.mentionEveryone,
			mention_users: message.mentionedUserIds.size > 0 ? message.mentionedUserIds : null,
			mention_roles: message.mentionedRoleIds.size > 0 ? message.mentionedRoleIds : null,
			mention_channels: message.mentionedChannelIds.size > 0 ? message.mentionedChannelIds : null,
			attachments: message.attachments.length > 0 ? message.attachments.map((att) => att.toMessageAttachment()) : null,
			embeds: message.embeds.length > 0 ? message.embeds.map((embed) => embed.toMessageEmbed()) : null,
			sticker_items:
				message.stickers.length > 0 ? message.stickers.map((sticker) => sticker.toMessageStickerItem()) : null,
		};
	}

	private async copyAttachments(reportId: bigint, message: Message): Promise<Array<AttachmentEvidenceInfo>> {
		const results: Array<AttachmentEvidenceInfo> = [];
		for (const attachment of message.attachments) {
			const sourceKey = makeAttachmentCdnKey(message.channelId, attachment.id, attachment.filename);
			const destKey = `csam/evidence/${reportId.toString()}/attachments/${attachment.id}/${attachment.filename}`;

			try {
				await this.deps.storageService.copyObject({
					sourceBucket: Config.s3.buckets.cdn,
					sourceKey,
					destinationBucket: Config.s3.buckets.reports,
					destinationKey: destKey,
				});
			} catch (error) {
				Logger.error(
					{error, attachmentId: attachment.id, reportId: reportId.toString()},
					'Failed to copy attachment for CSAM evidence',
				);
				continue;
			}

			results.push({
				attachmentId: attachment.id.toString(),
				filename: attachment.filename,
				contentType: attachment.contentType,
				size: Number(attachment.size),
				cdnUrl: makeAttachmentCdnUrl(message.channelId, attachment.id, attachment.filename),
				evidenceKey: destKey,
			});
		}
		return results;
	}
}
