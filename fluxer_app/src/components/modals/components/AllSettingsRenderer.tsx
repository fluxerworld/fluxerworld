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

import '@app/components/modals/components/SettingsSearchHighlight.css';
import styles from '@app/components/modals/components/AllSettingsRenderer.module.css';
import AdvancedTab from '@app/components/modals/tabs/AdvancedTab';
import AuthorizedAppsTab from '@app/components/modals/tabs/AuthorizedAppsTab';
import {AccessibilityInlineContent} from '@app/components/modals/tabs/accessibility_tab/Inline';
import {AccountSecurityInlineTab} from '@app/components/modals/tabs/account_security_tab/Inline';
import {AppearanceInlineContent} from '@app/components/modals/tabs/appearance_tab/Inline';
import ApplicationsTab from '@app/components/modals/tabs/applications_tab';
import BlockedUsersTab from '@app/components/modals/tabs/BlockedUsersTab';
import {ChatSettingsInlineContent} from '@app/components/modals/tabs/chat_settings_tab/Inline';
import {ComponentGalleryInlineTab} from '@app/components/modals/tabs/component_gallery_tab/Inline';
import DevicesTab from '@app/components/modals/tabs/DevicesTab';
import {DeveloperOptionsInlineContent} from '@app/components/modals/tabs/developer_options_tab/Inline';
import ExpressionPacksTab from '@app/components/modals/tabs/ExpressionPacksTab';
import GiftInventoryTab from '@app/components/modals/tabs/GiftInventoryTab';
import KeybindsTab from '@app/components/modals/tabs/KeybindsTab';
import LanguageTab from '@app/components/modals/tabs/LanguageTab';
import LimitsConfigTab from '@app/components/modals/tabs/LimitsConfigTab';
import LinkedAccountsTab from '@app/components/modals/tabs/LinkedAccountsTab';
import MyProfileTab from '@app/components/modals/tabs/MyProfileTab';
import {NotificationsInlineContent} from '@app/components/modals/tabs/notifications_tab/Inline';
import PlutoniumTab from '@app/components/modals/tabs/PlutoniumTab';
import {PrivacySafetyInlineContent} from '@app/components/modals/tabs/privacy_safety_tab/Inline';
import {VoiceVideoInlineContent} from '@app/components/modals/tabs/voice_video_tab/Inline';
import {getSettingsTabComponent} from '@app/components/modals/utils/DesktopSettingsTabs';
import type {SettingsTab} from '@app/components/modals/utils/SettingsConstants';
import type {SettingsSearchResult} from '@app/components/modals/utils/SettingsSearchIndex';
import type {SearchableSettingItem, UserSettingsTabType} from '@app/components/modals/utils/SettingsSectionRegistry';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import {clearHighlights, createRangesForSection, setHighlightRanges} from '@app/utils/CSSHighlightSearch';
import {Trans} from '@lingui/react/macro';
import {CaretRightIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useEffect, useRef, useState} from 'react';

interface AllSettingsRendererProps {
	searchQuery: string;
	searchResults: Array<SettingsSearchResult>;
	groupedSettingsTabs: Record<string, Array<SettingsTab>>;
	initialGuildId?: string;
}

interface SettingsSectionProps {
	tab: SettingsTab;
	matchedItems: Array<SearchableSettingItem>;
	searchQuery: string;
	initialGuildId?: string;
	isExpanded: boolean;
	onToggleExpand: () => void;
}

const INLINE_TAB_COMPONENTS: Partial<Record<UserSettingsTabType, React.ComponentType<Record<string, unknown>>>> = {
	my_profile: MyProfileTab,
	account_security: AccountSecurityInlineTab,
	plutonium: PlutoniumTab,
	gift_inventory: GiftInventoryTab,
	expression_packs: ExpressionPacksTab,
	privacy_safety: PrivacySafetyInlineContent,
	authorized_apps: AuthorizedAppsTab,
	blocked_users: BlockedUsersTab,
	devices: DevicesTab,
	appearance: AppearanceInlineContent,
	accessibility: AccessibilityInlineContent,
	chat_settings: ChatSettingsInlineContent,
	voice_video: VoiceVideoInlineContent,
	notifications: NotificationsInlineContent,
	language: LanguageTab,
	advanced: AdvancedTab,
	applications: ApplicationsTab,
	keybinds: KeybindsTab,
	developer_options: DeveloperOptionsInlineContent,
	component_gallery: ComponentGalleryInlineTab,
	limits_config: LimitsConfigTab,
	linked_accounts: LinkedAccountsTab,
};

const getInlineTabComponent = (tab: SettingsTab): React.ComponentType<Record<string, unknown>> | null => {
	const inlineComponent = INLINE_TAB_COMPONENTS[tab.type as UserSettingsTabType];
	return inlineComponent ?? getSettingsTabComponent(tab.type) ?? null;
};

const SettingsSection: React.FC<SettingsSectionProps> = observer(
	({tab, matchedItems, initialGuildId, isExpanded, onToggleExpand}) => {
		const contentRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			if (contentRef.current) {
				contentRef.current.setAttribute('data-settings-section', tab.type);
			}
		}, [tab.type]);

		if (tab.category === 'staff_only' && !DeveloperModeStore.isDeveloper) {
			return null;
		}

		const InlineComponent = getInlineTabComponent(tab);

		if (!InlineComponent) {
			return null;
		}

		return (
			<div ref={contentRef} className={styles.settingsSection} data-has-matches="true">
				<button type="button" className={styles.sectionHeader} onClick={onToggleExpand}>
					<div className={styles.sectionTitleRow}>
						<tab.icon className={styles.sectionIcon} weight={tab.iconWeight ?? 'fill'} />
						<h2 className={styles.sectionTitle}>{tab.label}</h2>
						<span className={styles.matchCount}>
							{matchedItems.length === 1 ? <Trans>1 match</Trans> : <Trans>{matchedItems.length} matches</Trans>}
						</span>
						<CaretRightIcon
							size={16}
							weight="bold"
							className={clsx(styles.expandIcon, isExpanded && styles.expandIconExpanded)}
						/>
					</div>
					<div className={styles.matchedItemsPreview}>
						{matchedItems.slice(0, 3).map((item) => (
							<span key={item.id} className={styles.matchPreviewChip}>
								{item.label}
							</span>
						))}
						{matchedItems.length > 3 && <span className={styles.matchPreviewMore}>+{matchedItems.length - 3}</span>}
					</div>
				</button>

				{isExpanded && (
					<div className={styles.sectionContent}>
						{React.createElement(
							InlineComponent,
							(initialGuildId ? {initialGuildId} : undefined) as Record<string, unknown>,
						)}
					</div>
				)}
			</div>
		);
	},
);

export const AllSettingsRenderer: React.FC<AllSettingsRendererProps> = observer(
	({searchQuery, searchResults, initialGuildId}) => {
		const containerRef = useRef<HTMLDivElement>(null);
		const [expandedTabs, setExpandedTabs] = useState<Set<UserSettingsTabType>>(new Set());
		const previousQueryRef = useRef<string>('');

		const isSearchActive = searchQuery.trim().length > 0;

		useEffect(() => {
			if (searchQuery !== previousQueryRef.current) {
				setExpandedTabs(new Set(searchResults.map((r) => r.tab.type)));
				previousQueryRef.current = searchQuery;
			}
		}, [searchQuery, searchResults]);

		useEffect(() => {
			if (!searchQuery.trim() || !containerRef.current) {
				clearHighlights();
				return;
			}

			const timer = setTimeout(() => {
				if (!containerRef.current) return;

				const allRanges: Array<Range> = [];
				const sections = containerRef.current.querySelectorAll('[data-settings-section]');

				for (const section of sections) {
					if (!(section instanceof HTMLElement)) continue;

					const ranges = createRangesForSection(section, searchQuery);
					if (ranges.length > 0) {
						allRanges.push(...ranges);
					}
				}

				setHighlightRanges(allRanges);
			}, 50);

			return () => clearTimeout(timer);
		}, [searchQuery, expandedTabs]);

		const handleToggleExpand = useCallback((tabType: UserSettingsTabType) => {
			setExpandedTabs((prev) => {
				const next = new Set(prev);
				if (next.has(tabType)) {
					next.delete(tabType);
				} else {
					next.add(tabType);
				}
				return next;
			});
		}, []);

		if (!isSearchActive) {
			return null;
		}

		if (searchResults.length === 0) {
			return (
				<div className={styles.emptyState}>
					<div className={styles.emptyStateContent}>
						<div className={styles.emptyStateTitle}>
							<Trans>No settings found</Trans>
						</div>
						<p className={styles.emptyStateDescription}>
							<Trans>Try searching for something like "theme", "notifications", or "privacy"</Trans>
						</p>
					</div>
				</div>
			);
		}

		return (
			<div ref={containerRef} className={styles.searchResultsContainer}>
				<div className={styles.resultsHeader}>
					<Trans>
						Found {searchResults.reduce((acc, r) => acc + r.matchedItems.length, 0)} results in {searchResults.length}{' '}
						categories
					</Trans>
				</div>
				{searchResults.map((result) => (
					<SettingsSection
						key={result.tab.type}
						tab={result.tab}
						matchedItems={result.matchedItems}
						searchQuery={searchQuery}
						initialGuildId={initialGuildId}
						isExpanded={expandedTabs.has(result.tab.type)}
						onToggleExpand={() => handleToggleExpand(result.tab.type)}
					/>
				))}
			</div>
		);
	},
);
