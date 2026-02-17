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

import {hasAnyPermission} from '@fluxer/admin/src/AccessControlList';
import type {NavigationContext, NavSection} from '@fluxer/admin/src/navigation/NavigationTypes';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';

export function getSections(): Array<NavSection> {
	return [
		{
			title: 'Lookup',
			items: [
				{title: 'Users', path: '/users', activeKey: 'users', requiredAcls: [AdminACLs.USER_LOOKUP]},
				{title: 'Guilds', path: '/guilds', activeKey: 'guilds', requiredAcls: [AdminACLs.GUILD_LOOKUP]},
			],
		},
		{
			title: 'Moderation',
			items: [
				{title: 'Reports', path: '/reports', activeKey: 'reports', requiredAcls: [AdminACLs.REPORT_VIEW]},
				{
					title: 'Bulk Actions',
					path: '/bulk-actions',
					activeKey: 'bulk-actions',
					requiredAcls: [
						AdminACLs.BULK_UPDATE_USER_FLAGS,
						AdminACLs.BULK_UPDATE_GUILD_FEATURES,
						AdminACLs.BULK_ADD_GUILD_MEMBERS,
						AdminACLs.BULK_DELETE_USERS,
					],
				},
			],
		},
		{
			title: 'Bans',
			items: [
				{
					title: 'IP Bans',
					path: '/ip-bans',
					activeKey: 'ip-bans',
					requiredAcls: [AdminACLs.BAN_IP_CHECK, AdminACLs.BAN_IP_ADD, AdminACLs.BAN_IP_REMOVE],
				},
				{
					title: 'Email Bans',
					path: '/email-bans',
					activeKey: 'email-bans',
					requiredAcls: [AdminACLs.BAN_EMAIL_CHECK, AdminACLs.BAN_EMAIL_ADD, AdminACLs.BAN_EMAIL_REMOVE],
				},
				{
					title: 'Phone Bans',
					path: '/phone-bans',
					activeKey: 'phone-bans',
					requiredAcls: [AdminACLs.BAN_PHONE_CHECK, AdminACLs.BAN_PHONE_ADD, AdminACLs.BAN_PHONE_REMOVE],
				},
			],
		},
		{
			title: 'Content',
			items: [
				{
					title: 'Message Tools',
					path: '/messages',
					activeKey: 'message-tools',
					requiredAcls: [
						AdminACLs.MESSAGE_LOOKUP,
						AdminACLs.MESSAGE_DELETE,
						AdminACLs.MESSAGE_SHRED,
						AdminACLs.MESSAGE_DELETE_ALL,
					],
				},
				{
					title: 'System DMs',
					path: '/system-dms',
					activeKey: 'system-dms',
					requiredAcls: [AdminACLs.SYSTEM_DM_SEND],
				},
				{
					title: 'Archives',
					path: '/archives',
					activeKey: 'archives',
					requiredAcls: [AdminACLs.ARCHIVE_VIEW_ALL, AdminACLs.ARCHIVE_TRIGGER_USER, AdminACLs.ARCHIVE_TRIGGER_GUILD],
				},
				{
					title: 'Asset Purge',
					path: '/asset-purge',
					activeKey: 'asset-purge',
					requiredAcls: [AdminACLs.ASSET_PURGE],
				},
			],
		},
		{
			title: 'Observability',
			items: [
				{
					title: 'Gateway',
					path: '/gateway',
					activeKey: 'gateway',
					requiredAcls: [AdminACLs.GATEWAY_MEMORY_STATS, AdminACLs.GATEWAY_RELOAD_ALL],
				},
				{
					title: 'Audit Logs',
					path: '/audit-logs',
					activeKey: 'audit-logs',
					requiredAcls: [AdminACLs.AUDIT_LOG_VIEW],
				},
			],
		},
		{
			title: 'Platform',
			items: [
				{
					title: 'Search Index',
					path: '/search-index',
					activeKey: 'search-index',
					requiredAcls: [AdminACLs.GUILD_LOOKUP],
				},
				{
					title: 'Voice Regions',
					path: '/voice-regions',
					activeKey: 'voice-regions',
					requiredAcls: [AdminACLs.VOICE_REGION_LIST],
				},
				{
					title: 'Voice Servers',
					path: '/voice-servers',
					activeKey: 'voice-servers',
					requiredAcls: [AdminACLs.VOICE_SERVER_LIST],
				},
			],
		},
		{
			title: 'Configuration',
			items: [
				{
					title: 'Instance Config',
					path: '/instance-config',
					activeKey: 'instance-config',
					requiredAcls: [AdminACLs.INSTANCE_CONFIG_VIEW, AdminACLs.INSTANCE_CONFIG_UPDATE],
				},
				{
					title: 'Limit Config',
					path: '/limit-config',
					activeKey: 'limit-config',
					requiredAcls: [AdminACLs.INSTANCE_LIMIT_CONFIG_VIEW, AdminACLs.INSTANCE_LIMIT_CONFIG_UPDATE],
				},
				{
					title: 'Admin API Keys',
					path: '/admin-api-keys',
					activeKey: 'admin-api-keys',
					requiredAcls: [AdminACLs.ADMIN_API_KEY_MANAGE],
				},
			],
		},
		{
			title: 'Discovery',
			items: [
				{
					title: 'Applications',
					path: '/discovery?status=pending',
					activeKey: 'discovery',
					requiredAcls: [AdminACLs.DISCOVERY_REVIEW],
				},
			],
		},
		{
			title: 'Codes',
			items: [
				{
					title: 'Gift Codes',
					path: '/gift-codes',
					activeKey: 'gift-codes',
					requiredAcls: [AdminACLs.GIFT_CODES_GENERATE],
					hostedOnly: true,
				},
			],
		},
		{
			title: 'Premium',
			items: [
				{
					title: 'Visionary Slots',
					path: '/visionary-slots',
					activeKey: 'visionary-slots',
					requiredAcls: [AdminACLs.VISIONARY_SLOT_VIEW],
					hostedOnly: true,
				},
			],
		},
	];
}

export function getAccessibleSections(adminAcls: Array<string>, context?: NavigationContext): Array<NavSection> {
	const selfHosted = context?.selfHosted ?? false;
	const inspectedVoiceRegionId = context?.inspectedVoiceRegionId;
	const hasContext = Boolean(context);
	const hasInspectedVoiceRegion = Boolean(inspectedVoiceRegionId);

	return getSections()
		.map((section) => ({
			...section,
			items: section.items
				.filter((item) => !item.hostedOnly || !selfHosted)
				.filter((item) => hasAnyPermission(adminAcls, item.requiredAcls))
				.filter((item) => !hasContext || item.activeKey !== 'voice-servers' || hasInspectedVoiceRegion)
				.map((item) => {
					if (!hasContext || item.activeKey !== 'voice-servers' || !inspectedVoiceRegionId) {
						return item;
					}

					const encodedRegionId = encodeURIComponent(inspectedVoiceRegionId);
					return {
						...item,
						path: `/voice-servers?region_id=${encodedRegionId}`,
					};
				}),
		}))
		.filter((section) => section.items.length > 0);
}

export function getFirstAccessiblePath(adminAcls: Array<string>, context?: NavigationContext): string | null {
	const sections = getAccessibleSections(adminAcls, context);
	const firstSection = sections[0];
	if (!firstSection || firstSection.items.length === 0) return null;
	const firstItem = firstSection.items[0];
	if (!firstItem) return null;
	return firstItem.path;
}
