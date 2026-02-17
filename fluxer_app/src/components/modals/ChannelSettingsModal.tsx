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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as UnsavedChangesActionCreators from '@app/actions/UnsavedChangesActionCreators';
import {DesktopChannelSettingsView} from '@app/components/modals/components/DesktopChannelSettingsView';
import {MobileChannelSettingsView} from '@app/components/modals/components/MobileChannelSettingsView';
import {useMobileNavigation} from '@app/components/modals/hooks/useMobileNavigation';
import * as Modal from '@app/components/modals/Modal';
import {SettingsModalContainer} from '@app/components/modals/shared/SettingsModalLayout';
import type {ChannelSettingsTabType} from '@app/components/modals/utils/ChannelSettingsConstants';
import ChannelStore from '@app/stores/ChannelStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import UnsavedChangesStore from '@app/stores/UnsavedChangesStore';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import {
	type ChannelSettingsModalProps,
	getAvailableTabs,
	getGroupedSettingsTabs,
} from '@app/utils/modals/ChannelSettingsModalUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = observer(({channelId, initialMobileTab}) => {
	const {t, i18n} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const guildId = channel?.guildId;
	const [selectedTab, setSelectedTab] = useState<ChannelSettingsTabType>('overview');

	const availableTabs = useMemo(() => {
		return getAvailableTabs(i18n, channelId);
	}, [i18n, channelId]);

	const isMobileExp = isMobileExperienceEnabled();

	const initialTab = useMemo(() => {
		if (!isMobileExp || !initialMobileTab) return;
		const targetTab = availableTabs.find((tab) => tab.type === initialMobileTab);
		if (!targetTab) return;
		return {tab: initialMobileTab, title: targetTab.label};
	}, [initialMobileTab, availableTabs, isMobileExp]);

	const mobileNav = useMobileNavigation<ChannelSettingsTabType>(initialTab);
	const {enabled: isMobile} = MobileLayoutStore;
	const unsavedChangesStore = UnsavedChangesStore;

	useEffect(() => {
		if (guildId) {
			GatewayConnectionStore.syncGuildIfNeeded(guildId, 'channel-settings-modal');
		}
	}, [guildId]);

	useEffect(() => {
		if (!channel) {
			ModalActionCreators.pop();
		}
	}, [channel]);

	const groupedSettingsTabs = useMemo(() => {
		return getGroupedSettingsTabs(availableTabs);
	}, [availableTabs]);

	const currentTab = useMemo(() => {
		if (!isMobile) {
			return availableTabs.find((tab) => tab.type === selectedTab);
		}
		if (mobileNav.isRootView) return;
		return availableTabs.find((tab) => tab.type === mobileNav.currentView?.tab);
	}, [isMobile, selectedTab, mobileNav.isRootView, mobileNav.currentView, availableTabs]);

	const handleMobileBack = useCallback(() => {
		if (mobileNav.isRootView) {
			ModalActionCreators.pop();
		} else {
			mobileNav.navigateBack();
		}
	}, [mobileNav]);

	const handleTabSelect = useCallback(
		(tabType: string, title: string) => {
			mobileNav.navigateTo(tabType as ChannelSettingsTabType, title);
		},
		[mobileNav],
	);

	const currentMobileTab = mobileNav.currentView?.tab;
	const handleClose = useCallback(() => {
		const checkTabId = isMobile ? currentMobileTab : selectedTab;
		if (checkTabId && unsavedChangesStore.unsavedChanges[checkTabId]) {
			UnsavedChangesActionCreators.triggerFlashEffect(checkTabId);
			return;
		}
		ModalActionCreators.pop();
	}, [currentMobileTab, isMobile, selectedTab, unsavedChangesStore.unsavedChanges]);

	if (!channel) {
		return null;
	}

	const isCategory = channel.type === ChannelTypes.GUILD_CATEGORY;

	return (
		<Modal.Root size="fullscreen" onClose={handleClose}>
			<Modal.ScreenReaderLabel text={isCategory ? t`Category Settings` : t`Channel Settings`} />
			<SettingsModalContainer fullscreen={true}>
				{isMobile ? (
					<MobileChannelSettingsView
						channel={channel}
						groupedSettingsTabs={groupedSettingsTabs}
						currentTab={currentTab}
						mobileNav={mobileNav}
						onBack={handleMobileBack}
						onTabSelect={handleTabSelect}
					/>
				) : (
					<DesktopChannelSettingsView
						channel={channel}
						groupedSettingsTabs={groupedSettingsTabs}
						currentTab={currentTab}
						selectedTab={selectedTab}
						onTabSelect={setSelectedTab}
					/>
				)}
			</SettingsModalContainer>
		</Modal.Root>
	);
});
