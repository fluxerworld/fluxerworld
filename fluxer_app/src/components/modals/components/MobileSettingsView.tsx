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
import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import {LongPressable} from '@app/components/LongPressable';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {ClientInfo} from '@app/components/modals/components/ClientInfo';
import {LogoutModal} from '@app/components/modals/components/LogoutModal';
import styles from '@app/components/modals/components/MobileSettingsView.module.css';
import type {MobileNavigationState} from '@app/components/modals/hooks/useMobileNavigation';
import {useSettingsContentKey} from '@app/components/modals/hooks/useSettingsContentKey';
import {useUnsavedChangesFlash} from '@app/components/modals/hooks/useUnsavedChangesFlash';
import {
	MobileHeader,
	MobileHeaderWithBanner,
	MobileSettingsDangerItem,
} from '@app/components/modals/shared/MobileSettingsComponents';
import userSettingsStyles from '@app/components/modals/UserSettingsModal.module.css';
import {getSettingsTabComponent} from '@app/components/modals/utils/DesktopSettingsTabs';
import type {SettingsTab} from '@app/components/modals/utils/SettingsConstants';
import {getCategoryLabel} from '@app/components/modals/utils/SettingsConstants';
import type {UserSettingsTabType} from '@app/components/modals/utils/SettingsSectionRegistry';
import {filterSettingsTabsForDeveloperMode} from '@app/components/modals/utils/SettingsTabFilters';
import {MentionBadgeAnimated} from '@app/components/uikit/MentionBadge';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {usePressable} from '@app/hooks/usePressable';
import {usePushSubscriptions} from '@app/hooks/usePushSubscriptions';
import {Logger} from '@app/lib/Logger';
import {activateLatestServiceWorker} from '@app/lib/Versioning';
import * as PushSubscriptionService from '@app/services/push/PushSubscriptionService';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import UserStore from '@app/stores/UserStore';
import {isPwaOnMobileOrTablet} from '@app/utils/PwaUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {ArrowClockwiseIcon, ArrowLeftIcon, BellSlashIcon, type IconWeight, SignOutIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import React, {type UIEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('MobileSettingsView');

interface MobileSettingsViewProps {
	groupedSettingsTabs: Record<string, Array<SettingsTab>>;
	currentTab: SettingsTab | undefined;
	mobileNav: MobileNavigationState;
	onBack: () => void;
	onTabSelect: (tab: string, title: string) => void;
	initialGuildId?: string;
	initialSubtab?: string;
}

interface PressableSettingsItemProps {
	tab: SettingsTab;
	onSelect: () => void;
	badge?: React.ReactNode;
}

const PressableSettingsItem: React.FC<PressableSettingsItemProps> = observer(({tab, onSelect, badge}) => {
	const {isPressed, pressableProps} = usePressable();
	const IconComponent = tab.icon;

	return (
		<LongPressable
			className={clsx(styles.settingsItem, isPressed && styles.settingsItemPressed)}
			role="button"
			tabIndex={0}
			onClick={onSelect}
			{...pressableProps}
		>
			<IconComponent className={styles.settingsItemIcon} weight={tab.iconWeight ?? 'fill'} />
			<div className={styles.settingsItemContent}>
				<div className={styles.settingsItemLabelContainer}>
					<span className={styles.settingsItemLabel}>{tab.label}</span>
					{badge}
				</div>
			</div>
			<ArrowLeftIcon className={styles.settingsItemArrow} />
		</LongPressable>
	);
});

interface MobileSettingsActionItemProps {
	icon: React.ComponentType<{className?: string; weight?: IconWeight}>;
	label: React.ReactNode;
	onClick: () => void;
	isLoading?: boolean;
	iconWeight?: IconWeight;
	showArrow?: boolean;
}

const MobileSettingsActionItem: React.FC<MobileSettingsActionItemProps> = observer(
	({icon: IconComponent, label, onClick, isLoading = false, iconWeight, showArrow = true}) => {
		const {isPressed, pressableProps} = usePressable();

		return (
			<LongPressable
				className={clsx(styles.settingsItem, isPressed && styles.settingsItemPressed)}
				role="button"
				tabIndex={0}
				onClick={onClick}
				{...pressableProps}
			>
				<IconComponent className={styles.settingsItemIcon} weight={iconWeight ?? 'regular'} />
				<div className={styles.settingsItemContent}>
					<div className={styles.settingsItemLabelContainer}>
						<span className={styles.settingsItemLabel}>{label}</span>
						{isLoading && <Spinner size="small" className={styles.settingsItemSpinner} />}
					</div>
				</div>
				{showArrow && <ArrowLeftIcon className={styles.settingsItemArrow} />}
			</LongPressable>
		);
	},
);

const ServiceWorkerUpdateButton = observer(() => {
	const {t} = useLingui();
	const [isUpdating, setIsUpdating] = useState(false);

	const handleUpdateServiceWorker = async () => {
		if (isUpdating) return;
		setIsUpdating(true);
		try {
			await activateLatestServiceWorker();
			window.location.reload();
		} catch (error) {
			logger.error('Failed to update service worker:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<MobileSettingsActionItem
			icon={ArrowClockwiseIcon}
			iconWeight="bold"
			label={t`Update Service Worker`}
			onClick={handleUpdateServiceWorker}
			isLoading={isUpdating}
			showArrow={false}
		/>
	);
});

const MOBILE_HIDDEN_TAB_TYPES = new Set<UserSettingsTabType>(['keybinds']);

const MobileSettingsList = observer(
	({
		groupedTabs,
		onTabSelect,
		scrollRef,
		onScroll,
	}: {
		groupedTabs: Record<string, Array<SettingsTab>>;
		onTabSelect: (tab: string, title: string) => void;
		scrollRef?: React.Ref<ScrollerHandle>;
		onScroll?: (event: UIEvent<HTMLDivElement>) => void;
	}) => {
		const {t} = useLingui();
		const currentUser = UserStore.currentUser;
		const isDeveloper = DeveloperModeStore.isDeveloper;

		const filteredTabs = useMemo(
			() => filterSettingsTabsForDeveloperMode(groupedTabs, isDeveloper),
			[groupedTabs, isDeveloper],
		);

		const mobileVisibleTabs = useMemo(() => {
			const visibleTabs: Record<string, Array<SettingsTab>> = {};
			Object.entries(filteredTabs).forEach(([category, tabs]) => {
				const filteredCategoryTabs = tabs.filter((tab) => !MOBILE_HIDDEN_TAB_TYPES.has(tab.type));
				if (filteredCategoryTabs.length > 0) {
					visibleTabs[category] = filteredCategoryTabs;
				}
			});
			return visibleTabs;
		}, [filteredTabs]);

		const handleLogout = useCallback(() => {
			ModalActionCreators.push(modal(() => <LogoutModal />));
		}, []);

		const isPwaMobile = isPwaOnMobileOrTablet();
		const {subscriptions, refresh: refreshPushSubscriptions} = usePushSubscriptions(isPwaMobile);
		const showForgetPushAction = isPwaMobile && subscriptions.length > 0;

		const handleForgetPushSubscriptions = useCallback(() => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Forget Push Subscriptions?`}
						description={
							<p>
								<Trans>Clearing subscriptions ensures the gateway stops sending messages to this installation.</Trans>
							</p>
						}
						primaryText={t`Forget`}
						primaryVariant="primary"
						secondaryText={t`Cancel`}
						onPrimary={async () => {
							await PushSubscriptionService.unregisterAllPushSubscriptions();
							await refreshPushSubscriptions();
							NagbarActionCreators.dismissNagbar('desktopNotificationDismissed');
						}}
						onSecondary={() => {
							ModalActionCreators.pop();
						}}
					/>
				)),
			);
		}, [refreshPushSubscriptions, t]);

		const debugActions = useMemo(() => {
			const actions: Array<{key: string; element: React.ReactElement}> = [
				{key: 'update', element: <ServiceWorkerUpdateButton key="service-worker" />},
			];
			if (showForgetPushAction) {
				actions.push({
					key: 'forget',
					element: (
						<MobileSettingsActionItem
							icon={BellSlashIcon}
							iconWeight="fill"
							label={t`Forget Push Subscriptions`}
							onClick={handleForgetPushSubscriptions}
							showArrow={false}
						/>
					),
				});
			}
			return actions;
		}, [handleForgetPushSubscriptions, showForgetPushAction, t]);
		const lastDebugActionIndex = debugActions.length - 1;

		const categories = Object.entries(mobileVisibleTabs);
		const lastCategoryIndex = categories.length - 1;

		return (
			<Scroller
				className={styles.scrollerContainer}
				key="mobile-settings-list-scroller"
				ref={scrollRef}
				onScroll={onScroll}
			>
				{categories.map(([category, tabs], categoryIndex) => (
					<div key={category} className={styles.categorySection}>
						<h2 className={styles.categoryTitle}>{getCategoryLabel(category as SettingsTab['category'])}</h2>
						<div className={styles.categoryList}>
							{tabs.map((tab, index) => {
								const isLastTab = index === tabs.length - 1;
								const isLastCategory = categoryIndex === lastCategoryIndex;
								const badge =
									tab.type === 'gift_inventory' && currentUser?.hasUnreadGiftInventory ? (
										<MentionBadgeAnimated mentionCount={currentUser.unreadGiftInventoryCount ?? 1} />
									) : undefined;
								return (
									<div key={tab.type}>
										<PressableSettingsItem tab={tab} onSelect={() => onTabSelect(tab.type, tab.label)} badge={badge} />
										{(!isLastTab || isLastCategory) && <div className={styles.divider} />}
									</div>
								);
							})}
							{categoryIndex === lastCategoryIndex && (
								<MobileSettingsDangerItem icon={SignOutIcon} label={t`Log Out`} onClick={handleLogout} />
							)}
						</div>
					</div>
				))}
				{debugActions.length > 0 && (
					<div className={styles.categorySection}>
						<h2 className={styles.categoryTitle}>{t`Debug`}</h2>
						<div className={styles.categoryList}>
							{debugActions.map((action, index) => (
								<div key={action.key}>
									{action.element}
									{index !== lastDebugActionIndex && <div className={styles.divider} />}
								</div>
							))}
						</div>
					</div>
				)}
				<div className={styles.clientInfoContainer}>
					<ClientInfo />
				</div>
			</Scroller>
		);
	},
);

const contentFadeVariants = {
	enter: {opacity: 0},
	center: {opacity: 1},
	exit: {opacity: 0},
};

const headerFadeVariants = {
	enter: {opacity: 0},
	center: {opacity: 1},
	exit: {opacity: 0},
};

interface MobileContentWithScrollSpyProps {
	scrollKey: string;
	initialGuildId?: string;
	initialSubtab?: string;
	currentTabComponent: React.ComponentType<Record<string, unknown>> | null;
}

const MobileContentWithScrollSpy: React.FC<MobileContentWithScrollSpyProps> = observer(
	({scrollKey, initialGuildId, initialSubtab, currentTabComponent}) => {
		return (
			<Scroller className={styles.scrollerFlex} key={scrollKey} data-settings-scroll-container>
				<div className={styles.contentContainer}>
					{currentTabComponent &&
						React.createElement(currentTabComponent, {
							...(initialGuildId ? {initialGuildId} : {}),
							...(initialSubtab ? {initialSubtab} : {}),
						} as Record<string, unknown>)}
				</div>
			</Scroller>
		);
	},
);

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = observer(
	({groupedSettingsTabs, currentTab, mobileNav, onBack, onTabSelect, initialGuildId, initialSubtab}) => {
		const {t} = useLingui();
		const currentTabId = mobileNav.currentView?.tab;
		const {showUnsavedBanner, flashBanner, tabData, checkUnsavedChanges} = useUnsavedChangesFlash(currentTabId);
		const {contentKey} = useSettingsContentKey();
		const scrollKey = useMemo(() => {
			if (!currentTabId) {
				return 'user-settings-mobile-root';
			}

			const subtabKey = contentKey ?? initialSubtab ?? 'root';
			return `user-settings-${currentTabId}-${subtabKey}`;
		}, [contentKey, currentTabId, initialSubtab]);

		const handleBack = useCallback(() => {
			if (checkUnsavedChanges()) return;
			onBack();
		}, [checkUnsavedChanges, onBack]);

		const handleTabSelect = useCallback(
			(tab: string, title: string) => {
				if (checkUnsavedChanges()) return;
				onTabSelect(tab, title);
			},
			[checkUnsavedChanges, onTabSelect],
		);

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
		const currentTabComponent = currentTab ? getSettingsTabComponent(currentTab.type) : null;

		return (
			<div className={userSettingsStyles.mobileWrapper}>
				<div className={userSettingsStyles.mobileHeaderContainer}>
					<AnimatePresence mode="wait" custom={mobileNav.direction}>
						{showMobileList && (
							<motion.div
								key="mobile-list-header"
								variants={headerFadeVariants}
								initial="center"
								animate="center"
								exit="exit"
								transition={{duration: 0.08, ease: 'easeInOut'}}
								className={userSettingsStyles.mobileHeaderContent}
							>
								<MobileHeader title={t`Settings`} onBack={() => ModalActionCreators.pop()} />
							</motion.div>
						)}
						{showMobileContent && currentTab && (
							<motion.div
								key={`mobile-content-header-${mobileNav.currentView?.tab}`}
								variants={headerFadeVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{duration: 0.08, ease: 'easeInOut'}}
								className={userSettingsStyles.mobileHeaderContent}
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
				<div className={userSettingsStyles.mobileContentContainer}>
					<AnimatePresence mode="wait" custom={mobileNav.direction}>
						{showMobileList && (
							<motion.div
								key="mobile-list-content"
								custom={mobileNav.direction}
								variants={contentFadeVariants}
								initial="center"
								animate="center"
								exit="exit"
								transition={{duration: 0.15, ease: 'easeInOut'}}
								className={userSettingsStyles.mobileContentPane}
								style={{willChange: 'transform'}}
							>
								<MobileSettingsList
									groupedTabs={groupedSettingsTabs}
									onTabSelect={handleTabSelect}
									scrollRef={listScrollerRef}
									onScroll={handleListScroll}
								/>
							</motion.div>
						)}
						{showMobileContent && currentTab && (
							<motion.div
								key={`mobile-content-${mobileNav.currentView?.tab}`}
								custom={mobileNav.direction}
								variants={contentFadeVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{duration: 0.15, ease: 'easeInOut'}}
								className={userSettingsStyles.mobileContentPane}
								style={{willChange: 'transform'}}
							>
								<MobileContentWithScrollSpy
									scrollKey={scrollKey}
									initialGuildId={initialGuildId}
									initialSubtab={initialSubtab}
									currentTabComponent={currentTabComponent}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		);
	},
);
