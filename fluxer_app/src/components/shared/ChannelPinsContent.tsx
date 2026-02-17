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

import * as ChannelPinActionCreators from '@app/actions/ChannelPinsActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {Message} from '@app/components/channel/Message';
import {LongPressable} from '@app/components/LongPressable';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import previewStyles from '@app/components/shared/MessagePreview.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {useMessageListKeyboardNavigation} from '@app/hooks/useMessageListKeyboardNavigation';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import ChannelPinsStore from '@app/stores/ChannelPinsStore';
import ChannelStore from '@app/stores/ChannelStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import {goToMessage} from '@app/utils/MessageNavigator';
import {ChannelTypes, MessagePreviewContext, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {FlagCheckeredIcon, PushPinSlashIcon, SparkleIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

interface ChannelPinsContentProps {
	channel: ChannelRecord;
	onJump?: () => void;
}

export const ChannelPinsContent = observer(({channel, onJump}: ChannelPinsContentProps) => {
	const {t} = useLingui();
	const pinnedPins = ChannelPinsStore.getPins(channel.id);
	const fetched = ChannelPinsStore.isFetched(channel.id);
	const hasMore = ChannelPinsStore.getHasMore(channel.id);
	const isLoading = ChannelPinsStore.getIsLoading(channel.id);
	const isDMChannel = channel.type === ChannelTypes.DM || channel.type === ChannelTypes.GROUP_DM;
	const canUnpin = isDMChannel || PermissionStore.can(Permissions.MANAGE_MESSAGES, channel);
	const mobileLayout = MobileLayoutStore;
	const scrollerRef = useRef<ScrollerHandle | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [selectedMessage, setSelectedMessage] = useState<MessageRecord | null>(null);

	useEffect(() => {
		if (!fetched && !isLoading) {
			ChannelPinActionCreators.fetch(channel.id);
		}
	}, [fetched, isLoading, channel.id]);

	useEffect(() => {
		ReadStateStore.ackPins(channel.id);
	}, [channel.id]);

	useMessageListKeyboardNavigation({
		containerRef: scrollerRef,
	});

	const handleScroll = useCallback(
		(event: React.UIEvent<HTMLDivElement>) => {
			const target = event.currentTarget;
			const scrollPercentage = (target.scrollTop + target.offsetHeight) / target.scrollHeight;

			if (scrollPercentage > 0.8 && hasMore && !isLoading) {
				ChannelPinActionCreators.loadMore(channel.id);
			}
		},
		[channel.id, hasMore, isLoading],
	);

	const handleUnpin = (message: MessageRecord, event?: React.MouseEvent) => {
		if (event?.shiftKey) {
			ChannelPinActionCreators.unpin(message.channelId, message.id);
		} else {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Unpin Message`}
						description={t`Do you want to send this pin back in time?`}
						message={message}
						primaryText={t`Unpin it`}
						onPrimary={() => ChannelPinActionCreators.unpin(message.channelId, message.id)}
					/>
				)),
			);
		}
		setMenuOpen(false);
	};

	const renderUnpinButton = (message: MessageRecord) => {
		if (!canUnpin) return null;
		return (
			<FocusRing offset={-2}>
				<button
					type="button"
					className={previewStyles.actionIconButton}
					onClick={(event) => handleUnpin(message, event)}
				>
					<XIcon weight="bold" className={previewStyles.actionIcon} />
				</button>
			</FocusRing>
		);
	};

	const handleJump = (channelId: string, messageId: string) => {
		goToMessage(channelId, messageId);
		onJump?.();
	};

	const handleTap = (message: MessageRecord) => {
		if (mobileLayout.enabled) {
			handleJump(message.channelId, message.id);
		}
	};

	const endStateDescription = channel.guildId
		? t`Members with the "Pin Messages" permission can pin messages for everyone to see.`
		: t`You can pin messages in this conversation for everyone to see.`;

	if (!fetched) {
		return (
			<div className={previewStyles.emptyState}>
				<Spinner />
			</div>
		);
	}

	if (pinnedPins.length === 0) {
		return (
			<div className={previewStyles.emptyState}>
				<div className={previewStyles.emptyStateContent}>
					<SparkleIcon className={previewStyles.emptyStateIcon} />
					<div className={previewStyles.emptyStateTextContainer}>
						<h3 className={previewStyles.emptyStateTitle}>{t`No Pinned Messages`}</h3>
						<p
							className={previewStyles.emptyStateDescription}
						>{t`Whenever someone pins a message, it'll appear here.`}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<Scroller
				className={clsx(previewStyles.scroller, mobileLayout.enabled && previewStyles.scrollerMobile)}
				key="channel-pins-scroller"
				onScroll={handleScroll}
				ref={scrollerRef}
			>
				{mobileLayout.enabled && <div className={previewStyles.topSpacer} />}
				{pinnedPins.slice().map(({message}) => {
					const cardClasses = clsx(previewStyles.previewCard, mobileLayout.enabled && previewStyles.previewCardMobile);

					if (mobileLayout.enabled) {
						return (
							<LongPressable
								key={message.id}
								className={cardClasses}
								role="button"
								tabIndex={0}
								onClick={() => handleTap(message)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleTap(message);
									}
								}}
								onLongPress={() => {
									if (!canUnpin) return;
									setSelectedMessage(message);
									setMenuOpen(true);
								}}
							>
								<Message
									message={message}
									channel={ChannelStore.getChannel(message.channelId)!}
									previewContext={MessagePreviewContext.LIST_POPOUT}
								/>
							</LongPressable>
						);
					}

					return (
						<div key={message.id} className={cardClasses} role="button" tabIndex={-1}>
							<Message
								message={message}
								channel={ChannelStore.getChannel(message.channelId)!}
								previewContext={MessagePreviewContext.LIST_POPOUT}
							/>
							<div className={previewStyles.actionButtons}>
								<FocusRing offset={-2}>
									<button
										type="button"
										className={previewStyles.actionButton}
										onClick={() => handleJump(message.channelId, message.id)}
									>
										{t`Jump`}
									</button>
								</FocusRing>
								{renderUnpinButton(message)}
							</div>
						</div>
					);
				})}

				{isLoading && (
					<div className={previewStyles.loadingState}>
						<Spinner />
					</div>
				)}

				{!hasMore && (
					<div className={previewStyles.endState}>
						<div className={previewStyles.endStateContent}>
							<FlagCheckeredIcon className={previewStyles.endStateIcon} />
							<div className={previewStyles.endStateTextContainer}>
								<h3 className={previewStyles.endStateTitle}>{t`You've reached the end`}</h3>
								<p className={previewStyles.endStateDescription}>{endStateDescription}</p>
							</div>
						</div>
					</div>
				)}
			</Scroller>

			{mobileLayout.enabled && selectedMessage && (
				<MenuBottomSheet
					isOpen={menuOpen}
					onClose={() => {
						setMenuOpen(false);
						setSelectedMessage(null);
					}}
					groups={[
						{
							items: [
								{
									icon: <PushPinSlashIcon className={previewStyles.menuIcon} />,
									label: t`Unpin Message`,
									onClick: () => handleUnpin(selectedMessage),
									danger: true,
								},
							],
						},
					]}
				/>
			)}
		</>
	);
});
