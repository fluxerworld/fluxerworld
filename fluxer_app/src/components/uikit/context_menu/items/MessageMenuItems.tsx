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
import {isEmbedsSuppressed, requestSpeakMessage, triggerAddReaction} from '@app/components/channel/MessageActionUtils';
import {MessageDebugModal} from '@app/components/debug/MessageDebugModal';
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
	SpeakMessageIcon,
	SuppressEmbedsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {KeybindHint} from '@app/components/uikit/keybind_hint/KeybindHint';
import type {MessageRecord} from '@app/records/MessageRecord';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import TtsUtils from '@app/utils/TtsUtils';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface MessageMenuItemProps {
	message: MessageRecord;
	onClose: () => void;
}

export const AddReactionMenuItem: React.FC<MessageMenuItemProps> = observer(({message, onClose}) => {
	const {t} = useLingui();
	const handleAddReaction = useCallback(() => {
		triggerAddReaction(message);
		onClose();
	}, [message, onClose]);

	return (
		<MenuItem icon={<AddReactionIcon />} onClick={handleAddReaction} shortcut={<KeybindHint action="add_reaction" />}>
			{t`Add Reaction`}
		</MenuItem>
	);
});

type EditMessageMenuItemProps = MessageMenuItemProps & {
	onEdit: () => void;
};

export const EditMessageMenuItem: React.FC<EditMessageMenuItemProps> = observer(({onEdit, onClose}) => {
	const {t} = useLingui();
	const handleEdit = useCallback(() => {
		onEdit();
		onClose();
	}, [onEdit, onClose]);

	return (
		<MenuItem icon={<EditMessageIcon />} onClick={handleEdit} shortcut={<KeybindHint action="edit_message" />}>
			{t`Edit Message`}
		</MenuItem>
	);
});

type ReplyMessageMenuItemProps = MessageMenuItemProps & {
	onReply: () => void;
};

export const ReplyMessageMenuItem: React.FC<ReplyMessageMenuItemProps> = observer(({onReply, onClose}) => {
	const {t} = useLingui();
	const handleReply = useCallback(() => {
		onReply();
		onClose();
	}, [onReply, onClose]);

	return (
		<MenuItem icon={<ReplyIcon />} onClick={handleReply} shortcut={<KeybindHint action="reply_message" />}>
			{t`Reply`}
		</MenuItem>
	);
});

type ForwardMessageMenuItemProps = MessageMenuItemProps & {
	onForward: () => void;
};

export const ForwardMessageMenuItem: React.FC<ForwardMessageMenuItemProps> = observer(({onForward, onClose}) => {
	const {t} = useLingui();
	const handleForward = useCallback(() => {
		onForward();
		onClose();
	}, [onForward, onClose]);

	return (
		<MenuItem icon={<ForwardIcon />} onClick={handleForward} shortcut={<KeybindHint action="forward_message" />}>
			{t`Forward`}
		</MenuItem>
	);
});

type BookmarkMessageMenuItemProps = MessageMenuItemProps & {
	onSave: (isSaved: boolean) => () => void;
};

export const BookmarkMessageMenuItem: React.FC<BookmarkMessageMenuItemProps> = observer(
	({message, onSave, onClose}) => {
		const {t} = useLingui();
		const isSaved = SavedMessagesStore.isSaved(message.id);

		const handleSave = useCallback(() => {
			onSave(isSaved)();
			onClose();
		}, [isSaved, onSave, onClose]);

		return (
			<MenuItem
				icon={<BookmarkIcon filled={isSaved} />}
				onClick={handleSave}
				shortcut={<KeybindHint action="bookmark_message" />}
			>
				{isSaved ? t`Remove Bookmark` : t`Bookmark Message`}
			</MenuItem>
		);
	},
);

type PinMessageMenuItemProps = MessageMenuItemProps & {
	onPin: () => void;
};

export const PinMessageMenuItem: React.FC<PinMessageMenuItemProps> = observer(({message, onPin, onClose}) => {
	const {t} = useLingui();
	const handlePin = useCallback(() => {
		onPin();
		onClose();
	}, [onPin, onClose]);

	return (
		<MenuItem icon={<PinIcon />} onClick={handlePin} shortcut={<KeybindHint action="pin_message" />}>
			{message.pinned ? t`Unpin Message` : t`Pin Message`}
		</MenuItem>
	);
});

type SuppressEmbedsMenuItemProps = MessageMenuItemProps & {
	onToggleSuppressEmbeds: () => void;
};

export const SuppressEmbedsMenuItem: React.FC<SuppressEmbedsMenuItemProps> = observer(
	({message, onToggleSuppressEmbeds, onClose}) => {
		const {t} = useLingui();
		const handleToggle = useCallback(() => {
			onToggleSuppressEmbeds();
			onClose();
		}, [onToggleSuppressEmbeds, onClose]);

		return (
			<MenuItem
				icon={<SuppressEmbedsIcon />}
				onClick={handleToggle}
				shortcut={<KeybindHint action="toggle_suppress_embeds" />}
			>
				{isEmbedsSuppressed(message) ? t`Unsuppress Embeds` : t`Suppress Embeds`}
			</MenuItem>
		);
	},
);

type CopyMessageTextMenuItemProps = MessageMenuItemProps & {
	onCopyMessage: () => void;
};

export const CopyMessageTextMenuItem: React.FC<CopyMessageTextMenuItemProps> = observer(({onCopyMessage, onClose}) => {
	const {t} = useLingui();
	const handleCopy = useCallback(() => {
		onCopyMessage();
		onClose();
	}, [onCopyMessage, onClose]);

	return (
		<MenuItem icon={<CopyMessageTextIcon />} onClick={handleCopy} shortcut={<KeybindHint action="copy_text" />}>
			{t`Copy Text`}
		</MenuItem>
	);
});

type CopyMessageLinkMenuItemProps = MessageMenuItemProps & {
	onCopyMessageLink: () => void;
};

export const CopyMessageLinkMenuItem: React.FC<CopyMessageLinkMenuItemProps> = observer(
	({onCopyMessageLink, onClose}) => {
		const {t} = useLingui();
		const handleCopyLink = useCallback(() => {
			onCopyMessageLink();
			onClose();
		}, [onCopyMessageLink, onClose]);

		return (
			<MenuItem icon={<CopyLinkIcon />} onClick={handleCopyLink} shortcut={<KeybindHint action="copy_message_link" />}>
				{t`Copy Message Link`}
			</MenuItem>
		);
	},
);

type CopyMessageIdMenuItemProps = MessageMenuItemProps & {
	onCopyMessageId: () => void;
};

export const CopyMessageIdMenuItem: React.FC<CopyMessageIdMenuItemProps> = observer(({onCopyMessageId, onClose}) => {
	const {t} = useLingui();
	const handleCopyId = useCallback(() => {
		onCopyMessageId();
		onClose();
	}, [onCopyMessageId, onClose]);

	return (
		<MenuItem icon={<CopyIdIcon />} onClick={handleCopyId} shortcut={<KeybindHint action="copy_message_id" />}>
			{t`Copy Message ID`}
		</MenuItem>
	);
});

export const DebugMessageMenuItem: React.FC<MessageMenuItemProps> = observer(({message, onClose}) => {
	const {t} = useLingui();
	const handleDebug = useCallback(() => {
		ModalActionCreators.push(modal(() => <MessageDebugModal title={t`Message Debug`} message={message} />));
		onClose();
	}, [message, onClose]);

	return (
		<MenuItem icon={<DebugMessageIcon />} onClick={handleDebug}>
			{t`Debug Message`}
		</MenuItem>
	);
});

type DeleteMessageMenuItemProps = MessageMenuItemProps & {
	onDelete: (bypassConfirm?: boolean) => void;
};

export const DeleteMessageMenuItem: React.FC<DeleteMessageMenuItemProps> = observer(({onDelete, onClose}) => {
	const {t} = useLingui();
	const handleDelete = useCallback(
		(event?: unknown) => {
			const shiftKey = Boolean((event as {shiftKey?: boolean} | undefined)?.shiftKey);
			onDelete(shiftKey);
			onClose();
		},
		[onDelete, onClose],
	);

	return (
		<MenuItem icon={<DeleteIcon />} onClick={handleDelete} danger shortcut={<KeybindHint action="delete_message" />}>
			{t`Delete Message`}
		</MenuItem>
	);
});

type RemoveAllReactionsMenuItemProps = MessageMenuItemProps & {
	onRemoveAllReactions: () => void;
};

export const RemoveAllReactionsMenuItem: React.FC<RemoveAllReactionsMenuItemProps> = observer(
	({onRemoveAllReactions, onClose}) => {
		const {t} = useLingui();
		const handleRemoveAll = useCallback(() => {
			onRemoveAllReactions();
			onClose();
		}, [onRemoveAllReactions, onClose]);

		return (
			<MenuItem icon={<RemoveAllReactionsIcon />} onClick={handleRemoveAll} danger>
				{t`Remove All Reactions`}
			</MenuItem>
		);
	},
);

type MarkAsUnreadMenuItemProps = MessageMenuItemProps & {
	onMarkAsUnread: () => void;
};

export const MarkAsUnreadMenuItem: React.FC<MarkAsUnreadMenuItemProps> = observer(({onMarkAsUnread, onClose}) => {
	const {t} = useLingui();
	const handleMarkAsUnread = useCallback(() => {
		onMarkAsUnread();
		onClose();
	}, [onMarkAsUnread, onClose]);

	return (
		<MenuItem icon={<MarkAsUnreadIcon />} onClick={handleMarkAsUnread} shortcut={<KeybindHint action="mark_unread" />}>
			{t`Mark as Unread`}
		</MenuItem>
	);
});

export const SpeakMessageMenuItem: React.FC<MessageMenuItemProps> = observer(({message}) => {
	const {t} = useLingui();

	const handleSpeakToggle = useCallback(() => {
		requestSpeakMessage(message);
	}, [message]);

	if (!TtsUtils.isSupported()) {
		return null;
	}

	if (!message.content.trim()) {
		return null;
	}

	const isSpeaking = TtsUtils.isSpeaking();

	return (
		<MenuItem
			icon={<SpeakMessageIcon />}
			onClick={handleSpeakToggle}
			shortcut={<KeybindHint action="speak_message" />}
			closeOnSelect={false}
		>
			{isSpeaking ? t`Stop Speaking` : t`Speak Message`}
		</MenuItem>
	);
});
