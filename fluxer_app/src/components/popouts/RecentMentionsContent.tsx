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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as RecentMentionActionCreators from '@app/actions/RecentMentionActionCreators';
import {Message} from '@app/components/channel/Message';
import {InboxMessageHeader} from '@app/components/popouts/InboxMessageHeader';
import headerStyles from '@app/components/popouts/InboxMessageHeader.module.css';
import styles from '@app/components/popouts/RecentMentionsContent.module.css';
import previewStyles from '@app/components/shared/MessagePreview.module.css';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useMessageListKeyboardNavigation} from '@app/hooks/useMessageListKeyboardNavigation';
import ChannelStore from '@app/stores/ChannelStore';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import {goToMessage} from '@app/utils/MessageNavigator';
import {MessagePreviewContext} from '@fluxer/constants/src/ChannelConstants';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {DotsThreeIcon, FlagCheckeredIcon, SparkleIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';

const readonlyBehaviorOverrides = {
	disableContextMenu: true,
	prefersReducedMotion: true,
};

const FilterMenuContent = observer(() => {
	const filters = RecentMentionsStore.getFilters();

	return (
		<MenuGroup>
			<CheckboxItem
				checked={filters.includeEveryone}
				onCheckedChange={(checked) => {
					RecentMentionActionCreators.updateFilters({
						includeEveryone: checked,
					});
					RecentMentionActionCreators.fetch();
				}}
			>
				<Trans>Include @everyone mentions</Trans>
			</CheckboxItem>
			<CheckboxItem
				checked={filters.includeRoles}
				onCheckedChange={(checked) => {
					RecentMentionActionCreators.updateFilters({
						includeRoles: checked,
					});
					RecentMentionActionCreators.fetch();
				}}
			>
				<Trans>Include @role mentions</Trans>
			</CheckboxItem>
			<CheckboxItem
				checked={filters.includeGuilds}
				onCheckedChange={(checked) => {
					RecentMentionActionCreators.updateFilters({
						includeGuilds: checked,
					});
					RecentMentionActionCreators.fetch();
				}}
			>
				<Trans>Include all community mentions</Trans>
			</CheckboxItem>
		</MenuGroup>
	);
});

export const RecentMentionsContent = observer(
	({onHeaderActionsChange}: {onHeaderActionsChange?: (actions: React.ReactNode) => void}) => {
		const {t, i18n} = useLingui();

		const fetched = RecentMentionsStore.fetched;
		const hasMore = RecentMentionsStore.getHasMore();
		const isLoadingMore = RecentMentionsStore.getIsLoadingMore();
		const filterButtonRef = useRef<HTMLButtonElement>(null);
		const scrollerRef = useRef<ScrollerHandle | null>(null);
		const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

		const accessibleMentions = RecentMentionsStore.getAccessibleMentions();

		useEffect(() => {
			if (!fetched) {
				RecentMentionActionCreators.fetch();
			}
		}, [fetched]);

		useMessageListKeyboardNavigation({
			containerRef: scrollerRef,
		});

		useEffect(() => {
			const handleContextMenuChange = () => {
				const contextMenu = ContextMenuStore.contextMenu;
				const isOpen =
					!!contextMenu && !!filterButtonRef.current && contextMenu.target.target === filterButtonRef.current;

				setIsFilterMenuOpen(isOpen);
			};

			const disposer = autorun(handleContextMenuChange);
			return () => disposer();
		}, []);

		const handleFilterPointerDown = useCallback((event: React.PointerEvent) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === filterButtonRef.current;

			if (isOpen) {
				event.stopPropagation();
				event.preventDefault();
				ContextMenuActionCreators.close();
			}
		}, []);

		const handleFilterClick = useCallback((event: React.MouseEvent) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === event.currentTarget;

			if (isOpen) {
				return;
			}

			ContextMenuActionCreators.openFromEvent(event, () => <FilterMenuContent />);
		}, []);

		useEffect(() => {
			onHeaderActionsChange?.(
				<FocusRing offset={-2} focusTarget={filterButtonRef} ringTarget={filterButtonRef}>
					<button
						ref={filterButtonRef}
						type="button"
						onPointerDownCapture={handleFilterPointerDown}
						onClick={handleFilterClick}
						className={clsx(styles.filterButton, isFilterMenuOpen && styles.filterButtonActive)}
						title={i18n._(msg`Filter mentions`)}
					>
						<DotsThreeIcon weight="bold" className={styles.iconMedium} />
					</button>
				</FocusRing>,
			);

			return () => onHeaderActionsChange?.(null);
		}, [onHeaderActionsChange, handleFilterPointerDown, handleFilterClick, isFilterMenuOpen, i18n]);

		const handleScroll = useCallback(
			(event: React.UIEvent<HTMLDivElement>) => {
				const target = event.currentTarget;
				const scrollPercentage = (target.scrollTop + target.offsetHeight) / target.scrollHeight;

				if (scrollPercentage > 0.8 && hasMore && !isLoadingMore) {
					RecentMentionActionCreators.loadMore();
				}
			},
			[hasMore, isLoadingMore],
		);

		const handleJumpToMessage = useCallback((channelId: string, messageId: string) => {
			goToMessage(channelId, messageId);
		}, []);

		if (!fetched) {
			return (
				<div className={previewStyles.emptyState}>
					<Spinner />
				</div>
			);
		}

		if (accessibleMentions.length === 0) {
			return (
				<div className={previewStyles.emptyState}>
					<div className={previewStyles.emptyStateContent}>
						<SparkleIcon className={previewStyles.emptyStateIcon} />
						<div className={previewStyles.emptyStateTextContainer}>
							<h3 className={previewStyles.emptyStateTitle}>
								<Trans>No Recent Mentions</Trans>
							</h3>
							<p className={previewStyles.emptyStateDescription}>
								<Trans>All @mentions of you will appear here for 7 days.</Trans>
							</p>
						</div>
					</div>
				</div>
			);
		}

		return (
			<Scroller className={styles.scroller} onScroll={handleScroll} key="recent-mentions-scroller" ref={scrollerRef}>
				{accessibleMentions.map((message) => {
					const channel = ChannelStore.getChannel(message.channelId);
					if (!channel) return null;

					return (
						<div key={message.id} className={styles.messageCard}>
							<InboxMessageHeader
								channel={channel}
								onClick={() => handleJumpToMessage(message.channelId, message.id)}
								rightActions={
									<Tooltip text={t`Remove mention`} position="top">
										<FocusRing offset={-2}>
											<button
												type="button"
												className={headerStyles.headerIconButton}
												onClick={() => RecentMentionActionCreators.remove(message.id)}
												aria-label={t`Remove mention`}
											>
												<XIcon weight="bold" className={headerStyles.headerIcon} />
											</button>
										</FocusRing>
									</Tooltip>
								}
							/>

							<div className={previewStyles.previewCard}>
								<Message
									message={message}
									channel={channel}
									previewContext={MessagePreviewContext.LIST_POPOUT}
									behaviorOverrides={readonlyBehaviorOverrides}
									readonlyPreview
								/>

								<div className={previewStyles.actionButtons}>
									<FocusRing offset={-2}>
										<button
											type="button"
											className={previewStyles.actionButton}
											onClick={() => handleJumpToMessage(message.channelId, message.id)}
										>
											<Trans>Jump</Trans>
										</button>
									</FocusRing>
								</div>
							</div>
						</div>
					);
				})}

				{isLoadingMore && (
					<div className={previewStyles.loadingState}>
						<Spinner />
					</div>
				)}

				{!hasMore && !isLoadingMore && (
					<div className={previewStyles.endState}>
						<div className={previewStyles.endStateContent}>
							<FlagCheckeredIcon className={previewStyles.endStateIcon} />
							<div className={previewStyles.endStateTextContainer}>
								<h3 className={previewStyles.endStateTitle}>
									<Trans>You&apos;ve reached the end</Trans>
								</h3>
								<p className={previewStyles.endStateDescription}>
									<Trans>You&apos;ve seen all your recent mentions. Don&apos;t fret, more will appear here soon</Trans>
								</p>
							</div>
						</div>
					</div>
				)}
			</Scroller>
		);
	},
);
