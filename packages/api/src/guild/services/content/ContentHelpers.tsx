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

import type {EmojiID, GuildID, StickerID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {GuildAuditLogChange} from '@fluxer/api/src/guild/GuildAuditLogTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {GuildEmoji} from '@fluxer/api/src/models/GuildEmoji';
import type {GuildSticker} from '@fluxer/api/src/models/GuildSticker';
import {serializeEmojiForAudit, serializeStickerForAudit} from '@fluxer/api/src/utils/AuditSerializationUtils';
import {hasPermission, requirePermission} from '@fluxer/api/src/utils/PermissionUtils';
import type {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';

export class ContentHelpers {
	constructor(
		private readonly gatewayService: IGatewayService,
		public readonly guildAuditLogService: GuildAuditLogService,
	) {}

	async getGuildData(params: {userId: UserID; guildId: GuildID}) {
		const {userId, guildId} = params;
		const guildData = await this.gatewayService.getGuildData({guildId, userId});
		return guildData;
	}

	async checkPermission(params: {userId: UserID; guildId: GuildID; permission: bigint}) {
		const {userId, guildId, permission} = params;
		await requirePermission(this.gatewayService, {guildId, userId, permission});
	}

	async checkManageExpressionsPermission(params: {userId: UserID; guildId: GuildID}) {
		return this.checkPermission({...params, permission: Permissions.MANAGE_EXPRESSIONS});
	}

	async checkCreateExpressionsPermission(params: {userId: UserID; guildId: GuildID}) {
		return this.checkPermission({...params, permission: Permissions.CREATE_EXPRESSIONS});
	}

	async checkModifyExpressionPermission(params: {userId: UserID; guildId: GuildID; creatorId: UserID}) {
		const {userId, guildId, creatorId} = params;
		if (userId === creatorId) {
			return this.checkCreateExpressionsPermission({userId, guildId});
		}
		return this.checkManageExpressionsPermission({userId, guildId});
	}

	async hasManageExpressionsPermission(params: {userId: UserID; guildId: GuildID}): Promise<boolean> {
		const {userId, guildId} = params;
		return hasPermission(this.gatewayService, {guildId, userId, permission: Permissions.MANAGE_EXPRESSIONS});
	}

	serializeEmojiForAudit(emoji: GuildEmoji): Record<string, unknown> {
		return serializeEmojiForAudit(emoji);
	}

	serializeStickerForAudit(sticker: GuildSticker): Record<string, unknown> {
		return serializeStickerForAudit(sticker);
	}

	async recordAuditLog(params: {
		guildId: GuildID;
		userId: UserID;
		action: AuditLogActionType;
		targetId?: GuildID | EmojiID | StickerID | string | null;
		auditLogReason?: string | null;
		metadata?: Map<string, string> | Record<string, string>;
		changes?: GuildAuditLogChange | null;
		createdAt?: Date;
	}): Promise<void> {
		const targetId =
			params.targetId === undefined || params.targetId === null
				? null
				: typeof params.targetId === 'string'
					? params.targetId
					: params.targetId.toString();

		try {
			const builder = this.guildAuditLogService
				.createBuilder(params.guildId, params.userId)
				.withAction(params.action, targetId)
				.withReason(params.auditLogReason ?? null);

			if (params.metadata) {
				builder.withMetadata(params.metadata);
			}
			if (params.changes) {
				builder.withChanges(params.changes);
			}
			if (params.createdAt) {
				builder.withCreatedAt(params.createdAt);
			}

			await builder.commit();
		} catch (error) {
			Logger.error(
				{
					error,
					guildId: params.guildId.toString(),
					userId: params.userId.toString(),
					action: params.action,
					targetId,
				},
				'Failed to record guild audit log',
			);
		}
	}
}
