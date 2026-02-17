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

import {
	getSectionIdsForTab as registryGetSectionIdsForTab,
	getSectionsForTab as registryGetSectionsForTab,
	tabHasSections as registryTabHasSections,
	type SettingsSectionConfig,
	type UserSettingsTabType,
} from '@app/components/modals/utils/SettingsSectionRegistry';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans} from '@lingui/react/macro';
import {
	BellIcon,
	ChatCircleIcon,
	CodeIcon,
	CrownIcon,
	DevicesIcon,
	EyeSlashIcon,
	FlagIcon,
	FlaskIcon,
	GiftIcon,
	type Icon,
	type IconWeight,
	KeyboardIcon,
	MicrophoneIcon,
	PaintBrushIcon,
	PaletteIcon,
	PersonSimpleCircleIcon,
	ProhibitIcon,
	RobotIcon,
	ShieldIcon,
	StickerIcon,
	TranslateIcon,
	UserIcon,
	UserListIcon,
} from '@phosphor-icons/react';
import type React from 'react';

export type AppearanceTabType = 'theme' | 'messages' | 'interface' | 'channel_list' | 'favorites';
export type AccessibilityTabType = 'visual' | 'keyboard' | 'animation' | 'motion';
export type ChatTab = 'display' | 'media' | 'input' | 'interaction';
export type VoiceVideoTabType = 'voice' | 'video';
export type PrivacySafetyTabType = 'connections' | 'communication' | 'data-export' | 'data-deletion';
export type AccountSecurityTabType = 'account' | 'security' | 'danger_zone';
export type DevTab = 'general' | 'account_premium' | 'mocking' | 'nagbars' | 'tools' | 'typography';
export type ComponentGalleryTabType = 'buttons' | 'inputs' | 'selections' | 'overlays' | 'indicators' | 'markdown';

export type UserSettingsSubtabType =
	| AppearanceTabType
	| AccessibilityTabType
	| ChatTab
	| VoiceVideoTabType
	| PrivacySafetyTabType
	| AccountSecurityTabType
	| DevTab
	| ComponentGalleryTabType;

type UserSettingsTabCategories = 'user_settings' | 'app_settings' | 'developer' | 'staff_only';

export interface SettingsTab {
	type: UserSettingsTabType;
	category: UserSettingsTabCategories;
	label: string;
	icon: Icon;
	iconWeight?: IconWeight;
}

interface SettingsTabDescriptor {
	type: UserSettingsTabType;
	category: UserSettingsTabCategories;
	label: MessageDescriptor;
	icon: Icon;
	iconWeight?: IconWeight;
}

export function getCategoryLabel(category: UserSettingsTabCategories): React.ReactElement {
	switch (category) {
		case 'user_settings':
			return <Trans>Your Account</Trans>;
		case 'app_settings':
			return <Trans>Application</Trans>;
		case 'developer':
			return <Trans>Developer</Trans>;
		case 'staff_only':
			return <Trans>Staff-Only</Trans>;
	}
}

const ALL_TABS_DESCRIPTORS: Array<SettingsTabDescriptor> = [
	{
		type: 'my_profile',
		category: 'user_settings',
		label: msg`Profile`,
		icon: UserIcon,
	},
	{
		type: 'account_security',
		category: 'user_settings',
		label: msg`Security & Login`,
		icon: ShieldIcon,
	},
	{
		type: 'plutonium',
		category: 'user_settings',
		label: msg`Fluxer Plutonium`,
		icon: CrownIcon,
	},
	{
		type: 'gift_inventory',
		category: 'user_settings',
		label: msg`Gifts & Codes`,
		icon: GiftIcon,
	},
	{
		type: 'expression_packs',
		category: 'user_settings',
		label: msg`Expression Packs`,
		icon: StickerIcon,
	},
	{
		type: 'privacy_safety',
		category: 'user_settings',
		label: msg`Privacy Dashboard`,
		icon: EyeSlashIcon,
	},
	{
		type: 'authorized_apps',
		category: 'user_settings',
		label: msg`Authorized Apps`,
		icon: RobotIcon,
	},
	{
		type: 'blocked_users',
		category: 'user_settings',
		label: msg`Blocked Users`,
		icon: ProhibitIcon,
	},
	{
		type: 'devices',
		category: 'user_settings',
		label: msg`Linked Devices`,
		icon: DevicesIcon,
	},
	{
		type: 'linked_accounts',
		category: 'user_settings',
		label: msg`Connections`,
		icon: UserListIcon,
	},
	{
		type: 'appearance',
		category: 'app_settings',
		label: msg`Look & Feel`,
		icon: PaintBrushIcon,
	},
	{
		type: 'accessibility',
		category: 'app_settings',
		label: msg`Accessibility`,
		icon: PersonSimpleCircleIcon,
	},
	{
		type: 'chat_settings',
		category: 'app_settings',
		label: msg`Messages & Media`,
		icon: ChatCircleIcon,
	},
	{
		type: 'voice_video',
		category: 'app_settings',
		label: msg`Audio & Video`,
		icon: MicrophoneIcon,
	},
	{
		type: 'keybinds',
		category: 'app_settings',
		label: msg`Keybinds`,
		icon: KeyboardIcon,
	},
	{
		type: 'notifications',
		category: 'app_settings',
		label: msg`Sounds & Alerts`,
		icon: BellIcon,
	},
	{
		type: 'language',
		category: 'app_settings',
		label: msg`Language & Time`,
		icon: TranslateIcon,
		iconWeight: 'bold',
	},
	{
		type: 'advanced',
		category: 'app_settings',
		label: msg`Advanced`,
		icon: FlaskIcon,
	},
	{
		type: 'applications',
		category: 'developer',
		label: msg`Applications`,
		icon: CodeIcon,
		iconWeight: 'bold',
	},
	{
		type: 'developer_options',
		category: 'staff_only',
		label: msg`Developer Tools`,
		icon: CodeIcon,
		iconWeight: 'bold',
	},
	{
		type: 'limits_config',
		category: 'staff_only',
		label: msg`Limits Config`,
		icon: FlagIcon,
	},
	{
		type: 'component_gallery',
		category: 'staff_only',
		label: msg`UI Kit`,
		icon: PaletteIcon,
	},
];

export const getSettingsTabs = (i18n: I18n): Array<SettingsTab> => {
	const allTabs = ALL_TABS_DESCRIPTORS.map((tab) => ({
		...tab,
		label: i18n._(tab.label),
	}));

	const isSelfHosted = RuntimeConfigStore.isSelfHosted();

	return allTabs.filter((tab) => {
		if (isSelfHosted && (tab.type === 'plutonium' || tab.type === 'gift_inventory')) {
			return false;
		}
		return true;
	});
};

export interface SettingsSubtab {
	type: UserSettingsSubtabType;
	parentTab: UserSettingsTabType;
	label: string;
}

interface SettingsSubtabDescriptor {
	type: UserSettingsSubtabType;
	parentTab: UserSettingsTabType;
	label: MessageDescriptor;
}

const SETTINGS_SUBTABS_DESCRIPTORS: Array<SettingsSubtabDescriptor> = [
	{type: 'theme', parentTab: 'appearance', label: msg`Theme`},
	{type: 'messages', parentTab: 'appearance', label: msg`Messages`},
	{type: 'interface', parentTab: 'appearance', label: msg`Interface`},
	{type: 'channel_list', parentTab: 'appearance', label: msg`Channel List`},
	{type: 'favorites', parentTab: 'appearance', label: msg`Favorites`},

	{type: 'visual', parentTab: 'accessibility', label: msg`Visual`},
	{type: 'keyboard', parentTab: 'accessibility', label: msg`Keyboard`},
	{type: 'animation', parentTab: 'accessibility', label: msg`Animation`},
	{type: 'motion', parentTab: 'accessibility', label: msg`Motion`},

	{type: 'display', parentTab: 'chat_settings', label: msg`Display`},
	{type: 'media', parentTab: 'chat_settings', label: msg`Media`},
	{type: 'input', parentTab: 'chat_settings', label: msg`Input`},
	{type: 'interaction', parentTab: 'chat_settings', label: msg`Interaction`},

	{type: 'voice', parentTab: 'voice_video', label: msg`Audio`},
	{type: 'video', parentTab: 'voice_video', label: msg`Video`},

	{type: 'connections', parentTab: 'privacy_safety', label: msg`Connections`},
	{type: 'communication', parentTab: 'privacy_safety', label: msg`Communication`},

	{type: 'account', parentTab: 'account_security', label: msg`Account`},
	{type: 'security', parentTab: 'account_security', label: msg`Security`},
	{type: 'danger_zone', parentTab: 'account_security', label: msg`Danger Zone`},

	{type: 'general', parentTab: 'developer_options', label: msg`General`},
	{type: 'account_premium', parentTab: 'developer_options', label: msg`Account & Premium`},
	{type: 'mocking', parentTab: 'developer_options', label: msg`Mocking`},
	{type: 'nagbars', parentTab: 'developer_options', label: msg`Nagbars`},
	{type: 'tools', parentTab: 'developer_options', label: msg`Tools`},
	{type: 'typography', parentTab: 'developer_options', label: msg`Typography`},

	{type: 'buttons', parentTab: 'component_gallery', label: msg`Buttons`},
	{type: 'inputs', parentTab: 'component_gallery', label: msg`Inputs & Text`},
	{type: 'selections', parentTab: 'component_gallery', label: msg`Selections`},
	{type: 'overlays', parentTab: 'component_gallery', label: msg`Overlays & Menus`},
	{type: 'indicators', parentTab: 'component_gallery', label: msg`Indicators & Status`},
	{type: 'markdown', parentTab: 'component_gallery', label: msg`Markdown`},
];

export const getSettingsSubtabs = (i18n: I18n): Array<SettingsSubtab> => {
	return SETTINGS_SUBTABS_DESCRIPTORS.map((subtab) => ({
		...subtab,
		label: i18n._(subtab.label),
	}));
};

export function getSubtabsForTab(tabType: UserSettingsTabType, i18n: I18n): Array<SettingsSubtab> {
	return getSettingsSubtabs(i18n).filter((subtab) => subtab.parentTab === tabType);
}

export function getSectionsForTab(tabType: UserSettingsTabType, i18n: I18n): Array<SettingsSectionConfig> {
	return registryGetSectionsForTab(tabType, i18n);
}

export function tabHasSections(tabType: UserSettingsTabType): boolean {
	return registryTabHasSections(tabType);
}

export function getSectionIdsForTab(tabType: UserSettingsTabType): Array<string> {
	return registryGetSectionIdsForTab(tabType);
}
