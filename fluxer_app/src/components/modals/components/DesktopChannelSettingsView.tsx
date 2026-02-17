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
import {modal} from '@app/actions/ModalActionCreators';
import {ChannelDeleteModal} from '@app/components/modals/ChannelDeleteModal';
import {SettingsModalHeader} from '@app/components/modals/components/SettingsModalHeader';
import styles from '@app/components/modals/GuildSettingsModal.module.css';
import {useUnsavedChangesFlash} from '@app/components/modals/hooks/useUnsavedChangesFlash';
import {
	SettingsModalDesktopContent,
	SettingsModalDesktopScroll,
	SettingsModalDesktopSidebar,
	SettingsModalSidebarCategory,
	SettingsModalSidebarCategoryTitle,
	SettingsModalSidebarFooter,
	SettingsModalSidebarItem,
	SettingsModalSidebarNav,
} from '@app/components/modals/shared/SettingsModalLayout';
import type {ChannelSettingsTab, ChannelSettingsTabType} from '@app/components/modals/utils/ChannelSettingsConstants';
import {Button} from '@app/components/uikit/button/Button';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import PermissionStore from '@app/stores/PermissionStore';
import SettingsSidebarStore from '@app/stores/SettingsSidebarStore';
import {openMessageHistoryThresholdSettings} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {ArrowLeftIcon, ArrowRightIcon, TrashIcon} from '@phosphor-icons/react';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef} from 'react';

interface DesktopChannelSettingsViewProps {
	channel: ChannelRecord;
	groupedSettingsTabs: Record<string, Array<ChannelSettingsTab>>;
	currentTab?: ChannelSettingsTab;
	selectedTab: ChannelSettingsTabType;
	onTabSelect: (tab: ChannelSettingsTabType) => void;
}

const CATEGORY_LABELS = {
	channel_settings: '',
};

export const DesktopChannelSettingsView: React.FC<DesktopChannelSettingsViewProps> = observer(
	({channel, groupedSettingsTabs, currentTab, selectedTab, onTabSelect}) => {
		const {t} = useLingui();
		const {showUnsavedBanner, flashBanner, tabData, checkUnsavedChanges} = useUnsavedChangesFlash(selectedTab);
		const prefersReducedMotion = AccessibilityStore.useReducedMotion;
		const contentRef = useRef<HTMLDivElement>(null);
		const focusContentPanel = useCallback(() => {
			contentRef.current?.focus();
		}, []);

		const channelPermissionsOverrideOwnerId = useMemo(() => `channel-permissions-${channel.id}`, [channel.id]);
		const canManageGuild = PermissionStore.can(Permissions.MANAGE_GUILD, {guildId: channel.guildId ?? ''});

		const handleTabSelect = useCallback(
			(tabType: ChannelSettingsTabType) => {
				if (checkUnsavedChanges()) return;
				if (
					tabType === 'permissions' &&
					SettingsSidebarStore.ownerId === channelPermissionsOverrideOwnerId &&
					SettingsSidebarStore.isDismissed(channelPermissionsOverrideOwnerId)
				) {
					SettingsSidebarStore.activateOverride(channelPermissionsOverrideOwnerId);
				}
				onTabSelect(tabType);
			},
			[checkUnsavedChanges, onTabSelect, channelPermissionsOverrideOwnerId],
		);

		const handleDeleteChannel = useCallback(() => {
			if (checkUnsavedChanges()) return;
			ModalActionCreators.push(modal(() => <ChannelDeleteModal channelId={channel.id} />));
		}, [channel.id, checkUnsavedChanges]);

		const handleClose = useCallback(() => {
			if (checkUnsavedChanges()) return;
			ModalActionCreators.pop();
		}, [checkUnsavedChanges]);

		const isCategory = channel.type === ChannelTypes.GUILD_CATEGORY;
		const useOverride = SettingsSidebarStore.useOverride;
		const activeTabPanelId = selectedTab ? `channel-settings-tabpanel-${selectedTab}` : undefined;
		const activeTabId = selectedTab ? `channel-settings-tab-${selectedTab}` : undefined;
		const hasSelectedTabInSidebar = useMemo(() => {
			if (!selectedTab || useOverride) {
				return false;
			}
			return Object.values(groupedSettingsTabs).some((tabs) => tabs.some((tab) => tab.type === selectedTab));
		}, [groupedSettingsTabs, selectedTab, useOverride]);
		const scrollKey = useMemo(
			() => `channel-settings-${channel.id}-${selectedTab ?? 'none'}`,
			[channel.id, selectedTab],
		);

		return (
			<>
				<SettingsModalDesktopSidebar>
					<div className={styles.sidebarHeader}>
						<div className={styles.guildName}>{channel.name}</div>
					</div>
					<SettingsModalSidebarNav hasSelectedTabInView={hasSelectedTabInSidebar}>
						<AnimatePresence mode="wait" initial={false}>
							{SettingsSidebarStore.hasOverride && useOverride ? (
								<motion.div
									key="custom"
									initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0}}
									animate={{opacity: 1}}
									exit={prefersReducedMotion ? {opacity: 1} : {opacity: 0}}
									transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2, ease: 'easeOut'}}
								>
									<div className={styles.sidebarButtonWrapper}>
										<Button
											variant="secondary"
											leftIcon={<ArrowLeftIcon className={styles.sidebarButtonIcon} />}
											onClick={() => SettingsSidebarStore.dismissOverride()}
										>
											{t`Back to Settings`}
										</Button>
									</div>
									{SettingsSidebarStore.overrideContent}
								</motion.div>
							) : (
								<motion.div
									key="global"
									initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0}}
									animate={{opacity: 1}}
									exit={prefersReducedMotion ? {opacity: 1} : {opacity: 0}}
									transition={prefersReducedMotion ? {duration: 0} : {duration: 0.2, ease: 'easeOut'}}
								>
									{SettingsSidebarStore.hasOverride &&
										SettingsSidebarStore.ownerId === channelPermissionsOverrideOwnerId &&
										!SettingsSidebarStore.isDismissed(channelPermissionsOverrideOwnerId) && (
											<div className={styles.sidebarButtonWrapper}>
												<Button
													variant="secondary"
													rightIcon={<ArrowRightIcon className={styles.sidebarButtonIcon} />}
													onClick={() => SettingsSidebarStore.activateOverride(channelPermissionsOverrideOwnerId)}
												>
													{t`Back to Overrides`}
												</Button>
											</div>
										)}
									{Object.entries(groupedSettingsTabs).map(([category, tabs]) => (
										<SettingsModalSidebarCategory key={category}>
											{category !== 'channel_settings' && (
												<SettingsModalSidebarCategoryTitle>
													{CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
												</SettingsModalSidebarCategoryTitle>
											)}
											{tabs.map((tab) => {
												const tabId = `channel-settings-tab-${tab.type}`;
												const panelId = `channel-settings-tabpanel-${tab.type}`;
												return (
													<SettingsModalSidebarItem
														key={tab.type}
														icon={tab.icon}
														label={tab.label}
														selected={tab.type === selectedTab}
														onClick={() => handleTabSelect(tab.type)}
														onRequestContentFocus={focusContentPanel}
														id={tabId}
														controlsId={panelId}
													/>
												);
											})}
										</SettingsModalSidebarCategory>
									))}
									{!useOverride && (
										<SettingsModalSidebarItem
											icon={TrashIcon}
											label={isCategory ? t`Delete Category` : t`Delete Channel`}
											danger={true}
											onClick={handleDeleteChannel}
										/>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</SettingsModalSidebarNav>
					{selectedTab === 'permissions' && canManageGuild && channel.guildId && SettingsSidebarStore.useOverride && (
						<SettingsModalSidebarFooter>
							<Button
								variant="secondary"
								small={true}
								fitContainer={true}
								onClick={() => openMessageHistoryThresholdSettings(channel.guildId!)}
							>
								{t`Message History Threshold`}
							</Button>
						</SettingsModalSidebarFooter>
					)}
				</SettingsModalDesktopSidebar>
				<SettingsModalDesktopContent ref={contentRef} tabpanelId={activeTabPanelId} labelledBy={activeTabId}>
					<SettingsModalHeader
						title={currentTab?.label || (isCategory ? t`Category Settings` : t`Channel Settings`)}
						showUnsavedBanner={showUnsavedBanner}
						flashBanner={flashBanner}
						tabData={tabData}
						onClose={handleClose}
					/>
					<SettingsModalDesktopScroll scrollKey={scrollKey}>
						{currentTab && <currentTab.component channelId={channel.id} />}
					</SettingsModalDesktopScroll>
				</SettingsModalDesktopContent>
			</>
		);
	},
);
