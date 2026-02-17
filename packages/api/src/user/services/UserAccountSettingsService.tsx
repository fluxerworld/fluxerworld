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

import {type ChannelID, createChannelID, createGuildID, type GuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {ChannelOverride, UserGuildSettingsRow} from '@fluxer/api/src/database/types/UserTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserSettingsRepository} from '@fluxer/api/src/user/repositories/IUserSettingsRepository';
import {CustomStatusValidator} from '@fluxer/api/src/user/services/CustomStatusValidator';
import type {UserAccountUpdatePropagator} from '@fluxer/api/src/user/services/UserAccountUpdatePropagator';
import {
	DEFAULT_GUILD_FOLDER_ICON,
	FriendSourceFlags,
	GroupDmAddPermissionFlags,
	IncomingCallFlags,
	UNCATEGORIZED_FOLDER_ID,
	UserNotificationSettings,
} from '@fluxer/constants/src/UserConstants';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import {ValidationError} from '@fluxer/errors/src/ValidationError';
import type {
	UserGuildSettingsUpdateRequest,
	UserSettingsUpdateRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';

interface UserAccountSettingsServiceDeps {
	userAccountRepository: IUserAccountRepository;
	userSettingsRepository: IUserSettingsRepository;
	updatePropagator: UserAccountUpdatePropagator;
	guildRepository: IGuildRepositoryAggregate;
	packService: PackService;
	limitConfigService: LimitConfigService;
}

export class UserAccountSettingsService {
	private readonly customStatusValidator: CustomStatusValidator;

	constructor(private readonly deps: UserAccountSettingsServiceDeps) {
		this.customStatusValidator = new CustomStatusValidator(
			this.deps.userAccountRepository,
			this.deps.guildRepository,
			this.deps.packService,
			this.deps.limitConfigService,
		);
	}

	async findSettings(userId: UserID): Promise<UserSettings> {
		const userSettings = await this.deps.userSettingsRepository.findSettings(userId);
		if (!userSettings) throw new UnknownUserError();
		return userSettings;
	}

	async updateSettings(params: {userId: UserID; data: UserSettingsUpdateRequest}): Promise<UserSettings> {
		const {userId, data} = params;
		const currentSettings = await this.deps.userSettingsRepository.findSettings(userId);
		if (!currentSettings) {
			throw new UnknownUserError();
		}

		const updatedRowData = {...currentSettings.toRow(), user_id: userId};
		const localeChanged = data.locale !== undefined && data.locale !== currentSettings.locale;

		if (data.status !== undefined) updatedRowData.status = data.status;
		if (data.status_resets_at !== undefined) updatedRowData.status_resets_at = data.status_resets_at;
		if (data.status_resets_to !== undefined) updatedRowData.status_resets_to = data.status_resets_to;
		if (data.theme !== undefined) {
			if (data.theme !== currentSettings.theme) {
				getMetricsService().counter({
					name: 'fluxer.users.theme_changed',
					dimensions: {
						new_theme: data.theme,
						old_theme: currentSettings.theme,
					},
				});
			}
			updatedRowData.theme = data.theme;
		}
		if (data.locale !== undefined) updatedRowData.locale = data.locale;
		if (data.custom_status !== undefined) {
			if (data.custom_status === null) {
				updatedRowData.custom_status = null;
			} else {
				const validated = await this.customStatusValidator.validate(userId, data.custom_status);
				updatedRowData.custom_status = {
					text: validated.text,
					expires_at: validated.expiresAt,
					emoji_id: validated.emojiId,
					emoji_name: validated.emojiName,
					emoji_animated: validated.emojiAnimated,
				};
			}
		}
		if (data.flags !== undefined) updatedRowData.friend_source_flags = data.flags;
		if (data.restricted_guilds !== undefined) {
			updatedRowData.restricted_guilds = data.restricted_guilds
				? new Set(data.restricted_guilds.map(createGuildID))
				: null;
		}
		if (data.bot_restricted_guilds !== undefined) {
			updatedRowData.bot_restricted_guilds = data.bot_restricted_guilds
				? new Set(data.bot_restricted_guilds.map(createGuildID))
				: null;
		}
		if (data.default_guilds_restricted !== undefined) {
			updatedRowData.default_guilds_restricted = data.default_guilds_restricted;
		}
		if (data.bot_default_guilds_restricted !== undefined) {
			updatedRowData.bot_default_guilds_restricted = data.bot_default_guilds_restricted;
		}
		if (data.inline_attachment_media !== undefined) {
			updatedRowData.inline_attachment_media = data.inline_attachment_media;
		}
		if (data.inline_embed_media !== undefined) updatedRowData.inline_embed_media = data.inline_embed_media;
		if (data.gif_auto_play !== undefined) updatedRowData.gif_auto_play = data.gif_auto_play;
		if (data.render_embeds !== undefined) updatedRowData.render_embeds = data.render_embeds;
		if (data.render_reactions !== undefined) updatedRowData.render_reactions = data.render_reactions;
		if (data.animate_emoji !== undefined) updatedRowData.animate_emoji = data.animate_emoji;
		if (data.animate_stickers !== undefined) updatedRowData.animate_stickers = data.animate_stickers;
		if (data.render_spoilers !== undefined) updatedRowData.render_spoilers = data.render_spoilers;
		if (data.message_display_compact !== undefined) {
			updatedRowData.message_display_compact = data.message_display_compact;
		}
		if (data.friend_source_flags !== undefined) {
			updatedRowData.friend_source_flags = this.normalizeFriendSourceFlags(data.friend_source_flags);
		}
		if (data.incoming_call_flags !== undefined) {
			updatedRowData.incoming_call_flags = this.normalizeIncomingCallFlags(data.incoming_call_flags);
		}
		if (data.group_dm_add_permission_flags !== undefined) {
			updatedRowData.group_dm_add_permission_flags = this.normalizeGroupDmAddPermissionFlags(
				data.group_dm_add_permission_flags,
			);
		}
		if (data.guild_folders !== undefined) {
			const mappedFolders = data.guild_folders.map((folder) => ({
				folder_id: folder.id,
				name: folder.name ?? null,
				color: folder.color ?? 0x000000,
				flags: folder.flags ?? 0,
				icon: folder.icon ?? DEFAULT_GUILD_FOLDER_ICON,
				guild_ids: folder.guild_ids.map(createGuildID),
			}));
			const hasUncategorized = mappedFolders.some((folder) => folder.folder_id === UNCATEGORIZED_FOLDER_ID);
			if (!hasUncategorized) {
				mappedFolders.unshift({
					folder_id: UNCATEGORIZED_FOLDER_ID,
					name: null,
					color: 0x000000,
					flags: 0,
					icon: DEFAULT_GUILD_FOLDER_ICON,
					guild_ids: [],
				});
			}
			updatedRowData.guild_folders = mappedFolders;
		}
		if (data.afk_timeout !== undefined) updatedRowData.afk_timeout = data.afk_timeout;
		if (data.time_format !== undefined) updatedRowData.time_format = data.time_format;
		if (data.developer_mode !== undefined) updatedRowData.developer_mode = data.developer_mode;
		if (data.trusted_domains !== undefined) {
			const domainsSet = new Set(data.trusted_domains);
			if (domainsSet.has('*') && domainsSet.size > 1) {
				throw ValidationError.fromField(
					'trusted_domains',
					'INVALID_TRUSTED_DOMAINS',
					'Cannot combine wildcard (*) with specific domains',
				);
			}
			updatedRowData.trusted_domains = domainsSet.size > 0 ? domainsSet : null;
		}
		if (data.default_hide_muted_channels !== undefined) {
			updatedRowData.default_hide_muted_channels = data.default_hide_muted_channels;
		}

		await this.deps.userSettingsRepository.upsertSettings(updatedRowData);
		const updatedSettings = await this.findSettings(userId);
		await this.deps.updatePropagator.dispatchUserSettingsUpdate({userId, settings: updatedSettings});

		if (localeChanged) {
			const user = await this.deps.userAccountRepository.findUnique(userId);
			if (user) {
				const updatedUser = await this.deps.userAccountRepository.patchUpsert(
					userId,
					{locale: data.locale},
					user.toRow(),
				);
				await this.deps.updatePropagator.dispatchUserUpdate(updatedUser);
			}
		}

		return updatedSettings;
	}

	async findGuildSettings(userId: UserID, guildId: GuildID | null): Promise<UserGuildSettings | null> {
		return await this.deps.userSettingsRepository.findGuildSettings(userId, guildId);
	}

	async updateGuildSettings(params: {
		userId: UserID;
		guildId: GuildID | null;
		data: UserGuildSettingsUpdateRequest;
	}): Promise<UserGuildSettings> {
		const {userId, guildId, data} = params;
		const currentSettings = await this.deps.userSettingsRepository.findGuildSettings(userId, guildId);
		const resolvedGuildId = guildId ?? createGuildID(0n);
		const baseRow: UserGuildSettingsRow = currentSettings
			? {
					...currentSettings.toRow(),
					user_id: userId,
					guild_id: resolvedGuildId,
				}
			: {
					user_id: userId,
					guild_id: resolvedGuildId,
					message_notifications: UserNotificationSettings.INHERIT,
					muted: false,
					mute_config: null,
					mobile_push: false,
					suppress_everyone: false,
					suppress_roles: false,
					hide_muted_channels: false,
					channel_overrides: null,
					version: 1,
				};

		const updatedRowData: UserGuildSettingsRow = {...baseRow};

		if (data.message_notifications !== undefined) updatedRowData.message_notifications = data.message_notifications;
		if (data.muted !== undefined) updatedRowData.muted = data.muted;
		if (data.mute_config !== undefined) {
			updatedRowData.mute_config = data.mute_config
				? {
						end_time: data.mute_config.end_time ?? null,
						selected_time_window: data.mute_config.selected_time_window,
					}
				: null;
		}
		if (data.mobile_push !== undefined) updatedRowData.mobile_push = data.mobile_push;
		if (data.suppress_everyone !== undefined) updatedRowData.suppress_everyone = data.suppress_everyone;
		if (data.suppress_roles !== undefined) updatedRowData.suppress_roles = data.suppress_roles;
		if (data.hide_muted_channels !== undefined) updatedRowData.hide_muted_channels = data.hide_muted_channels;
		if (data.channel_overrides !== undefined) {
			if (data.channel_overrides) {
				const channelOverrides = new Map<ChannelID, ChannelOverride>();
				for (const [channelIdStr, override] of Object.entries(data.channel_overrides)) {
					const channelId = createChannelID(BigInt(channelIdStr));
					channelOverrides.set(channelId, {
						collapsed: override.collapsed,
						message_notifications: override.message_notifications,
						muted: override.muted,
						mute_config: override.mute_config
							? {
									end_time: override.mute_config.end_time ?? null,
									selected_time_window: override.mute_config.selected_time_window,
								}
							: null,
					});
				}
				updatedRowData.channel_overrides = channelOverrides.size > 0 ? channelOverrides : null;
			} else {
				updatedRowData.channel_overrides = null;
			}
		}

		const updatedSettings = await this.deps.userSettingsRepository.upsertGuildSettings(updatedRowData);
		await this.deps.updatePropagator.dispatchUserGuildSettingsUpdate({userId, settings: updatedSettings});
		return updatedSettings;
	}

	private normalizeFriendSourceFlags(flags: number): number {
		let normalizedFlags = flags;

		if ((normalizedFlags & FriendSourceFlags.NO_RELATION) === FriendSourceFlags.NO_RELATION) {
			const hasMutualFriends =
				(normalizedFlags & FriendSourceFlags.MUTUAL_FRIENDS) === FriendSourceFlags.MUTUAL_FRIENDS;
			const hasMutualGuilds = (normalizedFlags & FriendSourceFlags.MUTUAL_GUILDS) === FriendSourceFlags.MUTUAL_GUILDS;

			if (!hasMutualFriends || !hasMutualGuilds) {
				normalizedFlags &= ~FriendSourceFlags.NO_RELATION;
			}
		}

		return normalizedFlags;
	}

	private normalizeIncomingCallFlags(flags: number): number {
		let normalizedFlags = flags;

		const modifierFlags = flags & IncomingCallFlags.SILENT_EVERYONE;

		if ((normalizedFlags & IncomingCallFlags.FRIENDS_ONLY) === IncomingCallFlags.FRIENDS_ONLY) {
			normalizedFlags = IncomingCallFlags.FRIENDS_ONLY | modifierFlags;
		}

		if ((normalizedFlags & IncomingCallFlags.NOBODY) === IncomingCallFlags.NOBODY) {
			normalizedFlags = IncomingCallFlags.NOBODY | modifierFlags;
		}

		return normalizedFlags;
	}

	private normalizeGroupDmAddPermissionFlags(flags: number): number {
		let normalizedFlags = flags;

		if ((normalizedFlags & GroupDmAddPermissionFlags.FRIENDS_ONLY) === GroupDmAddPermissionFlags.FRIENDS_ONLY) {
			normalizedFlags = GroupDmAddPermissionFlags.FRIENDS_ONLY;
		}

		if ((normalizedFlags & GroupDmAddPermissionFlags.NOBODY) === GroupDmAddPermissionFlags.NOBODY) {
			normalizedFlags = GroupDmAddPermissionFlags.NOBODY;
		}

		if ((normalizedFlags & GroupDmAddPermissionFlags.EVERYONE) === GroupDmAddPermissionFlags.EVERYONE) {
			normalizedFlags = GroupDmAddPermissionFlags.EVERYONE;
		}

		return normalizedFlags;
	}
}
