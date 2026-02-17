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

import type {ChannelID, GuildID, RoleID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createChannelID, createGuildID, createRoleID, createUserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {ChannelAuthService} from '@fluxer/api/src/channel/services/channel_data/ChannelAuthService';
import type {ChannelUtilsService} from '@fluxer/api/src/channel/services/channel_data/ChannelUtilsService';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import {mapGuildToGuildResponse} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import {ChannelHelpers} from '@fluxer/api/src/guild/services/channel/ChannelHelpers';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {ILiveKitService} from '@fluxer/api/src/infrastructure/ILiveKitService';
import type {IVoiceRoomStore} from '@fluxer/api/src/infrastructure/IVoiceRoomStore';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {IInviteRepository} from '@fluxer/api/src/invite/IInviteRepository';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import {ChannelPermissionOverwrite} from '@fluxer/api/src/models/ChannelPermissionOverwrite';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {serializeChannelForAudit} from '@fluxer/api/src/utils/AuditSerializationUtils';
import type {VoiceAvailabilityService} from '@fluxer/api/src/voice/VoiceAvailabilityService';
import type {VoiceRegionAvailability} from '@fluxer/api/src/voice/VoiceModel';
import type {IWebhookRepository} from '@fluxer/api/src/webhook/IWebhookRepository';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {ALL_PERMISSIONS, ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {MAX_CHANNELS_PER_CATEGORY} from '@fluxer/constants/src/LimitConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InvalidChannelTypeError} from '@fluxer/errors/src/domains/channel/InvalidChannelTypeError';
import {MaxCategoryChannelsError} from '@fluxer/errors/src/domains/channel/MaxCategoryChannelsError';
import {UnknownChannelError} from '@fluxer/errors/src/domains/channel/UnknownChannelError';
import {CannotExecuteOnDmError} from '@fluxer/errors/src/domains/core/CannotExecuteOnDmError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import {ChannelNameType} from '@fluxer/schema/src/primitives/ChannelValidators';

export interface ChannelUpdateData {
	name?: string;
	topic?: string | null;
	url?: string | null;
	parent_id?: bigint | null;
	bitrate?: number | null;
	user_limit?: number | null;
	nsfw?: boolean;
	rate_limit_per_user?: number;
	permission_overwrites?: Array<{
		id: bigint;
		type: number;
		allow?: bigint;
		deny?: bigint;
	}> | null;
	rtc_region?: string | null;
	icon?: string | null;
	owner_id?: bigint | null;
	nicks?: Record<string, string | null> | null;
}

export class ChannelOperationsService {
	constructor(
		private channelRepository: IChannelRepositoryAggregate,
		private userRepository: IUserRepository,
		private gatewayService: IGatewayService,
		private channelAuthService: ChannelAuthService,
		private channelUtilsService: ChannelUtilsService,
		private voiceRoomStore: IVoiceRoomStore,
		private liveKitService: ILiveKitService,
		private voiceAvailabilityService: VoiceAvailabilityService | undefined,
		private readonly guildAuditLogService: GuildAuditLogService,
		private inviteRepository: IInviteRepository,
		private webhookRepository: IWebhookRepository,
		private guildRepository: IGuildRepositoryAggregate,
		private limitConfigService: LimitConfigService,
	) {}

	async getChannel({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<Channel> {
		const {channel} = await this.channelAuthService.getChannelAuthenticated({userId, channelId});
		return channel;
	}

	async getPublicChannelData(channelId: ChannelID) {
		const channel = await this.channelRepository.channelData.findUnique(channelId);
		if (!channel) throw new UnknownChannelError();
		return channel;
	}

	async getChannelMemberCount(channelId: ChannelID): Promise<number> {
		const channel = await this.channelRepository.channelData.findUnique(channelId);
		if (!channel) throw new UnknownChannelError();
		return channel.recipientIds.size;
	}

	async getChannelSystem(channelId: ChannelID): Promise<Channel | null> {
		return await this.channelRepository.channelData.findUnique(channelId);
	}

	async editChannel({
		userId,
		channelId,
		data,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		data: ChannelUpdateData;
		requestCache: RequestCache;
	}): Promise<Channel> {
		const {channel, guild, checkPermission} = await this.channelAuthService.getChannelAuthenticated({
			userId,
			channelId,
		});

		if (channel.type === ChannelTypes.GROUP_DM) {
			throw new InvalidChannelTypeError();
		}

		if (!guild) throw new MissingPermissionsError();
		await checkPermission(Permissions.MANAGE_CHANNELS);

		const guildIdValue = createGuildID(BigInt(guild.id));

		let channelName = data.name ?? channel.name;
		if (data.name !== undefined && channel.type === ChannelTypes.GUILD_TEXT) {
			const hasFlexibleNamesEnabled = guild.features?.includes(GuildFeatures.TEXT_CHANNEL_FLEXIBLE_NAMES) ?? false;
			if (!hasFlexibleNamesEnabled) {
				channelName = ChannelNameType.parse(data.name);
			}
		}

		if (data.rtc_region !== undefined && channel.type === ChannelTypes.GUILD_VOICE) {
			await checkPermission(Permissions.UPDATE_RTC_REGION);

			if (data.rtc_region !== null) {
				if (this.voiceAvailabilityService) {
					const guildId = createGuildID(BigInt(guild.id));
					const availableRegions = this.voiceAvailabilityService.getAvailableRegions({
						requestingUserId: userId,
						guildId,
						guildFeatures: new Set(guild.features ?? []),
					});
					const regionAllowed = availableRegions.some((region) => region.id === data.rtc_region && region.isAccessible);

					if (!regionAllowed) {
						throw InputValidationError.fromCode('rtc_region', ValidationErrorCodes.INVALID_OR_RESTRICTED_RTC_REGION, {
							region: data.rtc_region ?? 'unknown',
						});
					}
				} else if (this.liveKitService) {
					const availableRegions = this.liveKitService.getRegionMetadata().map((region) => region.id);
					if (availableRegions.length > 0 && !availableRegions.includes(data.rtc_region)) {
						throw InputValidationError.fromCode('rtc_region', ValidationErrorCodes.INVALID_RTC_REGION, {
							region: data.rtc_region ?? 'unknown',
							availableRegions: availableRegions.join(', '),
						});
					}
				}
			}
		}

		const previousPermissionOverwrites = channel.permissionOverwrites;
		let permissionOverwrites = channel.permissionOverwrites;
		if (data.permission_overwrites !== undefined) {
			const guildId = createGuildID(BigInt(guild.id));
			const isOwner = guild.owner_id === userId.toString();
			const channelPermissions = await this.gatewayService.getUserPermissions({
				guildId,
				userId,
				channelId: channel.id,
			});

			if (!isOwner) {
				for (const overwrite of data.permission_overwrites ?? []) {
					const allowPerms = overwrite.allow ? BigInt(overwrite.allow) : 0n;
					const denyPerms = overwrite.deny ? BigInt(overwrite.deny) : 0n;
					const combinedPerms = (allowPerms | denyPerms) & ALL_PERMISSIONS;

					if ((combinedPerms & ~channelPermissions) !== 0n) {
						throw new MissingPermissionsError();
					}
				}
			}

			permissionOverwrites = new Map();
			for (const overwrite of data.permission_overwrites ?? []) {
				const targetId = overwrite.type === 0 ? createRoleID(overwrite.id) : createUserID(overwrite.id);
				permissionOverwrites.set(
					targetId,
					new ChannelPermissionOverwrite({
						type: overwrite.type,
						allow_: (overwrite.allow ? BigInt(overwrite.allow) : 0n) & ALL_PERMISSIONS,
						deny_: (overwrite.deny ? BigInt(overwrite.deny) : 0n) & ALL_PERMISSIONS,
					}),
				);
			}
		}

		const requestedParentId =
			data.parent_id !== undefined ? (data.parent_id ? createChannelID(data.parent_id) : null) : channel.parentId;

		if (requestedParentId && requestedParentId !== (channel.parentId ?? null)) {
			await this.ensureCategoryHasCapacity({
				guildId: guildIdValue,
				categoryId: requestedParentId,
			});
		}

		const updatedChannelData = {
			...channel.toRow(),
			name: channelName,
			topic: data.topic !== undefined ? data.topic : channel.topic,
			url: data.url !== undefined && channel.type === ChannelTypes.GUILD_LINK ? data.url : channel.url,
			parent_id: requestedParentId,
			bitrate: data.bitrate !== undefined && channel.type === ChannelTypes.GUILD_VOICE ? data.bitrate : channel.bitrate,
			user_limit:
				data.user_limit !== undefined && channel.type === ChannelTypes.GUILD_VOICE
					? data.user_limit
					: channel.userLimit,
			rate_limit_per_user:
				data.rate_limit_per_user !== undefined && channel.type === ChannelTypes.GUILD_TEXT
					? data.rate_limit_per_user
					: channel.rateLimitPerUser,
			nsfw: data.nsfw !== undefined && channel.type === ChannelTypes.GUILD_TEXT ? data.nsfw : channel.isNsfw,
			rtc_region:
				data.rtc_region !== undefined && channel.type === ChannelTypes.GUILD_VOICE
					? data.rtc_region
					: channel.rtcRegion,
			permission_overwrites: new Map(
				Array.from(permissionOverwrites.entries()).map(([targetId, overwrite]) => [
					targetId,
					overwrite.toPermissionOverwrite(),
				]),
			),
		};

		const updatedChannel = await this.channelRepository.channelData.upsert(updatedChannelData);
		await this.channelUtilsService.dispatchChannelUpdate({channel: updatedChannel, requestCache});

		if (channel.type === ChannelTypes.GUILD_CATEGORY && data.permission_overwrites !== undefined && guild) {
			await this.propagatePermissionsToSyncedChildren({
				categoryChannel: updatedChannel,
				previousPermissionOverwrites,
				guildId: createGuildID(BigInt(guild.id)),
				requestCache,
			});
		}

		if (
			data.rtc_region !== undefined &&
			channel.type === ChannelTypes.GUILD_VOICE &&
			data.rtc_region !== channel.rtcRegion &&
			this.voiceRoomStore
		) {
			await this.handleRtcRegionSwitch({
				guildId: createGuildID(BigInt(guild.id)),
				channelId,
			});
		}

		const beforeSnapshot = serializeChannelForAudit(channel);
		const afterSnapshot = serializeChannelForAudit(updatedChannel);
		const changes = this.guildAuditLogService.computeChanges(beforeSnapshot, afterSnapshot);

		if (changes.length > 0) {
			const builder = this.guildAuditLogService
				.createBuilder(guildIdValue, userId)
				.withAction(AuditLogActionType.CHANNEL_UPDATE, channel.id.toString())
				.withReason(null)
				.withMetadata({
					type: updatedChannel.type.toString(),
				})
				.withChanges(changes);

			try {
				await builder.commit();
			} catch (error) {
				Logger.error(
					{
						error,
						guildId: guildIdValue.toString(),
						userId: userId.toString(),
						action: AuditLogActionType.CHANNEL_UPDATE,
						targetId: channel.id.toString(),
					},
					'Failed to record guild audit log',
				);
			}

			if (data.name !== undefined && channel.name !== updatedChannel.name) {
				getMetricsService().counter({
					name: 'fluxer.channels.renamed',
					dimensions: {
						guild_id: guildIdValue.toString(),
						channel_type: updatedChannel.type.toString(),
					},
				});
			}
		}

		return updatedChannel;
	}

	async deleteChannel({
		userId,
		channelId,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
	}): Promise<void> {
		const {channel, guild, checkPermission} = await this.channelAuthService.getChannelAuthenticated({
			userId,
			channelId,
		});

		if (this.channelAuthService.isPersonalNotesChannel({userId, channelId})) {
			throw new CannotExecuteOnDmError();
		}

		if (guild) {
			await checkPermission(Permissions.MANAGE_CHANNELS);
			const guildId = createGuildID(BigInt(guild.id));

			if (channel.type === ChannelTypes.GUILD_CATEGORY) {
				const guildChannels = await this.channelRepository.channelData.listGuildChannels(guildId);
				const childChannels = guildChannels.filter((ch: Channel) => ch.parentId === channelId);

				for (const childChannel of childChannels) {
					const updatedChild = await this.channelRepository.channelData.upsert({
						...childChannel.toRow(),
						parent_id: null,
					});
					await this.channelUtilsService.dispatchChannelUpdate({channel: updatedChild, requestCache});
				}
			}

			const [channelInvites, channelWebhooks] = await Promise.all([
				this.inviteRepository.listChannelInvites(channelId),
				this.webhookRepository.listByChannel(channelId),
			]);

			await Promise.all([
				...channelInvites.map((invite) => this.inviteRepository.delete(invite.code)),
				...channelWebhooks.map((webhook) => this.webhookRepository.delete(webhook.id)),
			]);

			await this.channelUtilsService.purgeChannelAttachments(channel);
			await this.channelRepository.messages.deleteAllChannelMessages(channelId);
			await this.channelUtilsService.dispatchChannelDelete({channel, requestCache});

			const guildIdValue = createGuildID(BigInt(guild.id));
			const changes = this.guildAuditLogService.computeChanges(ChannelHelpers.serializeChannelForAudit(channel), null);

			const builder = this.guildAuditLogService
				.createBuilder(guildIdValue, userId)
				.withAction(AuditLogActionType.CHANNEL_DELETE, channel.id.toString())
				.withReason(null)
				.withMetadata({
					type: channel.type.toString(),
				})
				.withChanges(changes);

			try {
				await builder.commit();
			} catch (error) {
				Logger.error(
					{
						error,
						guildId: guildIdValue.toString(),
						userId: userId.toString(),
						action: AuditLogActionType.CHANNEL_DELETE,
						targetId: channel.id.toString(),
					},
					'Failed to record guild audit log',
				);
			}

			getMetricsService().counter({
				name: 'fluxer.channels.deleted',
				dimensions: {
					guild_id: guildIdValue.toString(),
					channel_type: channel.type.toString(),
				},
			});

			await this.channelRepository.channelData.delete(channelId, guildId);

			const guildModel = await this.guildRepository.findUnique(guildId);
			if (guildModel) {
				const guildRow = guildModel.toRow();
				const needsUpdate =
					guildRow.system_channel_id === channelId ||
					guildRow.rules_channel_id === channelId ||
					guildRow.afk_channel_id === channelId;

				if (needsUpdate) {
					const updatedGuild = await this.guildRepository.upsert({
						...guildRow,
						system_channel_id: guildRow.system_channel_id === channelId ? null : guildRow.system_channel_id,
						rules_channel_id: guildRow.rules_channel_id === channelId ? null : guildRow.rules_channel_id,
						afk_channel_id: guildRow.afk_channel_id === channelId ? null : guildRow.afk_channel_id,
					});

					await this.gatewayService.dispatchGuild({
						guildId,
						event: 'GUILD_UPDATE',
						data: mapGuildToGuildResponse(updatedGuild),
					});
				}
			}
		} else {
			await this.userRepository.closeDmForUser(userId, channelId);
			await this.channelUtilsService.dispatchDmChannelDelete({channel, userId, requestCache});
		}
	}

	async getAvailableRtcRegions({
		userId,
		channelId,
	}: {
		userId: UserID;
		channelId: ChannelID;
	}): Promise<Array<VoiceRegionAvailability>> {
		if (!this.voiceAvailabilityService) {
			return [];
		}

		const {channel, guild} = await this.channelAuthService.getChannelAuthenticated({userId, channelId});

		if (channel.type !== ChannelTypes.GUILD_VOICE) {
			throw new InvalidChannelTypeError();
		}

		if (!guild) {
			return [];
		}

		const guildId = createGuildID(BigInt(guild.id));
		const regions = this.voiceAvailabilityService.getAvailableRegions({
			requestingUserId: userId,
			guildId,
			guildFeatures: new Set(guild.features ?? []),
		});

		const accessibleRegions = regions.filter((region) => region.isAccessible);

		return accessibleRegions.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async propagatePermissionsToSyncedChildren({
		categoryChannel,
		previousPermissionOverwrites,
		guildId,
		requestCache,
	}: {
		categoryChannel: Channel;
		previousPermissionOverwrites: Map<RoleID | UserID, ChannelPermissionOverwrite>;
		guildId: GuildID;
		requestCache: RequestCache;
	}): Promise<void> {
		const guildChannels = await this.channelRepository.channelData.listGuildChannels(guildId);
		const childChannels = guildChannels.filter((ch: Channel) => ch.parentId === categoryChannel.id);

		const syncedChannels: Array<Channel> = [];
		for (const child of childChannels) {
			if (this.arePermissionsEqual(child.permissionOverwrites, previousPermissionOverwrites)) {
				syncedChannels.push(child);
			}
		}

		if (syncedChannels.length > 0) {
			await Promise.all(
				syncedChannels.map(async (child) => {
					const updatedChild = await this.channelRepository.channelData.upsert({
						...child.toRow(),
						permission_overwrites: new Map(
							Array.from(categoryChannel.permissionOverwrites.entries()).map(([targetId, overwrite]) => [
								targetId,
								overwrite.toPermissionOverwrite(),
							]),
						),
					});
					await this.channelUtilsService.dispatchChannelUpdate({channel: updatedChild, requestCache});
				}),
			);
		}
	}

	private arePermissionsEqual(
		perms1: Map<RoleID | UserID, ChannelPermissionOverwrite>,
		perms2: Map<RoleID | UserID, ChannelPermissionOverwrite>,
	): boolean {
		if (perms1.size !== perms2.size) return false;

		for (const [targetId, overwrite1] of perms1.entries()) {
			const overwrite2 = perms2.get(targetId);
			if (!overwrite2) return false;

			if (
				overwrite1.type !== overwrite2.type ||
				overwrite1.allow !== overwrite2.allow ||
				overwrite1.deny !== overwrite2.deny
			) {
				return false;
			}
		}

		return true;
	}

	private async handleRtcRegionSwitch({guildId, channelId}: {guildId: GuildID; channelId: ChannelID}): Promise<void> {
		if (!this.voiceRoomStore) {
			Logger.warn('[ChannelOperationsService] VoiceRoomStore not available, skipping region switch');
			return;
		}

		await this.voiceRoomStore.deleteRoomServer(guildId, channelId);

		await this.gatewayService.switchVoiceRegion({guildId, channelId});
	}

	private async ensureCategoryHasCapacity(params: {guildId: GuildID; categoryId: ChannelID}): Promise<void> {
		const count = await this.gatewayService.getCategoryChannelCount(params);

		let maxChannels = MAX_CHANNELS_PER_CATEGORY;
		const guild = await this.guildRepository.findUnique(params.guildId);
		const ctx = createLimitMatchContext({user: null, guildFeatures: guild?.features ?? null});
		const resolved = resolveLimit(this.limitConfigService.getConfigSnapshot(), ctx, 'max_channels_per_category', {
			evaluationContext: 'guild',
		});
		if (Number.isFinite(resolved) && resolved >= 0) {
			maxChannels = Math.floor(resolved);
		}

		if (count >= maxChannels) {
			throw new MaxCategoryChannelsError(maxChannels);
		}
	}

	async setChannelPermissionOverwrite(params: {
		userId: UserID;
		channelId: ChannelID;
		overwriteId: bigint;
		overwrite: {type: number; allow_: bigint; deny_: bigint};
		requestCache: RequestCache;
	}): Promise<void> {
		const channel = await this.channelRepository.channelData.findUnique(params.channelId);
		if (!channel || !channel.guildId) throw new UnknownChannelError();
		const canManageRoles = await this.gatewayService.checkPermission({
			guildId: channel.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_ROLES,
		});
		if (!canManageRoles) throw new MissingPermissionsError();

		const userPermissions = await this.gatewayService.getUserPermissions({
			guildId: channel.guildId,
			userId: params.userId,
			channelId: channel.id,
		});
		const sanitizedAllow = params.overwrite.allow_ & ALL_PERMISSIONS;
		const sanitizedDeny = params.overwrite.deny_ & ALL_PERMISSIONS;
		const combined = sanitizedAllow | sanitizedDeny;
		const hasAdministrator = (userPermissions & Permissions.ADMINISTRATOR) !== 0n;
		if (!hasAdministrator && (combined & ~userPermissions) !== 0n) throw new MissingPermissionsError();

		const overwrites = new Map(channel.permissionOverwrites ?? []);
		const targetId = params.overwrite.type === 0 ? createRoleID(params.overwriteId) : createUserID(params.overwriteId);
		overwrites.set(
			targetId,
			new ChannelPermissionOverwrite({
				type: params.overwrite.type,
				allow_: sanitizedAllow,
				deny_: sanitizedDeny,
			}),
		);

		const updated = await this.channelRepository.channelData.upsert({
			...channel.toRow(),
			permission_overwrites: new Map(
				Array.from(overwrites.entries()).map(([id, ow]) => [id, ow.toPermissionOverwrite()]),
			),
		});
		await this.channelUtilsService.dispatchChannelUpdate({channel: updated, requestCache: params.requestCache});
	}

	async deleteChannelPermissionOverwrite(params: {
		userId: UserID;
		channelId: ChannelID;
		overwriteId: bigint;
		requestCache: RequestCache;
	}): Promise<void> {
		const channel = await this.channelRepository.channelData.findUnique(params.channelId);
		if (!channel || !channel.guildId) throw new UnknownChannelError();
		const canManageRoles = await this.gatewayService.checkPermission({
			guildId: channel.guildId,
			userId: params.userId,
			permission: Permissions.MANAGE_ROLES,
		});
		if (!canManageRoles) throw new MissingPermissionsError();

		const overwrites = new Map(channel.permissionOverwrites ?? []);
		overwrites.delete(createRoleID(params.overwriteId));
		overwrites.delete(createUserID(params.overwriteId));

		const updated = await this.channelRepository.channelData.upsert({
			...channel.toRow(),
			permission_overwrites: new Map(
				Array.from(overwrites.entries()).map(([id, ow]) => [id, ow.toPermissionOverwrite()]),
			),
		});
		await this.channelUtilsService.dispatchChannelUpdate({channel: updated, requestCache: params.requestCache});
	}
}
