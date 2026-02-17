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

import type {SettingsTab} from '@app/components/modals/utils/SettingsConstants';
import {
	getSearchableItemsFromRegistry,
	type SearchableSettingItem,
	type UserSettingsTabType,
} from '@app/components/modals/utils/SettingsSectionRegistry';
import i18n from '@app/I18n';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

interface SearchableSettingDescriptor {
	id: string;
	tabType: UserSettingsTabType;
	sectionId?: string;
	label: MessageDescriptor;
	keywords: Array<MessageDescriptor>;
	description?: MessageDescriptor;
}

export interface SettingsSearchResult {
	tab: SettingsTab;
	matchedItems: Array<SearchableSettingItem>;
	score: number;
}

const ADDITIONAL_SEARCHABLE_ITEMS: Array<SearchableSettingDescriptor> = [
	{
		id: 'profile-avatar',
		tabType: 'my_profile',
		label: msg`Avatar`,
		keywords: [msg`avatar`, msg`profile picture`, msg`photo`, msg`image`, msg`pfp`, msg`picture`],
		description: msg`Change your profile picture`,
	},
	{
		id: 'profile-banner',
		tabType: 'my_profile',
		label: msg`Banner`,
		keywords: [msg`banner`, msg`cover`, msg`header`, msg`background`],
		description: msg`Customize your profile banner`,
	},
	{
		id: 'profile-username',
		tabType: 'my_profile',
		label: msg`Username`,
		keywords: [msg`username`, msg`name`, msg`display name`, msg`user`, msg`handle`, msg`tag`],
		description: msg`Change your username`,
	},
	{
		id: 'profile-bio',
		tabType: 'my_profile',
		label: msg`Bio`,
		keywords: [msg`bio`, msg`about me`, msg`description`, msg`biography`, msg`about`],
		description: msg`Edit your profile bio`,
	},
	{
		id: 'profile-accent-color',
		tabType: 'my_profile',
		label: msg`Accent Color`,
		keywords: [msg`accent`, msg`color`, msg`theme color`, msg`profile color`],
		description: msg`Choose your profile accent color`,
	},
	{
		id: 'profile-pronouns',
		tabType: 'my_profile',
		label: msg`Pronouns`,
		keywords: [msg`pronouns`, msg`identity`, msg`he`, msg`she`, msg`they`],
		description: msg`Set your pronouns`,
	},
	{
		id: 'profile-badge',
		tabType: 'my_profile',
		label: msg`Badge`,
		keywords: [msg`badge`, msg`premium badge`, msg`nitro`, msg`plutonium`],
		description: msg`Configure your profile badge`,
	},
	{
		id: 'account-email',
		tabType: 'account_security',
		sectionId: 'account',
		label: msg`Email`,
		keywords: [msg`email`, msg`mail`, msg`address`, msg`contact`],
		description: msg`Change your email address`,
	},
	{
		id: 'account-password',
		tabType: 'account_security',
		sectionId: 'security',
		label: msg`Password`,
		keywords: [msg`password`, msg`credentials`, msg`login`, msg`security`, msg`change password`],
		description: msg`Change your password`,
	},
	{
		id: 'account-phone',
		tabType: 'account_security',
		sectionId: 'account',
		label: msg`Phone Number`,
		keywords: [msg`phone`, msg`number`, msg`mobile`, msg`telephone`, msg`sms`],
		description: msg`Add or change your phone number`,
	},
	{
		id: 'account-2fa',
		tabType: 'account_security',
		sectionId: 'security',
		label: msg`Two-Factor Authentication`,
		keywords: [
			msg`2fa`,
			msg`two factor`,
			msg`mfa`,
			msg`authentication`,
			msg`authenticator`,
			msg`totp`,
			msg`otp`,
			msg`security`,
		],
		description: msg`Enable two-factor authentication`,
	},
	{
		id: 'account-backup-codes',
		tabType: 'account_security',
		sectionId: 'security',
		label: msg`Backup Codes`,
		keywords: [msg`backup codes`, msg`recovery`, msg`codes`, msg`2fa backup`],
		description: msg`View or regenerate backup codes`,
	},
	{
		id: 'account-delete',
		tabType: 'account_security',
		sectionId: 'danger_zone',
		label: msg`Delete Account`,
		keywords: [msg`delete`, msg`remove`, msg`close account`, msg`deactivate`],
		description: msg`Delete your account`,
	},
	{
		id: 'account-disable',
		tabType: 'account_security',
		sectionId: 'danger_zone',
		label: msg`Disable Account`,
		keywords: [msg`disable`, msg`deactivate`, msg`suspend`],
		description: msg`Temporarily disable your account`,
	},

	{
		id: 'language-locale',
		tabType: 'language',
		label: msg`Language`,
		keywords: [msg`language`, msg`locale`, msg`translation`, msg`localization`],
		description: msg`Choose your language`,
	},
	{
		id: 'language-timezone',
		tabType: 'language',
		label: msg`Timezone`,
		keywords: [msg`timezone`, msg`time zone`, msg`time`, msg`utc`, msg`gmt`],
		description: msg`Set your timezone`,
	},
	{
		id: 'language-date-format',
		tabType: 'language',
		label: msg`Date Format`,
		keywords: [msg`date`, msg`format`, msg`date format`, msg`time format`],
		description: msg`Configure date format`,
	},

	{
		id: 'keybinds-shortcuts',
		tabType: 'keybinds',
		label: msg`Keyboard Shortcuts`,
		keywords: [msg`keybinds`, msg`shortcuts`, msg`hotkeys`, msg`keyboard`, msg`keys`],
		description: msg`Configure keyboard shortcuts`,
	},
	{
		id: 'keybinds-ptt',
		tabType: 'keybinds',
		label: msg`Push to Talk Key`,
		keywords: [msg`push to talk`, msg`ptt`, msg`keybind`, msg`key`],
		description: msg`Set push to talk key`,
	},
	{
		id: 'keybinds-mute',
		tabType: 'keybinds',
		label: msg`Mute Keybind`,
		keywords: [msg`mute`, msg`keybind`, msg`toggle mute`],
		description: msg`Set mute keybind`,
	},
	{
		id: 'keybinds-deafen',
		tabType: 'keybinds',
		label: msg`Deafen Keybind`,
		keywords: [msg`deafen`, msg`keybind`, msg`toggle deafen`],
		description: msg`Set deafen keybind`,
	},

	{
		id: 'advanced-developer-mode',
		tabType: 'advanced',
		label: msg`Developer Mode`,
		keywords: [msg`developer`, msg`developer mode`, msg`dev`, msg`debug`, msg`copy id`],
		description: msg`Enable developer mode`,
	},
	{
		id: 'advanced-hardware-acceleration',
		tabType: 'advanced',
		label: msg`Hardware Acceleration`,
		keywords: [msg`hardware`, msg`acceleration`, msg`gpu`, msg`graphics`, msg`performance`],
		description: msg`Toggle hardware acceleration`,
	},

	{
		id: 'devices-sessions',
		tabType: 'devices',
		label: msg`Active Sessions`,
		keywords: [msg`devices`, msg`sessions`, msg`login`, msg`active`, msg`logged in`],
		description: msg`View active sessions`,
	},
	{
		id: 'devices-logout-all',
		tabType: 'devices',
		label: msg`Log Out All Devices`,
		keywords: [msg`logout`, msg`log out`, msg`devices`, msg`sessions`, msg`sign out`],
		description: msg`Log out of all devices`,
	},

	{
		id: 'blocked-users',
		tabType: 'blocked_users',
		label: msg`Blocked Users`,
		keywords: [msg`blocked`, msg`block`, msg`users`, msg`unblock`],
		description: msg`Manage blocked users`,
	},

	{
		id: 'authorized-apps',
		tabType: 'authorized_apps',
		label: msg`Authorized Apps`,
		keywords: [msg`apps`, msg`authorized`, msg`oauth`, msg`permissions`, msg`third party`, msg`integrations`],
		description: msg`Manage authorized applications`,
	},

	{
		id: 'plutonium-subscription',
		tabType: 'plutonium',
		label: msg`Subscription`,
		keywords: [msg`plutonium`, msg`premium`, msg`subscription`, msg`nitro`, msg`upgrade`, msg`plan`],
		description: msg`Manage your subscription`,
	},
	{
		id: 'plutonium-perks',
		tabType: 'plutonium',
		label: msg`Premium Perks`,
		keywords: [msg`perks`, msg`benefits`, msg`features`, msg`premium`],
		description: msg`View premium perks`,
	},

	{
		id: 'gift-inventory',
		tabType: 'gift_inventory',
		label: msg`Gift Inventory`,
		keywords: [msg`gifts`, msg`inventory`, msg`codes`, msg`redeem`, msg`gift codes`],
		description: msg`Manage your gifts`,
	},

	{
		id: 'expression-packs',
		tabType: 'expression_packs',
		label: msg`Expression Packs`,
		keywords: [msg`stickers`, msg`emoji`, msg`packs`, msg`expressions`, msg`sticker packs`],
		description: msg`Manage expression packs`,
	},

	{
		id: 'applications-dev',
		tabType: 'applications',
		label: msg`Developer Applications`,
		keywords: [msg`applications`, msg`bots`, msg`developer`, msg`api`, msg`oauth`, msg`create app`],
		description: msg`Manage developer applications`,
	},

	{
		id: 'limits-config',
		tabType: 'limits_config',
		label: msg`Limits Config`,
		keywords: [msg`limits`, msg`config`, msg`overrides`, msg`testing`, msg`caps`],
		description: msg`Locally override instance limits`,
	},

	{
		id: 'linked-accounts-connections',
		tabType: 'linked_accounts',
		label: msg`Connections`,
		keywords: [
			msg`connections`,
			msg`linked accounts`,
			msg`linked`,
			msg`accounts`,
			msg`bluesky`,
			msg`domain`,
			msg`verify`,
			msg`verification`,
			msg`external`,
			msg`social`,
		],
		description: msg`Link external accounts and domains to your profile`,
	},
];

function createSearchableItems(): Array<SearchableSettingItem> {
	const registryItems = getSearchableItemsFromRegistry(i18n);

	const additionalItems = ADDITIONAL_SEARCHABLE_ITEMS.map((item) => ({
		...item,
		label: i18n._(item.label),
		keywords: item.keywords.map((keyword) => i18n._(keyword)),
		description: item.description ? i18n._(item.description) : undefined,
	})) as Array<SearchableSettingItem>;

	return [...registryItems, ...additionalItems];
}

let cachedSearchableItems: Array<SearchableSettingItem> | null = null;

export function getSearchableItems(): Array<SearchableSettingItem> {
	if (!cachedSearchableItems) {
		cachedSearchableItems = createSearchableItems();
	}
	return cachedSearchableItems;
}

export function invalidateSearchCache(): void {
	cachedSearchableItems = null;
}

function normalizeSearchQuery(query: string): string {
	return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function calculateMatchScore(item: SearchableSettingItem, queryWords: Array<string>): number {
	let score = 0;
	const labelLower = item.label.toLowerCase();
	const descriptionLower = item.description?.toLowerCase() ?? '';
	const keywordsLower = item.keywords.map((k) => k.toLowerCase());

	for (const word of queryWords) {
		if (labelLower.includes(word)) {
			score += labelLower === word ? 100 : labelLower.startsWith(word) ? 50 : 25;
		}

		for (const keyword of keywordsLower) {
			if (keyword.includes(word)) {
				score += keyword === word ? 80 : keyword.startsWith(word) ? 40 : 20;
			}
		}

		if (descriptionLower.includes(word)) {
			score += 10;
		}
	}

	return score;
}

export function searchSettings(query: string, tabs: Array<SettingsTab>): Array<SettingsSearchResult> {
	const normalizedQuery = normalizeSearchQuery(query);
	if (!normalizedQuery) {
		return [];
	}

	const queryWords = normalizedQuery.split(' ').filter((w) => w.length > 0);
	const items = getSearchableItems();
	const tabSet = new Set(tabs.map((t) => t.type));

	const resultsByTab = new Map<UserSettingsTabType, SettingsSearchResult>();

	for (const item of items) {
		if (!tabSet.has(item.tabType)) {
			continue;
		}

		const score = calculateMatchScore(item, queryWords);
		if (score > 0) {
			const existing = resultsByTab.get(item.tabType);
			if (existing) {
				existing.matchedItems.push(item);
				existing.score = Math.max(existing.score, score);
			} else {
				const tab = tabs.find((t) => t.type === item.tabType);
				if (tab) {
					resultsByTab.set(item.tabType, {
						tab,
						matchedItems: [item],
						score,
					});
				}
			}
		}
	}

	const results = Array.from(resultsByTab.values());
	results.sort((a, b) => b.score - a.score);

	return results;
}

export function getMatchedSectionIds(results: Array<SettingsSearchResult>): Set<string> {
	const sectionIds = new Set<string>();
	for (const result of results) {
		for (const item of result.matchedItems) {
			if (item.sectionId) {
				sectionIds.add(item.sectionId);
			}
		}
	}
	return sectionIds;
}

export function getMatchedTabTypes(results: Array<SettingsSearchResult>): Set<UserSettingsTabType> {
	return new Set(results.map((r) => r.tab.type));
}
