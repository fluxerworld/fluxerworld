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
import type {MobileNavigationState} from '@app/components/modals/hooks/useMobileNavigation';
import {useUnsavedChangesFlash} from '@app/components/modals/hooks/useUnsavedChangesFlash';
import {
	MobileHeader,
	MobileHeaderWithBanner,
	MobileSettingsDangerItem,
	MobileSettingsList,
} from '@app/components/modals/shared/MobileSettingsComponents';
import styles from '@app/components/modals/UserSettingsModal.module.css';
import type {ChannelSettingsTab, ChannelSettingsTabType} from '@app/components/modals/utils/ChannelSettingsConstants';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {TrashIcon} from '@phosphor-icons/react';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {type UIEvent, useCallback, useEffect, useRef} from 'react';

interface MobileChannelSettingsViewProps {
	channel: ChannelRecord;
	groupedSettingsTabs: Record<string, Array<ChannelSettingsTab>>;
	currentTab?: ChannelSettingsTab;
	mobileNav: MobileNavigationState<ChannelSettingsTabType>;
	onBack: () => void;
	onTabSelect: (tabType: string, title: string) => void;
}

const contentFadeVariants = {
	enter: {
		opacity: 0,
	},
	center: {
		opacity: 1,
	},
	exit: {
		opacity: 0,
	},
};

const headerFadeVariants = {
	enter: {
		opacity: 0,
	},
	center: {
		opacity: 1,
	},
	exit: {
		opacity: 0,
	},
};

export const MobileChannelSettingsView: React.FC<MobileChannelSettingsViewProps> = observer(
	({channel, groupedSettingsTabs, currentTab, mobileNav, onBack, onTabSelect}) => {
		const {t} = useLingui();
		const reducedMotion = AccessibilityStore.useReducedMotion;
		const currentTabId = mobileNav.currentView?.tab;
		const {showUnsavedBanner, flashBanner, tabData, checkUnsavedChanges} = useUnsavedChangesFlash(currentTabId);

		const handleDeleteChannel = useCallback(() => {
			ModalActionCreators.push(modal(() => <ChannelDeleteModal channelId={channel.id} />));
		}, [channel.id]);

		const handleBack = useCallback(() => {
			if (checkUnsavedChanges()) return;
			onBack();
		}, [checkUnsavedChanges, onBack]);

		const handleTabSelect = useCallback(
			(tabType: string, title: string) => {
				if (checkUnsavedChanges()) return;
				onTabSelect(tabType, title);
			},
			[checkUnsavedChanges, onTabSelect],
		);

		const isCategory = channel.type === ChannelTypes.GUILD_CATEGORY;

		const showMobileList = mobileNav.isRootView;
		const showMobileContent = !mobileNav.isRootView;
		const listScrollPositionRef = useRef(0);
		const listScrollerRef = useRef<ScrollerHandle | null>(null);
		const handleListScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
			listScrollPositionRef.current = event.currentTarget.scrollTop;
		}, []);

		useEffect(() => {
			if (!showMobileList) return;
			const scroller = listScrollerRef.current;
			if (!scroller) return;
			const target = listScrollPositionRef.current;
			if (target === 0) return;
			scroller.scrollTo({to: target, animate: false});
		}, [showMobileList]);

		const dangerAction = (
			<MobileSettingsDangerItem
				icon={TrashIcon}
				label={isCategory ? t`Delete Category` : t`Delete Channel`}
				onClick={handleDeleteChannel}
			/>
		);

		return (
			<div className={styles.mobileWrapper}>
				<div className={styles.mobileHeaderContainer}>
					<AnimatePresence mode="wait" custom={mobileNav.direction}>
						{showMobileList && (
							<motion.div
								key="mobile-list-header"
								variants={reducedMotion ? undefined : headerFadeVariants}
								initial="center"
								animate="center"
								exit={reducedMotion ? 'center' : 'exit'}
								transition={{duration: reducedMotion ? 0 : 0.08, ease: 'easeInOut'}}
								className={styles.mobileHeaderContent}
							>
								<MobileHeader title={channel.name || ''} onBack={handleBack} />
							</motion.div>
						)}

						{showMobileContent && currentTab && (
							<motion.div
								key={`mobile-content-header-${mobileNav.currentView?.tab}`}
								variants={reducedMotion ? undefined : headerFadeVariants}
								initial={reducedMotion ? 'center' : 'enter'}
								animate="center"
								exit={reducedMotion ? 'center' : 'exit'}
								transition={{duration: reducedMotion ? 0 : 0.08, ease: 'easeInOut'}}
								className={styles.mobileHeaderContent}
							>
								<MobileHeaderWithBanner
									title={mobileNav.currentView?.title || currentTab.label}
									onBack={handleBack}
									showUnsavedBanner={showUnsavedBanner}
									flashBanner={flashBanner}
									tabData={tabData}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>

				<div className={styles.mobileContentContainer}>
					<AnimatePresence mode="wait" custom={mobileNav.direction}>
						{showMobileList && (
							<motion.div
								key="mobile-list-content"
								custom={mobileNav.direction}
								variants={reducedMotion ? undefined : contentFadeVariants}
								initial="center"
								animate="center"
								exit={reducedMotion ? 'center' : 'exit'}
								transition={{duration: reducedMotion ? 0 : 0.15, ease: 'easeInOut'}}
								className={styles.mobileContentPane}
								style={{willChange: 'transform'}}
							>
								<MobileSettingsList
									groupedTabs={groupedSettingsTabs}
									onTabSelect={handleTabSelect}
									hiddenCategories={['channel_settings']}
									dangerContent={dangerAction}
									scrollRef={listScrollerRef}
									onScroll={handleListScroll}
								/>
							</motion.div>
						)}

						{showMobileContent && currentTab && (
							<motion.div
								key={`mobile-content-${mobileNav.currentView?.tab}`}
								custom={mobileNav.direction}
								variants={reducedMotion ? undefined : contentFadeVariants}
								initial={reducedMotion ? 'center' : 'enter'}
								animate="center"
								exit={reducedMotion ? 'center' : 'exit'}
								transition={{duration: reducedMotion ? 0 : 0.15, ease: 'easeInOut'}}
								className={styles.mobileContentPane}
								style={{willChange: 'transform'}}
							>
								<Scroller className={styles.mobileContentScroller} key="mobile-channel-settings-content-scroller">
									<div className={styles.mobileContentInner}>
										<currentTab.component channelId={channel.id} />
									</div>
								</Scroller>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		);
	},
);
