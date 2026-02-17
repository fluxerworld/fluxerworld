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
import {AdminGuildBulkService} from '@fluxer/api/src/admin/services/guild/AdminGuildBulkService';
import {AdminGuildLookupService} from '@fluxer/api/src/admin/services/guild/AdminGuildLookupService';
import {AdminGuildManagementService} from '@fluxer/api/src/admin/services/guild/AdminGuildManagementService';
import {AdminGuildMembershipService} from '@fluxer/api/src/admin/services/guild/AdminGuildMembershipService';
import {AdminGuildUpdatePropagator} from '@fluxer/api/src/admin/services/guild/AdminGuildUpdatePropagator';
import {AdminGuildUpdateService} from '@fluxer/api/src/admin/services/guild/AdminGuildUpdateService';
import {AdminGuildVanityService} from '@fluxer/api/src/admin/services/guild/AdminGuildVanityService';
import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {IGuildDiscoveryRepository} from '@fluxer/api/src/guild/repositories/GuildDiscoveryRepository';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {EntityAssetService} from '@fluxer/api/src/infrastructure/EntityAssetService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {InviteRepository} from '@fluxer/api/src/invite/InviteRepository';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {
	BanGuildMemberRequest,
	BulkAddGuildMembersRequest,
	BulkUpdateGuildFeaturesRequest,
	ClearGuildFieldsRequest,
	ForceAddUserToGuildRequest,
	KickGuildMemberRequest,
	ListGuildMembersRequest,
	ListUserGuildsRequest,
	LookupGuildRequest,
	TransferGuildOwnershipRequest,
	UpdateGuildNameRequest,
	UpdateGuildSettingsRequest,
	UpdateGuildVanityRequest,
} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import type {ListGuildEmojisResponse, ListGuildStickersResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';

interface AdminGuildServiceDeps {
	guildRepository: IGuildRepositoryAggregate;
	userRepository: IUserRepository;
	channelRepository: IChannelRepository;
	inviteRepository: InviteRepository;
	guildService: GuildService;
	gatewayService: IGatewayService;
	entityAssetService: EntityAssetService;
	auditService: AdminAuditService;
	discoveryRepository: IGuildDiscoveryRepository;
}

export class AdminGuildService {
	private readonly lookupService: AdminGuildLookupService;
	private readonly updateService: AdminGuildUpdateService;
	private readonly vanityService: AdminGuildVanityService;
	private readonly membershipService: AdminGuildMembershipService;
	private readonly bulkService: AdminGuildBulkService;
	private readonly managementService: AdminGuildManagementService;
	private readonly updatePropagator: AdminGuildUpdatePropagator;

	constructor(deps: AdminGuildServiceDeps) {
		this.updatePropagator = new AdminGuildUpdatePropagator({
			gatewayService: deps.gatewayService,
			discoveryRepository: deps.discoveryRepository,
		});

		this.lookupService = new AdminGuildLookupService({
			guildRepository: deps.guildRepository,
			userRepository: deps.userRepository,
			channelRepository: deps.channelRepository,
			gatewayService: deps.gatewayService,
		});

		this.updateService = new AdminGuildUpdateService({
			guildRepository: deps.guildRepository,
			entityAssetService: deps.entityAssetService,
			auditService: deps.auditService,
			updatePropagator: this.updatePropagator,
		});

		this.vanityService = new AdminGuildVanityService({
			guildRepository: deps.guildRepository,
			inviteRepository: deps.inviteRepository,
			auditService: deps.auditService,
			updatePropagator: this.updatePropagator,
		});

		this.membershipService = new AdminGuildMembershipService({
			userRepository: deps.userRepository,
			guildService: deps.guildService,
			auditService: deps.auditService,
		});

		this.bulkService = new AdminGuildBulkService({
			guildUpdateService: this.updateService,
			auditService: deps.auditService,
		});

		this.managementService = new AdminGuildManagementService({
			guildRepository: deps.guildRepository,
			gatewayService: deps.gatewayService,
			guildService: deps.guildService,
			auditService: deps.auditService,
		});
	}

	async lookupGuild(data: LookupGuildRequest) {
		return this.lookupService.lookupGuild(data);
	}

	async listUserGuilds(data: ListUserGuildsRequest) {
		return this.lookupService.listUserGuilds(data);
	}

	async listGuildMembers(data: ListGuildMembersRequest) {
		return this.lookupService.listGuildMembers(data);
	}

	async listGuildEmojis(guildId: GuildID): Promise<ListGuildEmojisResponse> {
		return this.lookupService.listGuildEmojis(guildId);
	}

	async listGuildStickers(guildId: GuildID): Promise<ListGuildStickersResponse> {
		return this.lookupService.listGuildStickers(guildId);
	}

	async updateGuildFeatures({
		guildId,
		addFeatures,
		removeFeatures,
		adminUserId,
		auditLogReason,
	}: {
		guildId: GuildID;
		addFeatures: Array<string>;
		removeFeatures: Array<string>;
		adminUserId: UserID;
		auditLogReason: string | null;
	}) {
		return this.updateService.updateGuildFeatures({
			guildId,
			addFeatures,
			removeFeatures,
			adminUserId,
			auditLogReason,
		});
	}

	async clearGuildFields(data: ClearGuildFieldsRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.updateService.clearGuildFields(data, adminUserId, auditLogReason);
	}

	async updateGuildName(data: UpdateGuildNameRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.updateService.updateGuildName(data, adminUserId, auditLogReason);
	}

	async updateGuildSettings(data: UpdateGuildSettingsRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.updateService.updateGuildSettings(data, adminUserId, auditLogReason);
	}

	async transferGuildOwnership(
		data: TransferGuildOwnershipRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	) {
		return this.updateService.transferGuildOwnership(data, adminUserId, auditLogReason);
	}

	async updateGuildVanity(data: UpdateGuildVanityRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.vanityService.updateGuildVanity(data, adminUserId, auditLogReason);
	}

	async forceAddUserToGuild({
		data,
		requestCache,
		adminUserId,
		auditLogReason,
	}: {
		data: ForceAddUserToGuildRequest;
		requestCache: RequestCache;
		adminUserId: UserID;
		auditLogReason: string | null;
	}) {
		return this.membershipService.forceAddUserToGuild({data, requestCache, adminUserId, auditLogReason});
	}

	async bulkAddGuildMembers(data: BulkAddGuildMembersRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.membershipService.bulkAddGuildMembers(data, adminUserId, auditLogReason);
	}

	async banGuildMember(data: BanGuildMemberRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.membershipService.banMember(data, adminUserId, auditLogReason);
	}

	async kickGuildMember(data: KickGuildMemberRequest, adminUserId: UserID, auditLogReason: string | null) {
		return this.membershipService.kickMember(data, adminUserId, auditLogReason);
	}

	async bulkUpdateGuildFeatures(
		data: BulkUpdateGuildFeaturesRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	) {
		return this.bulkService.bulkUpdateGuildFeatures(data, adminUserId, auditLogReason);
	}

	async reloadGuild(guildIdRaw: bigint, adminUserId: UserID, auditLogReason: string | null) {
		return this.managementService.reloadGuild(guildIdRaw, adminUserId, auditLogReason);
	}

	async shutdownGuild(guildIdRaw: bigint, adminUserId: UserID, auditLogReason: string | null) {
		return this.managementService.shutdownGuild(guildIdRaw, adminUserId, auditLogReason);
	}

	async deleteGuild(guildIdRaw: bigint, adminUserId: UserID, auditLogReason: string | null) {
		return this.managementService.deleteGuild(guildIdRaw, adminUserId, auditLogReason);
	}

	async getGuildMemoryStats(limit: number) {
		return this.managementService.getGuildMemoryStats(limit);
	}

	async reloadAllGuilds(guildIds: Array<GuildID>) {
		return this.managementService.reloadAllGuilds(guildIds);
	}

	async getNodeStats() {
		return this.managementService.getNodeStats();
	}
}
