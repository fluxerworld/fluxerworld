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
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import {renderChannelStream} from '@app/components/channel/ChannelMessageStream';
import {ChannelNotificationSettingsDropdown} from '@app/components/channel/channel_header_components/ChannelNotificationSettingsDropdown';
import {InboxMessageHeader} from '@app/components/popouts/InboxMessageHeader';
import styles from '@app/components/popouts/UnreadChannelsContent.module.css';
import previewStyles from '@app/components/shared/MessagePreview.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {Endpoints} from '@app/Endpoints';
import {useMessageListKeyboardNavigation} from '@app/hooks/useMessageListKeyboardNavigation';
import {ChannelMessages} from '@app/lib/ChannelMessages';
import http from '@app/lib/HttpClient';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildNSFWAgreeStore from '@app/stores/GuildNSFWAgreeStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import UnreadChannelsStore from '@app/stores/UnreadChannelsStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {createChannelStream} from '@app/utils/MessageGroupingUtils';
import {goToMessage} from '@app/utils/MessageNavigator';
import {MAX_MESSAGES_PER_CHANNEL} from '@fluxer/constants/src/LimitConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {compare as compareSnowflakes, extractTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';
import {useLingui} from '@lingui/react/macro';
import {BellIcon, BellSlashIcon, CaretDownIcon, CheckIcon, SparkleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

function getUnreadChannels(): Array<ChannelRecord> {
	const channelIds = ReadStateStore.getChannelIds();
	const channels: Array<ChannelRecord> = [];

	for (const channelId of channelIds) {
		const channel = ChannelStore.getChannel(channelId);
		if (!channel) continue;
		if (!ReadStateStore.hasUnreadOrMentions(channel.id)) continue;
		if (UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guildId ?? null, channel.id)) continue;
		if (GuildNSFWAgreeStore.shouldShowGate({channelId: channel.id, guildId: channel.guildId ?? null})) continue;
		channels.push(channel);
	}

	return channels.sort((a, b) => {
		const aLast = ReadStateStore.lastMessageId(a.id) ?? a.lastMessageId ?? null;
		const bLast = ReadStateStore.lastMessageId(b.id) ?? b.lastMessageId ?? null;

		const aTimestamp = aLast ? extractTimestamp(aLast) : a.createdAt.getTime();
		const bTimestamp = bLast ? extractTimestamp(bLast) : b.createdAt.getTime();

		return bTimestamp - aTimestamp;
	});
}

interface ChannelPreviewData {
	channel: ChannelRecord;
	messages: Array<MessageRecord>;
	oldestUnreadMessageId: string | null;
}

async function fetchChannelPreview(channel: ChannelRecord): Promise<ChannelPreviewData> {
	if (GuildNSFWAgreeStore.shouldShowGate({channelId: channel.id, guildId: channel.guildId ?? null})) {
		return {channel, messages: [], oldestUnreadMessageId: null};
	}

	const oldestUnreadMessageId =
		ReadStateStore.getOldestUnreadMessageId(channel.id) ?? ReadStateStore.getVisualUnreadMessageId(channel.id);

	if (oldestUnreadMessageId) {
		const response = await http.get<Array<Message>>({
			url: Endpoints.CHANNEL_MESSAGES(channel.id),
			query: {limit: MAX_MESSAGES_PER_CHANNEL * 2, around: oldestUnreadMessageId},
			retries: 2,
		});

		const records = (response.body ?? []).map((message) => new MessageRecord(message));
		const ordered = [...records].reverse();
		const startIndex = ordered.findIndex((message) => message.id === oldestUnreadMessageId);

		if (startIndex !== -1) {
			return {
				channel,
				messages: ordered.slice(startIndex, startIndex + MAX_MESSAGES_PER_CHANNEL),
				oldestUnreadMessageId,
			};
		}
	}

	const ackMessageId = ReadStateStore.ackMessageId(channel.id);
	if (!ackMessageId) {
		return {channel, messages: [], oldestUnreadMessageId: null};
	}

	const afterResponse = await http.get<Array<Message>>({
		url: Endpoints.CHANNEL_MESSAGES(channel.id),
		query: {limit: MAX_MESSAGES_PER_CHANNEL, after: ackMessageId},
		retries: 2,
	});

	const afterRecords = (afterResponse.body ?? []).map((message) => new MessageRecord(message));
	const sorted = [...afterRecords].sort((a, b) => compareSnowflakes(a.id, b.id));
	const computedOldestUnread = sorted[0]?.id ?? null;

	return {
		channel,
		messages: sorted,
		oldestUnreadMessageId: computedOldestUnread,
	};
}

const UnreadChannelCard = observer(function UnreadChannelCard({
	channel,
	previewData,
}: {
	channel: ChannelRecord;
	previewData: ChannelPreviewData;
}) {
	const {t} = useLingui();

	const messageDisplayCompact = UserSettingsStore.getMessageDisplayCompact();
	const messageGroupSpacing = AccessibilityStore.messageGroupSpacingValue;
	const mentionCount = ReadStateStore.getMentionCount(channel.id);
	const isCollapsed = UnreadChannelsStore.isCollapsed(channel.id);
	const isMuted = UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guildId ?? null, channel.id);

	const {messages: previewMessages, oldestUnreadMessageId} = previewData;

	const previewMessageStore = useMemo(() => {
		const container = new ChannelMessages(channel.id);
		return previewMessages.length > 0 ? container.reset(previewMessages) : container;
	}, [channel.id, previewMessages]);

	const channelStream = useMemo(() => {
		if (!oldestUnreadMessageId || previewMessages.length === 0) return [];
		return createChannelStream({
			channel,
			messages: previewMessageStore,
			oldestUnreadMessageId,
			treatSpam: false,
		});
	}, [channel, previewMessageStore, previewMessages.length, oldestUnreadMessageId]);

	const handleJumpToMessage = useCallback(
		(messageId: string) => {
			goToMessage(channel.id, messageId);
		},
		[channel.id],
	);

	const handleHeaderClick = useCallback(() => {
		if (oldestUnreadMessageId) {
			goToMessage(channel.id, oldestUnreadMessageId);
		}
	}, [channel.id, oldestUnreadMessageId]);

	const handleToggleCollapse = useCallback(() => {
		UnreadChannelsStore.toggleCollapsed(channel.id);
	}, [channel.id]);

	const handleMarkAsRead = useCallback(() => {
		ReadStateActionCreators.ack(channel.id, true);
	}, [channel.id]);

	const handleOpenNotificationSettings = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<ChannelNotificationSettingsDropdown channel={channel} onClose={onClose} />
			));
		},
		[channel],
	);

	const renderMessageActions = useCallback(
		(message: MessageRecord) => (
			<FocusRing offset={-2}>
				<button
					type="button"
					className={clsx(previewStyles.actionButton, styles.jumpButton)}
					onClick={() => handleJumpToMessage(message.id)}
				>
					{t`Jump`}
				</button>
			</FocusRing>
		),
		[handleJumpToMessage, t],
	);

	const streamMarkup = useMemo(() => {
		if (previewMessages.length === 0) return null;

		return renderChannelStream({
			channelStream,
			messages: previewMessageStore,
			channel,
			highlightedMessageId: null,
			messageDisplayCompact,
			messageGroupSpacing,
			revealedMessageId: null,
			onMessageEdit: undefined,
			onReveal: undefined,
			messageRowClassName: styles.messageRow,
			messageActionsClassName: styles.messageActions,
			renderMessageActions,
			readonlyPreview: true,
			dateDividerClassName: styles.previewDateDivider,
			suppressUnreadIndicator: true,
		});
	}, [
		channelStream,
		previewMessageStore,
		channel,
		messageDisplayCompact,
		messageGroupSpacing,
		previewMessages.length,
		renderMessageActions,
	]);

	const BellComponent = isMuted ? BellSlashIcon : BellIcon;

	return (
		<div className={styles.channelCard}>
			<InboxMessageHeader
				channel={channel}
				onClick={handleHeaderClick}
				mentionCount={mentionCount}
				leftAdornment={
					<Tooltip text={isCollapsed ? t`Expand` : t`Collapse`} position="top">
						<FocusRing offset={-2}>
							<button
								type="button"
								className={clsx(styles.collapseButton, isCollapsed && styles.collapseButtonCollapsed)}
								onClick={handleToggleCollapse}
								aria-label={isCollapsed ? t`Expand` : t`Collapse`}
							>
								<CaretDownIcon className={styles.collapseIcon} weight="bold" />
							</button>
						</FocusRing>
					</Tooltip>
				}
				rightActions={
					<>
						<Tooltip text={t`Notification Settings`} position="top">
							<FocusRing offset={-2}>
								<button
									type="button"
									className={styles.headerIconButton}
									onClick={handleOpenNotificationSettings}
									aria-label={t`Notification Settings`}
								>
									<BellComponent className={styles.headerIcon} weight="fill" />
								</button>
							</FocusRing>
						</Tooltip>
						<Tooltip text={t`Mark as Read`} position="top">
							<FocusRing offset={-2}>
								<button
									type="button"
									className={styles.headerIconButton}
									onClick={handleMarkAsRead}
									aria-label={t`Mark as Read`}
								>
									<CheckIcon className={styles.headerIcon} weight="bold" />
								</button>
							</FocusRing>
						</Tooltip>
					</>
				}
			/>

			{!isCollapsed && (
				<div className={previewStyles.previewCard}>
					<div className={styles.messageStream}>{streamMarkup}</div>
					<div className={styles.previewFooter}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={styles.viewAllButton}
								onClick={handleHeaderClick}
								disabled={!oldestUnreadMessageId}
							>
								{t`View all unread`}
							</button>
						</FocusRing>
					</div>
				</div>
			)}
		</div>
	);
});

export const UnreadChannelsContent = observer(function UnreadChannelsContent() {
	const {t} = useLingui();
	const scrollerRef = useRef<ScrollerHandle | null>(null);
	const readStateVersion = ReadStateStore.version;
	const settingsVersion = UserGuildSettingsStore.version;

	const allUnreadChannels = useMemo(() => getUnreadChannels(), [readStateVersion, settingsVersion]);

	const [loadedCount, setLoadedCount] = useState(MAX_MESSAGES_PER_CHANNEL);
	const [isInitialLoading, setIsInitialLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [previewDataMap, setPreviewDataMap] = useState<Map<string, ChannelPreviewData>>(new Map());

	const visibleChannels = useMemo(() => allUnreadChannels.slice(0, loadedCount), [allUnreadChannels, loadedCount]);

	const hasMore = loadedCount < allUnreadChannels.length;

	useEffect(() => {
		let active = true;

		const loadInitialBatch = async () => {
			const channelsToLoad = allUnreadChannels.slice(0, MAX_MESSAGES_PER_CHANNEL);
			if (channelsToLoad.length === 0) {
				setIsInitialLoading(false);
				return;
			}

			const results = await Promise.all(channelsToLoad.map(fetchChannelPreview));

			if (!active) return;

			const newMap = new Map<string, ChannelPreviewData>();
			for (const result of results) {
				newMap.set(result.channel.id, result);
			}
			setPreviewDataMap(newMap);
			setIsInitialLoading(false);
		};

		void loadInitialBatch();

		return () => {
			active = false;
		};
	}, [allUnreadChannels]);

	const loadMoreChannels = useCallback(async () => {
		if (isLoadingMore || !hasMore) return;

		setIsLoadingMore(true);

		const nextBatchStart = loadedCount;
		const nextBatchEnd = Math.min(loadedCount + MAX_MESSAGES_PER_CHANNEL, allUnreadChannels.length);
		const channelsToLoad = allUnreadChannels.slice(nextBatchStart, nextBatchEnd);

		const results = await Promise.all(channelsToLoad.map(fetchChannelPreview));

		setPreviewDataMap((prev) => {
			const newMap = new Map(prev);
			for (const result of results) {
				newMap.set(result.channel.id, result);
			}
			return newMap;
		});

		setLoadedCount(nextBatchEnd);
		setIsLoadingMore(false);
	}, [isLoadingMore, hasMore, loadedCount, allUnreadChannels]);

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.currentTarget;
			const scrollPercentage = (target.scrollTop + target.offsetHeight) / target.scrollHeight;

			if (scrollPercentage > 0.8 && hasMore && !isLoadingMore) {
				void loadMoreChannels();
			}
		},
		[hasMore, isLoadingMore, loadMoreChannels],
	);

	useMessageListKeyboardNavigation({
		containerRef: scrollerRef,
	});

	if (isInitialLoading) {
		return (
			<div className={previewStyles.emptyState}>
				<Spinner />
			</div>
		);
	}

	if (allUnreadChannels.length === 0) {
		return (
			<div className={previewStyles.emptyState}>
				<div className={previewStyles.emptyStateContent}>
					<SparkleIcon className={previewStyles.emptyStateIcon} />
					<div className={previewStyles.emptyStateTextContainer}>
						<h3 className={previewStyles.emptyStateTitle}>{t`No Unread Messages`}</h3>
						<p className={previewStyles.emptyStateDescription}>{t`You're all caught up.`}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<Scroller key="unread-channels-scroller" className={styles.scroller} ref={scrollerRef} onScroll={handleScroll}>
			{visibleChannels.map((channel) => {
				const previewData = previewDataMap.get(channel.id);
				if (!previewData) return null;

				return <UnreadChannelCard key={channel.id} channel={channel} previewData={previewData} />;
			})}

			{isLoadingMore && (
				<div className={previewStyles.loadingState}>
					<Spinner />
				</div>
			)}
		</Scroller>
	);
});
