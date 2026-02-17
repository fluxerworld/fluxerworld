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
import {
	canReportMessage,
	createMessageActionHandlers,
	isClientSystemMessage,
	isEmbedsSuppressed,
	type MessageActionHandlers,
	type MessagePermissions,
	requestSpeakMessage,
	useMessagePermissions,
} from '@app/components/channel/MessageActionUtils';
import {MessageDebugModal} from '@app/components/debug/MessageDebugModal';
import type {IARContext} from '@app/components/modals/IARModal';
import {IARModal} from '@app/components/modals/IARModal';
import {
	AddReactionIcon,
	BookmarkIcon,
	CopyIdIcon,
	CopyLinkIcon,
	CopyMessageTextIcon,
	DebugMessageIcon,
	DeleteIcon,
	EditMessageIcon,
	ForwardIcon,
	MarkAsUnreadIcon,
	PinIcon,
	RemoveAllReactionsIcon,
	ReplyIcon,
	ReportMessageIcon,
	RetryIcon,
	SpeakMessageIcon,
	StopSpeakingIcon,
	SuppressEmbedsIcon,
	ViewReactionsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {KeybindHint} from '@app/components/uikit/keybind_hint/KeybindHint';
import type {MenuGroupType, MenuItemType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {MessageRecord} from '@app/records/MessageRecord';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import EmojiStore from '@app/stores/EmojiStore';
import PermissionStore from '@app/stores/PermissionStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import TtsUtils from '@app/utils/TtsUtils';
import {MessageStates, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useEffect, useMemo, useState} from 'react';

interface MessageActionMenuOptions {
	onOpenEmojiPicker?: () => void;
	onOpenReactionsSheet?: () => void;
	onClose?: () => void;
	onDelete?: () => void;
	quickReactionCount?: number;
}

export const messageActionMenuItemIds = {
	reply: 'reply',
	edit: 'edit',
	deleteMessage: 'delete_message',
	copyMessage: 'copy_message',
	copyMessageLink: 'copy_message_link',
	copyMessageId: 'copy_message_id',
	debugMessage: 'debug_message',
} as const;

export interface MessageActionMenuData {
	handlers: MessageActionHandlers;
	permissions: MessagePermissions | null;
	groups: Array<MenuGroupType>;
	quickReactionEmojis: Array<FlatEmoji>;
	quickReactionRowVisible: boolean;
	isFailed: boolean;
	isSaved: boolean;
}

export const useMessageActionMenuData = (
	message: MessageRecord,
	options: MessageActionMenuOptions = {},
): MessageActionMenuData => {
	const {t, i18n} = useLingui();
	const {onOpenEmojiPicker, onOpenReactionsSheet, onClose, onDelete, quickReactionCount = 5} = options;
	const permissions = useMessagePermissions(message);
	const [emojiDataVersion, setEmojiDataVersion] = useState(0);
	const handlers = useMemo(() => createMessageActionHandlers(message, {i18n, onClose}), [message, onClose, i18n]);
	const isSaved = useMemo(() => SavedMessagesStore.isSaved(message.id), [message.id]);
	const channel = useMemo(() => ChannelStore.getChannel(message.channelId) ?? null, [message.channelId]);
	const allEmojis = useMemo(() => EmojiStore.search(channel, ''), [channel, emojiDataVersion]);
	const quickReactionEmojis = useMemo(
		() => EmojiPickerStore.getQuickReactionEmojis(allEmojis, quickReactionCount),
		[allEmojis, quickReactionCount],
	);
	const developerMode = UserSettingsStore.developerMode;
	const canManageMessages = useMemo(
		() =>
			permissions != null &&
			!permissions.isDM &&
			PermissionStore.can(Permissions.MANAGE_MESSAGES, {channelId: message.channelId}),
		[permissions, message.channelId],
	);
	const [isSpeaking, setIsSpeaking] = useState(TtsUtils.isSpeaking());
	const [voiceReady, setVoiceReady] = useState(TtsUtils.hasVoices());
	const supportsInteractiveActions = !isClientSystemMessage(message);

	useEffect(() => {
		const handleEmojiDataUpdated = () => {
			setEmojiDataVersion((version) => version + 1);
		};
		return ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', handleEmojiDataUpdated);
	}, []);

	useEffect(() => {
		if (!TtsUtils.isSupported()) {
			return;
		}
		const interval = setInterval(() => {
			setIsSpeaking(TtsUtils.isSpeaking());
			setVoiceReady(TtsUtils.hasVoices());
		}, 100);
		return () => clearInterval(interval);
	}, []);

	const handleSpeakMessage = useCallback(() => {
		requestSpeakMessage(message);
	}, [message]);

	const handleReportMessage = useCallback(() => {
		if (!canReportMessage(message)) {
			return;
		}
		onClose?.();
		const context: IARContext = {
			type: 'message',
			message,
		};
		ModalActionCreators.push(modal(() => <IARModal context={context} />));
	}, [message, onClose]);

	const handleDebugMessage = useCallback(() => {
		onClose?.();
		ModalActionCreators.pushWithKey(
			modal(() => <MessageDebugModal title={t`Message Debug`} message={message} />),
			`message-debug-${message.id}`,
		);
	}, [message, onClose, t]);

	const groups = useMemo(() => {
		const reactionActions: Array<MenuItemType> = [];
		const interactionActions: Array<MenuItemType> = [];
		const managementActions: Array<MenuItemType> = [];
		const utilityActions: Array<MenuItemType> = [];

		if (message.state === MessageStates.SENT) {
			if (permissions?.canAddReactions && onOpenEmojiPicker) {
				reactionActions.push({
					id: 'add-reaction',
					icon: <AddReactionIcon size={20} />,
					label: t`Add Reaction`,
					onClick: onOpenEmojiPicker,
					shortcut: <KeybindHint action="add_reaction" />,
				});
			}

			if (message.reactions.length > 0 && onOpenReactionsSheet) {
				reactionActions.push({
					icon: <ViewReactionsIcon size={20} />,
					label: t`View Reactions`,
					onClick: onOpenReactionsSheet,
				});
			}

			if (canManageMessages && message.reactions.length > 0) {
				reactionActions.push({
					icon: <RemoveAllReactionsIcon size={20} />,
					label: t`Remove All Reactions`,
					onClick: handlers.handleRemoveAllReactions,
					danger: true,
				});
			}

			interactionActions.push({
				icon: <MarkAsUnreadIcon size={20} />,
				label: t`Mark as Unread`,
				onClick: handlers.handleMarkAsUnread,
				shortcut: <KeybindHint action="mark_unread" />,
			});

			if (message.isUserMessage() && supportsInteractiveActions && permissions?.canSendMessages) {
				interactionActions.push({
					id: messageActionMenuItemIds.reply,
					icon: <ReplyIcon size={20} />,
					label: t`Reply`,
					onClick: handlers.handleReply,
					shortcut: <KeybindHint action="reply_message" />,
				});
			}

			if (message.isUserMessage() && supportsInteractiveActions) {
				interactionActions.push({
					icon: <ForwardIcon size={20} />,
					label: t`Forward`,
					onClick: handlers.handleForward,
					shortcut: <KeybindHint action="forward_message" />,
				});
			}

			if (message.isCurrentUserAuthor() && message.isUserMessage() && !message.messageSnapshots) {
				interactionActions.push({
					id: messageActionMenuItemIds.edit,
					icon: <EditMessageIcon size={20} />,
					label: t`Edit Message`,
					onClick: handlers.handleEditMessage,
					shortcut: <KeybindHint action="edit_message" />,
				});
			}

			if (message.isUserMessage() && permissions?.canPinMessage) {
				managementActions.push({
					icon: <PinIcon size={20} />,
					label: message.pinned ? t`Unpin Message` : t`Pin Message`,
					onClick: handlers.handlePinMessage,
					shortcut: <KeybindHint action="pin_message" />,
				});
			}

			if (message.isUserMessage() && supportsInteractiveActions) {
				managementActions.push({
					icon: <BookmarkIcon size={20} filled={isSaved} />,
					label: isSaved ? t`Remove Bookmark` : t`Bookmark Message`,
					onClick: handlers.handleSaveMessage(isSaved),
					shortcut: <KeybindHint action="bookmark_message" />,
				});
			}

			if (permissions?.shouldRenderSuppressEmbeds) {
				managementActions.push({
					icon: <SuppressEmbedsIcon size={20} />,
					label: isEmbedsSuppressed(message) ? t`Unsuppress Embeds` : t`Suppress Embeds`,
					onClick: handlers.handleToggleSuppressEmbeds,
					shortcut: <KeybindHint action="toggle_suppress_embeds" />,
				});
			}

			if (permissions?.canDeleteMessage && onDelete) {
				managementActions.push({
					id: messageActionMenuItemIds.deleteMessage,
					icon: <DeleteIcon size={20} />,
					label: t`Delete Message`,
					onClick: () => {
						onClose?.();
						onDelete();
					},
					danger: true,
					shortcut: <KeybindHint action="delete_message" />,
				});
			}

			if (supportsInteractiveActions) {
				utilityActions.push({
					id: messageActionMenuItemIds.copyMessageLink,
					icon: <CopyLinkIcon size={20} />,
					label: t`Copy Message Link`,
					onClick: handlers.handleCopyMessageLink,
					shortcut: <KeybindHint action="copy_message_link" />,
				});
			}

			if (message.content) {
				utilityActions.push({
					id: messageActionMenuItemIds.copyMessage,
					icon: <CopyMessageTextIcon size={20} />,
					label: t`Copy Message`,
					onClick: handlers.handleCopyMessage,
					shortcut: <KeybindHint action="copy_text" />,
				});
			}

			if (TtsUtils.isSupported() && voiceReady && message.content.trim()) {
				utilityActions.push({
					icon: isSpeaking ? <StopSpeakingIcon size={20} /> : <SpeakMessageIcon size={20} />,
					label: isSpeaking ? t`Stop Speaking` : t`Speak Message`,
					onClick: handleSpeakMessage,
					closeOnSelect: false,
					shortcut: <KeybindHint action="speak_message" />,
				});
			}

			utilityActions.push({
				id: messageActionMenuItemIds.copyMessageId,
				icon: <CopyIdIcon size={20} />,
				label: t`Copy Message ID`,
				onClick: handlers.handleCopyMessageId,
				shortcut: <KeybindHint action="copy_message_id" />,
			});

			if (developerMode) {
				utilityActions.push({
					id: messageActionMenuItemIds.debugMessage,
					icon: <DebugMessageIcon size={20} />,
					label: t`Debug Message`,
					onClick: handleDebugMessage,
				});
			}
		} else if (message.state === MessageStates.FAILED) {
			interactionActions.push({
				icon: <RetryIcon size={20} />,
				label: t`Retry`,
				onClick: handlers.handleRetryMessage,
			});

			managementActions.push({
				id: messageActionMenuItemIds.deleteMessage,
				icon: <DeleteIcon size={20} />,
				label: t`Delete Message`,
				onClick: handlers.handleFailedMessageDelete,
				danger: true,
			});
		}

		const groups: Array<MenuGroupType> = [
			{items: reactionActions},
			{items: interactionActions},
			{items: managementActions},
			{items: utilityActions},
		];

		if (canReportMessage(message)) {
			groups.push({
				items: [
					{
						icon: <ReportMessageIcon size={20} />,
						label: t`Report Message`,
						onClick: handleReportMessage,
						danger: true,
					},
				],
			});
		}

		return groups;
	}, [
		message,
		handlers,
		isSaved,
		onClose,
		onDelete,
		onOpenEmojiPicker,
		onOpenReactionsSheet,
		permissions,
		developerMode,
		canManageMessages,
		supportsInteractiveActions,
		isSpeaking,
		voiceReady,
		handleSpeakMessage,
		handleReportMessage,
		handleDebugMessage,
		t,
	]);

	const quickReactionRowVisible =
		permissions?.canAddReactions === true && message.state === MessageStates.SENT && quickReactionEmojis.length > 0;

	return {
		handlers,
		permissions,
		groups,
		quickReactionEmojis,
		quickReactionRowVisible,
		isFailed: message.state === MessageStates.FAILED,
		isSaved,
	};
};
