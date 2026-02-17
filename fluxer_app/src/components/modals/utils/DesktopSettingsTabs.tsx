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

import {AccessibilityTab} from '@app/components/modals/tabs/AccessibilityTab';
import AccountSecurityTab from '@app/components/modals/tabs/AccountSecurityTab';
import AdvancedTab from '@app/components/modals/tabs/AdvancedTab';
import {AppearanceTab} from '@app/components/modals/tabs/AppearanceTab';
import AuthorizedAppsTab from '@app/components/modals/tabs/AuthorizedAppsTab';
import ApplicationsTab from '@app/components/modals/tabs/applications_tab';
import BlockedUsersTab from '@app/components/modals/tabs/BlockedUsersTab';
import ChatSettingsTab from '@app/components/modals/tabs/ChatSettingsTab';
import ComponentGalleryTab from '@app/components/modals/tabs/component_gallery_tab';
import DevicesTab from '@app/components/modals/tabs/DevicesTab';
import DeveloperOptionsTab from '@app/components/modals/tabs/developer_options_tab';
import ExpressionPacksTab from '@app/components/modals/tabs/ExpressionPacksTab';
import GiftInventoryTab from '@app/components/modals/tabs/GiftInventoryTab';
import KeybindsTab from '@app/components/modals/tabs/KeybindsTab';
import LanguageTab from '@app/components/modals/tabs/LanguageTab';
import LimitsConfigTab from '@app/components/modals/tabs/LimitsConfigTab';
import LinkedAccountsTab from '@app/components/modals/tabs/LinkedAccountsTab';
import MyProfileTab from '@app/components/modals/tabs/MyProfileTab';
import NotificationsTab from '@app/components/modals/tabs/NotificationsTab';
import PlutoniumTab from '@app/components/modals/tabs/PlutoniumTab';
import PrivacySafetyTab from '@app/components/modals/tabs/PrivacySafetyTab';
import VoiceVideoTab from '@app/components/modals/tabs/VoiceVideoTab';
import type {UserSettingsTabType} from '@app/components/modals/utils/SettingsSectionRegistry';
import type React from 'react';

const DESKTOP_TAB_COMPONENTS: Partial<Record<UserSettingsTabType, React.ComponentType<Record<string, unknown>>>> = {
	my_profile: MyProfileTab,
	account_security: AccountSecurityTab,
	plutonium: PlutoniumTab,
	gift_inventory: GiftInventoryTab,
	privacy_safety: PrivacySafetyTab,
	authorized_apps: AuthorizedAppsTab,
	blocked_users: BlockedUsersTab,
	devices: DevicesTab,
	linked_accounts: LinkedAccountsTab,
	appearance: AppearanceTab,
	accessibility: AccessibilityTab,
	chat_settings: ChatSettingsTab,
	voice_video: VoiceVideoTab,
	keybinds: KeybindsTab,
	notifications: NotificationsTab,
	language: LanguageTab,
	advanced: AdvancedTab,
	applications: ApplicationsTab,
	limits_config: LimitsConfigTab,
	developer_options: DeveloperOptionsTab,
	component_gallery: ComponentGalleryTab,
	expression_packs: ExpressionPacksTab,
};

export const getSettingsTabComponent = (
	tabType: UserSettingsTabType,
): React.ComponentType<Record<string, unknown>> | null => {
	return DESKTOP_TAB_COMPONENTS[tabType] ?? null;
};
