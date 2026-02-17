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

import reactionStyles from '@app/components/channel/MessageReactions.module.css';
import {LongPressable} from '@app/components/LongPressable';
import styles from '@app/components/shared/MessageReactionsContent.module.css';
import {Avatar} from '@app/components/uikit/Avatar';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useHover} from '@app/hooks/useHover';
import type {UserRecord} from '@app/records/UserRecord';
import {emojiEquals, getEmojiName, getEmojiNameWithColons, getReactionKey, useEmojiURL} from '@app/utils/ReactionUtils';
import type {MessageReaction} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {type MouseEvent, useCallback} from 'react';

interface ReactionFilterButtonProps {
	reaction: MessageReaction;
	isSelected: boolean;
	onSelect: () => void;
	onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
	showTooltip: boolean;
}

const ReactionFilterButton = observer(
	({reaction, isSelected, onSelect, onContextMenu, showTooltip}: ReactionFilterButtonProps) => {
		const {t} = useLingui();
		const [hoverRef, isHovering] = useHover();
		const emojiName = getEmojiName(reaction.emoji);
		const emojiUrl = useEmojiURL({emoji: reaction.emoji, isHovering});
		const isUnicodeEmoji = reaction.emoji.id == null;
		const reactionCountText = reaction.count === 1 ? t`${reaction.count} reaction` : t`${reaction.count} reactions`;
		const ariaLabel = t`${emojiName}, ${reactionCountText}`;

		const button = (
			<FocusRing offset={-2}>
				<button
					type="button"
					aria-label={ariaLabel}
					onClick={onSelect}
					onContextMenu={onContextMenu}
					ref={hoverRef}
					className={clsx(
						reactionStyles.reactionButton,
						styles.filterButton,
						isSelected ? styles.filterButtonSelected : styles.filterButtonIdle,
					)}
				>
					<div className={reactionStyles.reactionInner}>
						{emojiUrl ? (
							<img className={clsx('emoji', reactionStyles.emoji)} src={emojiUrl} alt={emojiName} draggable={false} />
						) : isUnicodeEmoji ? (
							<span className={clsx('emoji', reactionStyles.emoji)}>{reaction.emoji.name}</span>
						) : null}
						<div className={reactionStyles.countWrapper}>{reaction.count}</div>
					</div>
				</button>
			</FocusRing>
		);

		if (!showTooltip) {
			return button;
		}

		return (
			<Tooltip text={getEmojiNameWithColons(reaction.emoji)} position="left">
				{button}
			</Tooltip>
		);
	},
);

interface MessageReactionsFiltersProps {
	messageId: string;
	reactions: ReadonlyArray<MessageReaction>;
	selectedReaction: MessageReaction;
	onSelectReaction: (reaction: MessageReaction) => void;
	canManageMessages: boolean;
	variant: 'modal' | 'sheet';
	onReactionLongPress?: (reaction: MessageReaction) => void;
	onReactionContextMenu?: (reaction: MessageReaction, event: MouseEvent<HTMLButtonElement>) => void;
}

export const MessageReactionsFilters = observer(
	({
		messageId,
		reactions,
		selectedReaction,
		onSelectReaction,
		canManageMessages,
		variant,
		onReactionLongPress,
		onReactionContextMenu,
	}: MessageReactionsFiltersProps) => {
		if (reactions.length === 0) {
			return null;
		}

		const isHorizontal = variant === 'sheet';
		const listClassName = clsx(
			styles.filtersList,
			isHorizontal ? styles.filtersListHorizontal : styles.filtersListVertical,
		);
		const itemClassName = clsx(
			styles.filterItem,
			isHorizontal ? styles.filterItemHorizontal : styles.filterItemVertical,
		);

		return (
			<Scroller
				key="message-reactions-filter-scroller"
				orientation={isHorizontal ? 'horizontal' : 'vertical'}
				className={styles.filtersScroller}
			>
				<div className={listClassName}>
					{reactions.map((reaction) => {
						const isSelected = emojiEquals(reaction.emoji, selectedReaction.emoji);
						const handleContextMenu =
							onReactionContextMenu && canManageMessages
								? (event: MouseEvent<HTMLButtonElement>) => onReactionContextMenu(reaction, event)
								: undefined;
						const button = (
							<ReactionFilterButton
								reaction={reaction}
								isSelected={isSelected}
								onSelect={() => onSelectReaction(reaction)}
								onContextMenu={handleContextMenu}
								showTooltip={variant === 'modal'}
							/>
						);

						if (onReactionLongPress) {
							return (
								<LongPressable
									key={getReactionKey(messageId, reaction.emoji)}
									className={itemClassName}
									onLongPress={() => onReactionLongPress(reaction)}
								>
									{button}
								</LongPressable>
							);
						}

						return (
							<div key={getReactionKey(messageId, reaction.emoji)} className={itemClassName}>
								{button}
							</div>
						);
					})}
				</div>
			</Scroller>
		);
	},
);

interface ReactorListItemProps {
	channelId: string;
	reactor: UserRecord;
	canManageMessages: boolean;
	currentUserId: string | null;
	guildId?: string;
	avatarSize: number;
	isFirst: boolean;
	onRemoveReactor?: (reactor: UserRecord) => void;
	onReactorLongPress?: (reactor: UserRecord) => void;
}

const ReactorListItem = observer(
	({
		channelId,
		reactor,
		canManageMessages,
		currentUserId,
		guildId,
		avatarSize,
		isFirst,
		onRemoveReactor,
		onReactorLongPress,
	}: ReactorListItemProps) => {
		const handleRemove = useCallback(() => {
			onRemoveReactor?.(reactor);
		}, [onRemoveReactor, reactor]);

		const isOwnReaction = currentUserId != null && reactor.id === currentUserId;
		const showRemoveButton = Boolean(onRemoveReactor) && (canManageMessages || isOwnReaction);
		const itemClassName = clsx(styles.reactorItem, !isFirst && styles.reactorItemBorder);
		const content = (
			<>
				<Avatar user={reactor} size={avatarSize} guildId={guildId} />
				<div className={styles.reactorInfo}>
					<span className={styles.reactorName}>{reactor.displayName}</span>
					<span className={styles.reactorTag}>{reactor.tag}</span>
				</div>
				{showRemoveButton && (
					<FocusRing offset={-2}>
						<button type="button" onClick={handleRemove} className={styles.removeReactionButton}>
							<XIcon weight="bold" className={styles.removeReactionIcon} />
						</button>
					</FocusRing>
				)}
			</>
		);

		if (onReactorLongPress) {
			return (
				<LongPressable
					className={itemClassName}
					onLongPress={() => onReactorLongPress(reactor)}
					data-user-id={reactor.id}
					data-channel-id={channelId}
				>
					{content}
				</LongPressable>
			);
		}

		return (
			<div className={itemClassName} data-user-id={reactor.id} data-channel-id={channelId}>
				{content}
			</div>
		);
	},
);

interface MessageReactionsReactorsListProps {
	channelId: string;
	reactors: ReadonlyArray<UserRecord>;
	isLoading: boolean;
	canManageMessages: boolean;
	currentUserId: string | null;
	guildId?: string;
	avatarSize?: number;
	scrollerKey: string;
	loadingLabel?: string;
	emptyLabel?: string;
	showLoadingLabel?: boolean;
	onRemoveReactor?: (reactor: UserRecord) => void;
	onReactorLongPress?: (reactor: UserRecord) => void;
}

export const MessageReactionsReactorsList = observer(
	({
		channelId,
		reactors,
		isLoading,
		canManageMessages,
		currentUserId,
		guildId,
		avatarSize = 24,
		scrollerKey,
		loadingLabel,
		emptyLabel,
		showLoadingLabel = false,
		onRemoveReactor,
		onReactorLongPress,
	}: MessageReactionsReactorsListProps) => {
		const loadingLabelClassName = showLoadingLabel ? styles.loadingLabel : styles.srOnly;

		return (
			<div className={styles.reactionListPanel}>
				<Scroller className={styles.reactorScroller} key={scrollerKey}>
					{reactors.map((reactor, index) => (
						<ReactorListItem
							key={reactor.id}
							channelId={channelId}
							reactor={reactor}
							canManageMessages={canManageMessages}
							currentUserId={currentUserId}
							guildId={guildId}
							avatarSize={avatarSize}
							isFirst={index === 0}
							onRemoveReactor={onRemoveReactor}
							onReactorLongPress={onReactorLongPress}
						/>
					))}
					{isLoading && reactors.length === 0 && (
						<div className={styles.loadingContainer}>
							<Spinner size="medium" />
							{loadingLabel && <span className={loadingLabelClassName}>{loadingLabel}</span>}
						</div>
					)}
					{!isLoading && reactors.length === 0 && emptyLabel && (
						<div className={styles.emptyState}>
							<span className={styles.emptyStateText}>{emptyLabel}</span>
						</div>
					)}
				</Scroller>
			</div>
		);
	},
);
