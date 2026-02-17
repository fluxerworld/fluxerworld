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

import type {ChannelID, EmojiID, GuildID, RoleID, StickerID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {GuildAuditLogChange} from '@fluxer/api/src/guild/GuildAuditLogTypes';
import {mapGuildToGuildResponse} from '@fluxer/api/src/guild/GuildModel';
import {GuildRepository} from '@fluxer/api/src/guild/repositories/GuildRepository';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Guild} from '@fluxer/api/src/models/Guild';
import {serializeGuildForAudit as serializeGuildForAuditUtil} from '@fluxer/api/src/utils/AuditSerializationUtils';
import {requirePermission} from '@fluxer/api/src/utils/PermissionUtils';
import type {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

interface GuildAuth {
	guildData: GuildResponse;
	checkPermission: (permission: bigint) => Promise<void>;
}

export class GuildDataHelpers {
	constructor(
		private readonly gatewayService: IGatewayService,
		private readonly guildAuditLogService: GuildAuditLogService,
	) {}
	private readonly guildRepository = new GuildRepository();

	async getGuildAuthenticated(params: {userId: UserID; guildId: GuildID}): Promise<GuildAuth> {
		const {userId, guildId} = params;
		try {
			const guildData = await this.gatewayService.getGuildData({guildId, userId});
			if (!guildData) throw new UnknownGuildError();
			return this.createGuildAuth({guildData, guildId, userId});
		} catch (error) {
			if (error instanceof UnknownGuildError && (await this.guildExists(guildId))) {
				throw new AccessDeniedError();
			}
			throw error;
		}
	}

	private createGuildAuth(params: {guildData: GuildResponse; guildId: GuildID; userId: UserID}): GuildAuth {
		const {guildData, guildId, userId} = params;
		const checkPermission = async (permission: bigint) => {
			await requirePermission(this.gatewayService, {guildId, userId, permission});
		};
		return {guildData, checkPermission};
	}

	private async guildExists(guildId: GuildID): Promise<boolean> {
		const guild = await this.guildRepository.findUnique(guildId);
		return guild !== null;
	}

	serializeGuildForAudit(guild: Guild): Record<string, unknown> {
		return serializeGuildForAuditUtil(guild);
	}

	computeGuildChanges(
		previousSnapshot: Record<string, unknown> | null,
		guildOrSnapshot: Guild | Record<string, unknown> | null,
	): GuildAuditLogChange {
		const currentSnapshot = guildOrSnapshot
			? 'id' in guildOrSnapshot
				? this.serializeGuildForAudit(guildOrSnapshot as Guild)
				: guildOrSnapshot
			: null;
		return this.guildAuditLogService.computeChanges(previousSnapshot, currentSnapshot);
	}

	async dispatchGuildUpdate(guild: Guild): Promise<void> {
		await this.gatewayService.dispatchGuild({
			guildId: guild.id,
			event: 'GUILD_UPDATE',
			data: mapGuildToGuildResponse(guild),
		});
	}

	async recordAuditLog(params: {
		guildId: GuildID;
		userId: UserID;
		action: AuditLogActionType;
		targetId?: GuildID | ChannelID | RoleID | UserID | EmojiID | StickerID | string | null;
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
