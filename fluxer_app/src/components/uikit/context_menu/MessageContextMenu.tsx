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
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import {messageActionMenuItemIds, useMessageActionMenuData} from '@app/components/channel/MessageActionMenu';
import {requestOpenReactionPicker} from '@app/components/channel/MessageActionUtils';
import {renderQuickReactionEmoji} from '@app/components/channel/QuickReactionsRow';
import {MessageReactionsModal} from '@app/components/modals/MessageReactionsModal';
import {useContextMenuClose} from '@app/components/uikit/context_menu/ContextMenu';
import contextMenuStyles from '@app/components/uikit/context_menu/ContextMenu.module.css';
import {
	CopyIdIcon,
	CopyLinkIcon,
	CopyTextIcon,
	OpenLinkIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MediaMenuHandlers} from '@app/components/uikit/context_menu/items/MediaMenuData';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {MenuGroupType, MenuItemType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import EmojiStore from '@app/stores/EmojiStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {getEmojiDisplayData} from '@app/utils/SkinToneUtils';
import {useLingui} from '@lingui/react/macro';
import {SmileyIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {MenuItem as AriaMenuItem, MenuSection as AriaMenuSection} from 'react-aria-components';

interface SelectionSnapshot {
	text: string;
	range: Range | null;
}

const getSelectionSnapshot = (): SelectionSnapshot => {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return {text: '', range: null};
	}

	const text = selection.toString().trim();
	if (!text) {
		return {text: '', range: null};
	}

	try {
		return {text, range: selection.getRangeAt(0).cloneRange()};
	} catch {
		return {text, range: null};
	}
};

interface MenuItemSplit {
	matched: Map<string, MenuItemType>;
	remaining: Array<MenuItemType>;
}

function splitMenuItemsById(items: Array<MenuItemType>, ids: ReadonlySet<string>): MenuItemSplit {
	const matched = new Map<string, MenuItemType>();
	const remaining: Array<MenuItemType> = [];

	for (const item of items) {
		const itemId = item.id;
		if (itemId && ids.has(itemId)) {
			if (!matched.has(itemId)) {
				matched.set(itemId, item);
			}
			continue;
		}

		remaining.push(item);
	}

	return {matched, remaining};
}

interface MessageContextMenuProps {
	message: MessageRecord;
	onClose: () => void;
	onDelete: (bypassConfirm?: boolean) => void;
	linkUrl?: string;
	excludeMediaActions?: boolean;
	mediaHandlers?: MediaMenuHandlers;
	mediaGroups?: Array<MenuGroupType>;
	attachmentId?: string;
}

function renderEmojiContent(emoji: FlatEmoji, imgClassName: string, nativeClassName: string): React.ReactNode {
	const isUnicodeEmoji = !emoji.guildId && !emoji.id;
	const useNativeRendering = shouldUseNativeEmoji && isUnicodeEmoji;
	const {surrogates: displaySurrogates, url: displayUrl} = getEmojiDisplayData(emoji);

	if (useNativeRendering) {
		return <span className={nativeClassName}>{displaySurrogates}</span>;
	}

	const emojiSrc = emoji.id ? AvatarUtils.getEmojiURL({id: emoji.id, animated: false}) : (displayUrl ?? '');

	return <img src={emojiSrc} alt={emoji.name} className={imgClassName} />;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = observer(
	({message, onClose, onDelete, linkUrl, excludeMediaActions = false, mediaHandlers, mediaGroups, attachmentId}) => {
		const {i18n, t} = useLingui();
		const closeMenu = useContextMenuClose();
		const [{text: initialSelectionText, range: initialSelectionRange}] = useState(getSelectionSnapshot);
		const [selectionText, setSelectionText] = useState(initialSelectionText);
		const [emojiDataVersion, setEmojiDataVersion] = useState(0);
		const savedSelectionRangeRef = useRef<Range | null>(initialSelectionRange);
		const restoringSelectionRef = useRef(false);

		const restoreSelection = useCallback(() => {
			const savedRange = savedSelectionRangeRef.current;
			if (!savedRange) return;

			const selection = window.getSelection();
			if (!selection) return;

			try {
				const rangeForSelection = savedRange.cloneRange();
				const rangeForStorage = rangeForSelection.cloneRange();

				restoringSelectionRef.current = true;
				selection.removeAllRanges();
				selection.addRange(rangeForSelection);
				savedSelectionRangeRef.current = rangeForStorage;
				setSelectionText(rangeForStorage.toString().trim());
			} catch {
				savedSelectionRangeRef.current = null;
				return;
			} finally {
				window.requestAnimationFrame(() => {
					restoringSelectionRef.current = false;
				});
			}
		}, []);

		useLayoutEffect(() => {
			if (!savedSelectionRangeRef.current) return;
			restoreSelection();
		}, [restoreSelection]);

		useEffect(() => {
			const handleEmojiDataUpdated = () => {
				setEmojiDataVersion((version) => version + 1);
			};
			return ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', handleEmojiDataUpdated);
		}, []);

		useEffect(() => {
			const handleSelectionChange = () => {
				if (restoringSelectionRef.current) return;

				const {text, range} = getSelectionSnapshot();
				if (text) {
					savedSelectionRangeRef.current = range;
					setSelectionText(text);
					return;
				}

				if (savedSelectionRangeRef.current) {
					restoreSelection();
					return;
				}

				setSelectionText('');
			};

			document.addEventListener('selectionchange', handleSelectionChange);
			return () => document.removeEventListener('selectionchange', handleSelectionChange);
		}, [restoreSelection]);

		const copyShortcut = useMemo(() => {
			return /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C';
		}, []);

		const handleCopySelection = useCallback(async () => {
			if (!selectionText) return;
			await TextCopyActionCreators.copy(i18n, selectionText, true);
			onClose();
		}, [selectionText, onClose, i18n]);

		const handleCopyLink = useCallback(async () => {
			if (!linkUrl) return;
			await TextCopyActionCreators.copy(i18n, linkUrl, true);
			onClose();
		}, [linkUrl, onClose, i18n]);

		const handleOpenLink = useCallback(() => {
			if (!linkUrl) return;
			void openExternalUrl(linkUrl);
			onClose();
		}, [linkUrl, onClose]);

		const handleOpenReactionsModal = useCallback(() => {
			if (message.reactions.length === 0) return;
			ModalActionCreators.push(
				modal(() => (
					<MessageReactionsModal
						channelId={message.channelId}
						messageId={message.id}
						openToReaction={message.reactions[0]}
					/>
				)),
			);
		}, [message.channelId, message.id, message.reactions]);

		const handleOpenEmojiPicker = useCallback(() => {
			const messageId = message.id;
			onClose();
			requestAnimationFrame(() => {
				requestOpenReactionPicker(messageId);
			});
		}, [message.id, onClose]);

		const {groups, handlers, quickReactionEmojis, quickReactionRowVisible, isFailed} = useMessageActionMenuData(
			message,
			{
				onClose,
				onDelete: () => onDelete(),
				onOpenReactionsSheet: handleOpenReactionsModal,
				onOpenEmojiPicker: handleOpenEmojiPicker,
				quickReactionCount: 4,
			},
		);

		const channel = useMemo(() => ChannelStore.getChannel(message.channelId) ?? null, [message.channelId]);
		const allEmojis = useMemo(() => EmojiStore.search(channel, ''), [channel, emojiDataVersion]);
		const frecentEmojis = useMemo(() => EmojiPickerStore.getFrecentEmojis(allEmojis, 12), [allEmojis]);

		const handleQuickReact = useCallback(
			(emoji: FlatEmoji) => {
				EmojiPickerStore.trackEmoji(emoji);
				handlers.handleEmojiSelect(emoji);
				closeMenu();
			},
			[handlers, closeMenu],
		);

		const handleFrecentEmojiSelect = useCallback(
			(emoji: FlatEmoji) => {
				EmojiPickerStore.trackEmoji(emoji);
				handlers.handleEmojiSelect(emoji);
			},
			[handlers],
		);

		const isSent = !isFailed && message.state !== 'SENDING';
		const nonEmptyGroups = groups.filter((group) => group.items.length > 0);

		if (isFailed) {
			return (
				<>
					{nonEmptyGroups.map((group, groupIndex) => (
						<MenuGroup key={groupIndex}>
							{group.items.map((item, itemIndex) => {
								const menuItem = item as MenuItemType;
								return (
									<MenuItem
										key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
										icon={menuItem.icon}
										onClick={menuItem.onClick}
										danger={menuItem.danger}
										disabled={menuItem.disabled}
										hint={menuItem.hint}
									>
										{menuItem.label}
									</MenuItem>
								);
							})}
						</MenuGroup>
					))}
				</>
			);
		}

		if (!isSent) {
			return null;
		}

		const renderMenuItems = () => {
			const reactionGroup = groups[0];
			const interactionGroup = groups[1];
			const managementGroup = groups[2];
			const utilityGroup = groups[3];
			const reportGroup = groups[4];

			const interactionItems = (interactionGroup?.items ?? []) as Array<MenuItemType>;
			const interactionSplit = splitMenuItemsById(
				interactionItems,
				new Set([messageActionMenuItemIds.edit, messageActionMenuItemIds.reply]),
			);
			const editItem = interactionSplit.matched.get(messageActionMenuItemIds.edit);
			const replyItem = interactionSplit.matched.get(messageActionMenuItemIds.reply);
			const otherInteractionItems = interactionSplit.remaining;

			const managementItems = (managementGroup?.items ?? []) as Array<MenuItemType>;
			const managementSplit = splitMenuItemsById(managementItems, new Set([messageActionMenuItemIds.deleteMessage]));
			const deleteItem = managementSplit.matched.get(messageActionMenuItemIds.deleteMessage);
			const nonDeleteManagementItems = managementSplit.remaining;

			const utilityItems = (utilityGroup?.items ?? []) as Array<MenuItemType>;
			const utilitySplit = splitMenuItemsById(
				utilityItems,
				new Set([
					messageActionMenuItemIds.copyMessage,
					messageActionMenuItemIds.copyMessageLink,
					messageActionMenuItemIds.copyMessageId,
					messageActionMenuItemIds.debugMessage,
				]),
			);
			const copyMessageItem = utilitySplit.matched.get(messageActionMenuItemIds.copyMessage);
			const copyMessageLinkItem = utilitySplit.matched.get(messageActionMenuItemIds.copyMessageLink);
			const copyMessageIdItem = utilitySplit.matched.get(messageActionMenuItemIds.copyMessageId);
			const debugMessageItem = utilitySplit.matched.get(messageActionMenuItemIds.debugMessage);
			const otherUtilityItems = utilitySplit.remaining;

			const reactionItems = (reactionGroup?.items ?? []) as Array<MenuItemType>;
			const addReactionItem = reactionItems.find((item) => item.id === 'add-reaction');
			const otherReactionItems = reactionItems.filter((item) => item.id !== 'add-reaction');

			return (
				<>
					{quickReactionRowVisible && quickReactionEmojis.length > 0 && (
						<AriaMenuSection className={contextMenuStyles.quickReactionsGroup}>
							{quickReactionEmojis.map((emoji) => (
								<AriaMenuItem
									key={emoji.name}
									className={contextMenuStyles.quickReactionItem}
									onAction={() => handleQuickReact(emoji)}
									textValue={`:${emoji.name}:`}
								>
									{renderQuickReactionEmoji(emoji)}
								</AriaMenuItem>
							))}
						</AriaMenuSection>
					)}

					{(addReactionItem || otherReactionItems.length > 0) && (
						<MenuGroup>
							{addReactionItem && frecentEmojis.length > 0 ? (
								<MenuItemSubmenu
									label={addReactionItem.label}
									icon={addReactionItem.icon}
									onTriggerSelect={handleOpenEmojiPicker}
									render={() => (
										<>
											{frecentEmojis.map((emoji) => (
												<MenuItem
													key={emoji.name}
													icon={
														<div className={contextMenuStyles.emojiSubmenuIcon}>
															{renderEmojiContent(
																emoji,
																contextMenuStyles.emojiSubmenuImg,
																contextMenuStyles.emojiSubmenuNative,
															)}
														</div>
													}
													onClick={() => handleFrecentEmojiSelect(emoji)}
												>
													{`:${emoji.name}:`}
												</MenuItem>
											))}
											<MenuItem icon={<SmileyIcon size={16} weight="fill" />} onClick={handleOpenEmojiPicker}>
												{t`View More`}
											</MenuItem>
										</>
									)}
								/>
							) : addReactionItem ? (
								<MenuItem
									icon={addReactionItem.icon}
									onClick={addReactionItem.onClick}
									shortcut={addReactionItem.shortcut}
								>
									{addReactionItem.label}
								</MenuItem>
							) : null}

							{otherReactionItems.map((menuItem, itemIndex) => (
								<MenuItem
									key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
									icon={menuItem.icon}
									onClick={menuItem.onClick}
									danger={menuItem.danger}
									disabled={menuItem.disabled}
									hint={menuItem.hint}
									shortcut={menuItem.shortcut}
								>
									{menuItem.label}
								</MenuItem>
							))}
						</MenuGroup>
					)}

					{(editItem || replyItem || otherInteractionItems.length > 0) && (
						<MenuGroup>
							{editItem && (
								<MenuItem
									key="edit"
									icon={(editItem as MenuItemType).icon}
									onClick={(editItem as MenuItemType).onClick}
									shortcut={(editItem as MenuItemType).shortcut}
								>
									{(editItem as MenuItemType).label}
								</MenuItem>
							)}
							{replyItem && (
								<MenuItem
									key="reply"
									icon={(replyItem as MenuItemType).icon}
									onClick={(replyItem as MenuItemType).onClick}
									shortcut={(replyItem as MenuItemType).shortcut}
								>
									{(replyItem as MenuItemType).label}
								</MenuItem>
							)}
							{otherInteractionItems
								.filter((item) => item.label !== t`Mark as Unread`)
								.map((item, itemIndex) => {
									const menuItem = item as MenuItemType;
									return (
										<MenuItem
											key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
											icon={menuItem.icon}
											onClick={menuItem.onClick}
											danger={menuItem.danger}
											disabled={menuItem.disabled}
											hint={menuItem.hint}
											shortcut={menuItem.shortcut}
										>
											{menuItem.label}
										</MenuItem>
									);
								})}
						</MenuGroup>
					)}

					{((!excludeMediaActions && (selectionText || copyMessageItem)) ||
						nonDeleteManagementItems.length > 0 ||
						otherUtilityItems.length > 0 ||
						copyMessageLinkItem ||
						otherInteractionItems.some((item) => item.label === t`Mark as Unread`)) && (
						<MenuGroup>
							{!excludeMediaActions && selectionText && (
								<MenuItem icon={<CopyTextIcon size={20} />} onClick={handleCopySelection} shortcut={copyShortcut}>
									{t`Copy Text`}
								</MenuItem>
							)}

							{!excludeMediaActions && !selectionText && copyMessageItem && (
								<MenuItem
									icon={(copyMessageItem as MenuItemType).icon}
									onClick={(copyMessageItem as MenuItemType).onClick}
									shortcut={(copyMessageItem as MenuItemType).shortcut}
								>
									{t`Copy Text`}
								</MenuItem>
							)}

							{nonDeleteManagementItems.map((item, itemIndex) => {
								const menuItem = item as MenuItemType;
								return (
									<MenuItem
										key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
										icon={menuItem.icon}
										onClick={menuItem.onClick}
										danger={menuItem.danger}
										disabled={menuItem.disabled}
										hint={menuItem.hint}
										shortcut={menuItem.shortcut}
									>
										{menuItem.label}
									</MenuItem>
								);
							})}

							{otherInteractionItems
								.filter((item) => item.label === t`Mark as Unread`)
								.map((item, itemIndex) => {
									const menuItem = item as MenuItemType;
									return (
										<MenuItem
											key={menuItem.id ?? `mark-unread-${itemIndex}`}
											icon={menuItem.icon}
											onClick={menuItem.onClick}
											danger={menuItem.danger}
											disabled={menuItem.disabled}
											hint={menuItem.hint}
											shortcut={menuItem.shortcut}
										>
											{menuItem.label}
										</MenuItem>
									);
								})}

							{copyMessageLinkItem && (
								<MenuItem
									icon={(copyMessageLinkItem as MenuItemType).icon}
									onClick={(copyMessageLinkItem as MenuItemType).onClick}
									shortcut={(copyMessageLinkItem as MenuItemType).shortcut}
								>
									{(copyMessageLinkItem as MenuItemType).label}
								</MenuItem>
							)}

							{!excludeMediaActions &&
								otherUtilityItems.map((item, itemIndex) => {
									const menuItem = item as MenuItemType;
									return (
										<MenuItem
											key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
											icon={menuItem.icon}
											onClick={menuItem.onClick}
											danger={menuItem.danger}
											disabled={menuItem.disabled}
											hint={menuItem.hint}
											shortcut={menuItem.shortcut}
											closeOnSelect={menuItem.closeOnSelect}
										>
											{menuItem.label}
										</MenuItem>
									);
								})}
						</MenuGroup>
					)}

					{deleteItem && (
						<MenuGroup>
							<MenuItem
								key="delete"
								icon={(deleteItem as MenuItemType).icon}
								onClick={(deleteItem as MenuItemType).onClick}
								danger={(deleteItem as MenuItemType).danger}
								shortcut={(deleteItem as MenuItemType).shortcut}
							>
								{(deleteItem as MenuItemType).label}
							</MenuItem>
						</MenuGroup>
					)}

					{mediaGroups?.map((group, groupIndex) => (
						<MenuGroup key={`media-${groupIndex}`}>
							{group.items.map((item, itemIndex) => {
								const menuItem = item as MenuItemType;
								return (
									<MenuItem
										key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
										icon={menuItem.icon}
										onClick={menuItem.onClick}
										danger={menuItem.danger}
										disabled={menuItem.disabled}
										hint={menuItem.hint}
									>
										{menuItem.label}
									</MenuItem>
								);
							})}
						</MenuGroup>
					))}

					{!excludeMediaActions && linkUrl && (
						<MenuGroup>
							<MenuItem icon={<CopyLinkIcon />} onClick={handleCopyLink}>
								{t`Copy Link`}
							</MenuItem>
							<MenuItem icon={<OpenLinkIcon />} onClick={handleOpenLink}>
								{t`Open Link`}
							</MenuItem>
						</MenuGroup>
					)}

					{reportGroup && reportGroup.items.length > 0 && (
						<MenuGroup>
							{reportGroup.items.map((item, itemIndex) => {
								const menuItem = item as MenuItemType & {closeOnSelect?: boolean};
								return (
									<MenuItem
										key={menuItem.id ?? `${menuItem.label}-${itemIndex}`}
										icon={menuItem.icon}
										onClick={menuItem.onClick}
										danger={menuItem.danger}
										disabled={menuItem.disabled}
										hint={menuItem.hint}
										shortcut={menuItem.shortcut}
										closeOnSelect={menuItem.closeOnSelect}
									>
										{menuItem.label}
									</MenuItem>
								);
							})}
						</MenuGroup>
					)}

					{(debugMessageItem || copyMessageIdItem || (attachmentId && mediaHandlers)) && (
						<MenuGroup>
							{debugMessageItem && (
								<MenuItem
									key="debug-message"
									icon={(debugMessageItem as MenuItemType).icon}
									onClick={(debugMessageItem as MenuItemType).onClick}
									shortcut={(debugMessageItem as MenuItemType).shortcut}
								>
									{(debugMessageItem as MenuItemType).label}
								</MenuItem>
							)}

							{attachmentId && mediaHandlers && (
								<>
									<MenuItem
										icon={<CopyLinkIcon size={20} />}
										onClick={() => {
											void mediaHandlers.handleCopyLink();
										}}
									>
										{t`Copy Link`}
									</MenuItem>
									<MenuItem
										icon={<CopyIdIcon size={20} />}
										onClick={() => {
											void mediaHandlers.handleCopyAttachmentId();
										}}
									>
										{t`Copy Attachment ID`}
									</MenuItem>
								</>
							)}

							{copyMessageIdItem && (
								<MenuItem
									icon={(copyMessageIdItem as MenuItemType).icon}
									onClick={(copyMessageIdItem as MenuItemType).onClick}
									shortcut={(copyMessageIdItem as MenuItemType).shortcut}
								>
									{(copyMessageIdItem as MenuItemType).label}
								</MenuItem>
							)}
						</MenuGroup>
					)}
				</>
			);
		};

		return renderMenuItems();
	},
);
