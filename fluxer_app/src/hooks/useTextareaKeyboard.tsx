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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {canFocusTextarea, safeFocus} from '@app/lib/InputFocusManager';
import {isTextInputKeyEvent} from '@app/lib/IsTextInputKeyEvent';
import type {MessageRecord} from '@app/records/MessageRecord';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MessageEditStore from '@app/stores/MessageEditStore';
import MessageFocusStore from '@app/stores/MessageFocusStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import {useCallback, useEffect} from 'react';

interface UseTextareaKeyboardOptions {
	channelId: string;
	isFocused: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	value: string;
	setValue: React.Dispatch<React.SetStateAction<string>>;
	handleTextChange: (newValue: string, previousValue: string) => void;
	previousValueRef: React.MutableRefObject<string>;
	clearSegments: () => void;
	replyingMessage: {messageId: string; mentioning: boolean} | null;
	editingMessage: MessageRecord | null;
	getLastEditableMessage: () => MessageRecord | null;
	enabled: boolean;
}

export const useTextareaKeyboard = ({
	channelId,
	isFocused,
	textareaRef,
	value,
	setValue,
	handleTextChange,
	previousValueRef,
	clearSegments,
	replyingMessage,
	editingMessage,
	getLastEditableMessage,
	enabled,
}: UseTextareaKeyboardOptions) => {
	const mobileLayout = MobileLayoutStore;
	const editingMessageId = MessageEditStore.getEditingMessageId(channelId);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			const textarea = textareaRef.current;

			if (!canFocusTextarea(textarea || undefined)) {
				return;
			}

			if (isFocused) {
				return;
			}

			if (QuickSwitcherStore.getIsOpen()) {
				return;
			}

			if (ContextMenuStore.contextMenu) {
				return;
			}

			if (KeyboardModeStore.keyboardModeEnabled && MessageFocusStore.focusedMessageId) {
				return;
			}

			if (!isTextInputKeyEvent(event)) {
				return;
			}

			if (!textarea) {
				return;
			}

			if (event.key === 'Dead') {
				safeFocus(textarea, true);
				return;
			}

			event.preventDefault();
			safeFocus(textarea, true);

			setValue((prev) => {
				const newValue = prev + event.key;
				handleTextChange(newValue, previousValueRef.current ?? '');
				return newValue;
			});
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [
		editingMessageId,
		isFocused,
		mobileLayout.enabled,
		handleTextChange,
		previousValueRef,
		textareaRef,
		setValue,
		enabled,
	]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				const isEditingInline = MessageEditStore.getEditingMessageId(channelId) != null;
				if (isEditingInline) {
					event.preventDefault();
					event.stopPropagation();
					MessageActionCreators.stopEdit(channelId);
					return;
				}

				if (editingMessage && mobileLayout.enabled) {
					event.preventDefault();
					MessageActionCreators.stopEditMobile(channelId);
					setValue('');
					clearSegments();
				} else if (replyingMessage) {
					event.preventDefault();
					MessageActionCreators.stopReply(channelId);
				} else {
					event.preventDefault();
					ComponentDispatch.dispatch('ESCAPE_PRESSED');
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [channelId, replyingMessage, editingMessage, mobileLayout.enabled, clearSegments, setValue]);

	const handleArrowUp = useCallback(
		(event: React.KeyboardEvent) => {
			if (!event.shiftKey && !value) {
				if (KeyboardModeStore.keyboardModeEnabled) {
					event.preventDefault();
					ComponentDispatch.dispatch('FOCUS_BOTTOMMOST_MESSAGE', {channelId});
					return;
				}
				const message = getLastEditableMessage();
				if (!message) {
					return;
				}
				event.preventDefault();
				MessageActionCreators.startEdit(channelId, message.id, message.content);
			}
		},
		[channelId, value, getLastEditableMessage],
	);

	return {handleArrowUp};
};
