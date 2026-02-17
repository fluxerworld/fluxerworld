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

import type {ChannelID, GuildID, InviteCode, UserID} from '@fluxer/api/src/BrandedTypes';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {
	mapInviteToGroupDmInviteMetadataResponse,
	mapInviteToGroupDmInviteResponse,
	mapInviteToGuildInviteMetadataResponse,
	mapInviteToGuildInviteResponse,
	mapInviteToPackInviteMetadataResponse,
	mapInviteToPackInviteResponse,
} from '@fluxer/api/src/invite/InviteModel';
import type {InviteService} from '@fluxer/api/src/invite/InviteService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Invite} from '@fluxer/api/src/models/Invite';
import type {PackRepository} from '@fluxer/api/src/pack/PackRepository';
import {InviteTypes} from '@fluxer/constants/src/ChannelConstants';
import {UnknownPackError} from '@fluxer/errors/src/domains/pack/UnknownPackError';
import type {ChannelPartialResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {GuildPartialResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {
	ChannelInviteCreateRequest,
	InviteMetadataResponseSchema,
	InviteResponseSchema,
	PackInviteCreateRequest,
} from '@fluxer/schema/src/domains/invite/InviteSchemas';

interface MappingHelpers {
	userCacheService: UserCacheService;
	requestCache: RequestCache;
	getChannelResponse: (channelId: ChannelID) => Promise<ChannelPartialResponse>;
	getChannelSystem: (channelId: ChannelID) => Promise<Channel | null>;
	getChannelMemberCount: (channelId: ChannelID) => Promise<number>;
	getGuildResponse: (guildId: GuildID) => Promise<GuildPartialResponse>;
	getGuildCounts: (guildId: GuildID) => Promise<{memberCount: number; presenceCount: number}>;
	packRepository: PackRepository;
	gatewayService: IGatewayService;
}

type InviteMetricAction = 'accepted' | 'created' | 'deleted';

function mapInviteType(inviteType: number): string {
	switch (inviteType) {
		case InviteTypes.GUILD:
			return 'guild';
		case InviteTypes.GROUP_DM:
			return 'group_dm';
		case InviteTypes.EMOJI_PACK:
			return 'emoji_pack';
		case InviteTypes.STICKER_PACK:
			return 'sticker_pack';
		default:
			return 'unknown';
	}
}

export class InviteRequestService {
	constructor(
		private readonly inviteService: InviteService,
		private readonly channelService: ChannelService,
		private readonly guildService: GuildService,
		private readonly gatewayService: IGatewayService,
		private readonly packRepository: PackRepository,
		private readonly userCacheService: UserCacheService,
	) {}

	async getInvite(params: {inviteCode: InviteCode; requestCache: RequestCache}): Promise<InviteResponseSchema> {
		const invite = await this.inviteService.getInvite(params.inviteCode);
		return this.mapInviteResponse(invite, params.requestCache);
	}

	async acceptInvite(params: {
		userId: UserID;
		inviteCode: InviteCode;
		requestCache: RequestCache;
	}): Promise<InviteResponseSchema> {
		const invite = await this.inviteService.acceptInvite(params);
		this.recordInviteMetric('accepted', invite);
		return this.mapInviteResponse(invite, params.requestCache);
	}

	async deleteInvite(params: {userId: UserID; inviteCode: InviteCode; auditLogReason?: string | null}): Promise<void> {
		const invite = await this.inviteService.getInvite(params.inviteCode);
		await this.inviteService.deleteInvite(
			{userId: params.userId, inviteCode: params.inviteCode},
			params.auditLogReason,
		);
		await this.inviteService.dispatchInviteDelete(invite);
		this.recordInviteMetric('deleted', invite);
	}

	async createChannelInvite(params: {
		inviterId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
		data: ChannelInviteCreateRequest;
		auditLogReason?: string | null;
	}): Promise<InviteMetadataResponseSchema> {
		const {invite, isNew} = await this.inviteService.createInvite(
			{
				inviterId: params.inviterId,
				channelId: params.channelId,
				maxUses: params.data.max_uses ?? 0,
				maxAge: params.data.max_age ?? 0,
				unique: params.data.unique ?? false,
				temporary: params.data.temporary ?? false,
			},
			params.auditLogReason,
		);
		const inviteData = await this.mapInviteMetadataResponse(invite, params.requestCache);
		if (isNew) {
			await this.inviteService.dispatchInviteCreate(invite, inviteData);
		}
		this.recordInviteMetric('created', invite, {is_new: isNew ? 'true' : 'false'});
		return inviteData;
	}

	async listChannelInvites(params: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
	}): Promise<Array<InviteMetadataResponseSchema>> {
		const invites = await this.inviteService.getChannelInvitesSorted({
			userId: params.userId,
			channelId: params.channelId,
		});
		return this.mapInviteList(invites, params.requestCache);
	}

	async listGuildInvites(params: {
		userId: UserID;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<InviteMetadataResponseSchema>> {
		const invites = await this.inviteService.getGuildInvitesSorted({
			userId: params.userId,
			guildId: params.guildId,
		});
		return this.mapInviteList(invites, params.requestCache);
	}

	async listPackInvites(params: {
		userId: UserID;
		packId: GuildID;
		requestCache: RequestCache;
	}): Promise<Array<InviteMetadataResponseSchema>> {
		const invites = await this.inviteService.getPackInvitesSorted({
			userId: params.userId,
			packId: params.packId,
		});
		return this.mapInviteList(invites, params.requestCache);
	}

	async createPackInvite(params: {
		inviterId: UserID;
		packId: GuildID;
		requestCache: RequestCache;
		data: PackInviteCreateRequest;
	}): Promise<InviteMetadataResponseSchema> {
		const pack = await this.packRepository.getPack(params.packId);
		if (!pack) {
			throw new UnknownPackError();
		}

		const {invite, isNew} = await this.inviteService.createPackInvite({
			inviterId: params.inviterId,
			packId: params.packId,
			packType: pack.type,
			maxUses: params.data.max_uses ?? 0,
			maxAge: params.data.max_age ?? 0,
			unique: params.data.unique ?? false,
		});
		const inviteData = await this.mapInviteMetadataResponse(invite, params.requestCache);
		if (isNew) {
			await this.inviteService.dispatchInviteCreate(invite, inviteData);
		}
		this.recordInviteMetric('created', invite, {is_new: isNew ? 'true' : 'false'});
		return inviteData;
	}

	private createMappingHelpers(requestCache: RequestCache): MappingHelpers {
		return {
			userCacheService: this.userCacheService,
			requestCache,
			getChannelResponse: async (channelId: ChannelID) => await this.channelService.getPublicChannelData(channelId),
			getChannelSystem: async (channelId: ChannelID) => await this.channelService.getChannelSystem(channelId),
			getChannelMemberCount: async (channelId: ChannelID) => await this.channelService.getChannelMemberCount(channelId),
			getGuildResponse: async (guildId: GuildID) => await this.guildService.getPublicGuildData(guildId),
			getGuildCounts: async (guildId: GuildID) => await this.gatewayService.getGuildCounts(guildId),
			packRepository: this.packRepository,
			gatewayService: this.gatewayService,
		};
	}

	private async mapInviteResponse(invite: Invite, requestCache: RequestCache): Promise<InviteResponseSchema> {
		const helpers = this.createMappingHelpers(requestCache);
		if (invite.type === InviteTypes.GROUP_DM) {
			return mapInviteToGroupDmInviteResponse({invite, ...helpers});
		}
		if (invite.type === InviteTypes.EMOJI_PACK || invite.type === InviteTypes.STICKER_PACK) {
			return mapInviteToPackInviteResponse({invite, ...helpers});
		}
		return mapInviteToGuildInviteResponse({invite, ...helpers});
	}

	private async mapInviteMetadataResponse(
		invite: Invite,
		requestCache: RequestCache,
	): Promise<InviteMetadataResponseSchema> {
		const helpers = this.createMappingHelpers(requestCache);
		if (invite.type === InviteTypes.GROUP_DM) {
			return mapInviteToGroupDmInviteMetadataResponse({invite, ...helpers});
		}
		if (invite.type === InviteTypes.EMOJI_PACK || invite.type === InviteTypes.STICKER_PACK) {
			return mapInviteToPackInviteMetadataResponse({invite, ...helpers});
		}
		return mapInviteToGuildInviteMetadataResponse({invite, ...helpers});
	}

	private async mapInviteList(
		invites: Array<Invite>,
		requestCache: RequestCache,
	): Promise<Array<InviteMetadataResponseSchema>> {
		return Promise.all(invites.map((invite) => this.mapInviteMetadataResponse(invite, requestCache)));
	}

	private recordInviteMetric(
		action: InviteMetricAction,
		invite: Invite,
		extraDimensions: Record<string, string> = {},
	): void {
		getMetricsService().counter({
			name: `fluxer.invites.${action}`,
			dimensions: {
				invite_type: mapInviteType(invite.type),
				...extraDimensions,
			},
		});
	}
}
