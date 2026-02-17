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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {triggerGuildArchive} from '@fluxer/admin/src/api/Archives';
import {purgeAssets} from '@fluxer/admin/src/api/Assets';
import {
	banGuildMember,
	clearGuildFields,
	deleteGuild,
	forceAddUserToGuild,
	kickGuildMember,
	lookupGuild,
	reloadGuild,
	shutdownGuild,
	transferGuildOwnership,
	updateGuildFeatures,
	updateGuildName,
	updateGuildSettings,
	updateGuildVanity,
} from '@fluxer/admin/src/api/Guilds';
import {refreshSearchIndexWithGuild} from '@fluxer/admin/src/api/Search';
import {redirectWithFlash} from '@fluxer/admin/src/middleware/Auth';
import {GuildDetailPage} from '@fluxer/admin/src/pages/GuildDetailPage';
import {GuildsPage} from '@fluxer/admin/src/pages/GuildsPage';
import {getRouteContext} from '@fluxer/admin/src/routes/RouteContext';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {getPageConfig} from '@fluxer/admin/src/SelfHostedOverride';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {getOptionalString, getStringArray, type ParsedBody} from '@fluxer/admin/src/utils/Forms';
import {Hono} from 'hono';

export function createGuildsRoutes({config, assetVersion, requireAuth}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/guilds', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const searchQuery = c.req.query('q');
		const page = parseInt(c.req.query('page') ?? '0', 10);

		const pageResult = await GuildsPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			searchQuery,
			page,
			assetVersion,
			csrfToken,
		});
		return c.html(pageResult ?? '');
	});

	router.get('/guilds/:guildId', requireAuth, async (c) => {
		const {session, currentAdmin, flash, csrfToken} = getRouteContext(c);
		const pageConfig = getPageConfig(c, config);
		const guildId = c.req.param('guildId');
		const tab = c.req.query('tab');
		const page = c.req.query('page');

		const pageResult = await GuildDetailPage({
			config: pageConfig,
			session,
			currentAdmin,
			flash,
			guildId,
			tab,
			page,
			assetVersion,
			csrfToken,
		});
		return c.html(pageResult ?? '');
	});

	router.post('/guilds/:guildId', requireAuth, async (c) => {
		const session = c.get('session')!;
		const guildId = c.req.param('guildId');
		const action = c.req.query('action');
		const tab = c.req.query('tab') ?? 'overview';
		const redirectUrl = `${config.basePath}/guilds/${guildId}?tab=${tab}`;

		const formData = (await c.req.parseBody()) as ParsedBody;

		switch (action) {
			case 'clear_fields': {
				const fields = getStringArray(formData, 'fields[]');

				const result = await clearGuildFields(config, session, guildId, fields);
				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild fields cleared successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to clear guild fields',
						type: 'error',
					});
				}
			}

			case 'update_features': {
				const guildResult = await lookupGuild(config, session, guildId);
				if (!guildResult.ok || !guildResult.data) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild not found',
						type: 'error',
					});
				}

				const currentGuild = guildResult.data;

				const submittedFeatures = getStringArray(formData, 'features[]');

				const customFeaturesInput = getOptionalString(formData, 'custom_features') || '';
				const customFeatures = customFeaturesInput
					.split(',')
					.map((f) => f.trim())
					.filter((f) => f !== '');

				submittedFeatures.push(...customFeatures);

				let finalFeatures = submittedFeatures;
				if (
					submittedFeatures.includes('UNAVAILABLE_FOR_EVERYONE') &&
					submittedFeatures.includes('UNAVAILABLE_FOR_EVERYONE_BUT_STAFF')
				) {
					finalFeatures = submittedFeatures.filter((f) => f !== 'UNAVAILABLE_FOR_EVERYONE_BUT_STAFF');
				}

				const addFeatures = finalFeatures.filter((f) => !currentGuild.features.includes(f));
				const removeFeatures = currentGuild.features.filter((f) => !finalFeatures.includes(f));

				const result = await updateGuildFeatures(config, session, guildId, addFeatures, removeFeatures);
				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild features updated successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to update guild features',
						type: 'error',
					});
				}
			}

			case 'update_disabled_operations': {
				const checkedOps = getStringArray(formData, 'disabled_operations[]');

				const disabledOpsValue = checkedOps.reduce((acc, opStr) => {
					const val = parseInt(opStr, 10);
					return Number.isNaN(val) ? acc : acc | val;
				}, 0);

				const result = await updateGuildSettings(config, session, guildId, {
					disabled_operations: disabledOpsValue,
				});

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Disabled operations updated successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to update disabled operations',
						type: 'error',
					});
				}
			}

			case 'update_name': {
				const name = getOptionalString(formData, 'name') || '';
				const result = await updateGuildName(config, session, guildId, name);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild name updated successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to update guild name',
						type: 'error',
					});
				}
			}

			case 'update_vanity': {
				const vanityCode = getOptionalString(formData, 'vanity_url_code') || '';
				const vanity = vanityCode === '' ? undefined : vanityCode;

				const result = await updateGuildVanity(config, session, guildId, vanity);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Vanity URL updated successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to update vanity URL',
						type: 'error',
					});
				}
			}

			case 'transfer_ownership': {
				const newOwnerId = getOptionalString(formData, 'new_owner_id') || '';
				const result = await transferGuildOwnership(config, session, guildId, newOwnerId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild ownership transferred successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to transfer guild ownership',
						type: 'error',
					});
				}
			}

			case 'reload': {
				const result = await reloadGuild(config, session, guildId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild reloaded successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to reload guild',
						type: 'error',
					});
				}
			}

			case 'shutdown': {
				const result = await shutdownGuild(config, session, guildId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild shutdown successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to shutdown guild',
						type: 'error',
					});
				}
			}

			case 'delete_guild': {
				const result = await deleteGuild(config, session, guildId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild deleted successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to delete guild',
						type: 'error',
					});
				}
			}

			case 'update_settings': {
				const verificationLevelStr = getOptionalString(formData, 'verification_level');
				const mfaLevelStr = getOptionalString(formData, 'mfa_level');
				const nsfwLevelStr = getOptionalString(formData, 'nsfw_level');
				const explicitContentFilterStr = getOptionalString(formData, 'explicit_content_filter');
				const defaultMessageNotificationsStr = getOptionalString(formData, 'default_message_notifications');

				const verificationLevel = verificationLevelStr ? parseInt(verificationLevelStr, 10) : undefined;
				const mfaLevel = mfaLevelStr ? parseInt(mfaLevelStr, 10) : undefined;
				const nsfwLevel = nsfwLevelStr ? parseInt(nsfwLevelStr, 10) : undefined;
				const explicitContentFilter = explicitContentFilterStr ? parseInt(explicitContentFilterStr, 10) : undefined;
				const defaultMessageNotifications = defaultMessageNotificationsStr
					? parseInt(defaultMessageNotificationsStr, 10)
					: undefined;

				const result = await updateGuildSettings(config, session, guildId, {
					verification_level: verificationLevel,
					mfa_level: mfaLevel,
					nsfw_level: nsfwLevel,
					explicit_content_filter: explicitContentFilter,
					default_message_notifications: defaultMessageNotifications,
				});

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Guild settings updated successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to update guild settings',
						type: 'error',
					});
				}
			}

			case 'force_add_user': {
				const userId = getOptionalString(formData, 'user_id') || '';
				const result = await forceAddUserToGuild(config, session, userId, guildId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'User added to guild successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to add user to guild',
						type: 'error',
					});
				}
			}

			case 'ban_member': {
				const userId = (getOptionalString(formData, 'user_id') || '').trim();

				if (userId === '') {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Member ID is required.',
						type: 'error',
					});
				}

				const result = await banGuildMember(config, session, guildId, userId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Member banned successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to ban member',
						type: 'error',
					});
				}
			}

			case 'kick_member': {
				const userId = (getOptionalString(formData, 'user_id') || '').trim();

				if (userId === '') {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Member ID is required.',
						type: 'error',
					});
				}

				const result = await kickGuildMember(config, session, guildId, userId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Member kicked successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to kick member',
						type: 'error',
					});
				}
			}

			case 'refresh_search_index': {
				const indexType = getOptionalString(formData, 'index_type') || '';
				const result = await refreshSearchIndexWithGuild(config, session, indexType, guildId);

				if (result.ok) {
					return redirectWithFlash(c, `${config.basePath}/search-index?job_id=${result.data.job_id}`, {
						message: 'Search index refresh started successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to start search index refresh',
						type: 'error',
					});
				}
			}

			case 'delete_emoji': {
				const emojiId = (getOptionalString(formData, 'emoji_id') || '').trim();

				if (emojiId === '') {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Emoji ID is required.',
						type: 'error',
					});
				}

				const result = await purgeAssets(config, session, [emojiId]);

				if (result.ok) {
					const error = result.data.errors.find((err) => err.id === emojiId);
					if (error) {
						return redirectWithFlash(c, redirectUrl, {
							message: `Emoji deletion failed: ${error.error}`,
							type: 'error',
						});
					} else {
						return redirectWithFlash(c, redirectUrl, {
							message: 'Emoji deleted successfully.',
							type: 'success',
						});
					}
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Emoji deletion failed.',
						type: 'error',
					});
				}
			}

			case 'delete_sticker': {
				const stickerId = (getOptionalString(formData, 'sticker_id') || '').trim();

				if (stickerId === '') {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Sticker ID is required.',
						type: 'error',
					});
				}

				const result = await purgeAssets(config, session, [stickerId]);

				if (result.ok) {
					const error = result.data.errors.find((err) => err.id === stickerId);
					if (error) {
						return redirectWithFlash(c, redirectUrl, {
							message: `Sticker deletion failed: ${error.error}`,
							type: 'error',
						});
					} else {
						return redirectWithFlash(c, redirectUrl, {
							message: 'Sticker deleted successfully.',
							type: 'success',
						});
					}
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Sticker deletion failed.',
						type: 'error',
					});
				}
			}

			case 'trigger_archive': {
				const result = await triggerGuildArchive(config, session, guildId);

				if (result.ok) {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Archive triggered successfully',
						type: 'success',
					});
				} else {
					return redirectWithFlash(c, redirectUrl, {
						message: 'Failed to trigger archive',
						type: 'error',
					});
				}
			}

			default:
				return redirectWithFlash(c, redirectUrl, {
					message: 'Unknown action',
					type: 'error',
				});
		}
	});

	return router;
}
