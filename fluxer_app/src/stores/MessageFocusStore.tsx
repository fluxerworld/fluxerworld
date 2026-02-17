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

import type {MessageRecord} from '@app/records/MessageRecord';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MessageStore from '@app/stores/MessageStore';
import {autorun, makeAutoObservable} from 'mobx';

class MessageFocusStore {
	focusedChannelId: string | null = null;
	focusedMessageId: string | null = null;
	focusedMessage: MessageRecord | null = null;
	retainFocus = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});

		autorun(() => {
			if (!KeyboardModeStore.keyboardModeEnabled) {
				this.clearFocus();
			}
		});
	}

	focusMessage(channelId: string, messageId: string, message?: MessageRecord): void {
		if (!KeyboardModeStore.keyboardModeEnabled) {
			return;
		}
		if (this.focusedChannelId === channelId && this.focusedMessageId === messageId) {
			this.retainFocus = false;
			if (message) {
				this.focusedMessage = message;
			}
			return;
		}
		this.focusedChannelId = channelId;
		this.focusedMessageId = messageId;
		this.focusedMessage = message ?? null;
		this.retainFocus = false;
	}

	blurMessage(channelId: string, messageId: string): void {
		if (this.focusedChannelId !== channelId || this.focusedMessageId !== messageId) {
			return;
		}
		if (this.retainFocus) {
			return;
		}
		this.clearFocus();
	}

	holdContextFocus(channelId: string, messageId: string, message?: MessageRecord): void {
		if (!KeyboardModeStore.keyboardModeEnabled) {
			return;
		}
		this.focusMessage(channelId, messageId, message);
		this.retainFocus = true;
	}

	releaseContextFocus(channelId: string, messageId: string): void {
		if (this.focusedChannelId === channelId && this.focusedMessageId === messageId && this.retainFocus) {
			this.retainFocus = false;
		}
	}

	clearFocusedMessageIfMatches(channelId: string, messageId: string): void {
		if (this.focusedChannelId === channelId && this.focusedMessageId === messageId) {
			this.clearFocus();
		}
	}

	clearFocus(): void {
		this.focusedChannelId = null;
		this.focusedMessageId = null;
		this.focusedMessage = null;
		this.retainFocus = false;
	}

	getFocusedMessage(): MessageRecord | null {
		if (
			this.focusedMessage &&
			this.focusedMessageId === this.focusedMessage.id &&
			this.focusedChannelId === this.focusedMessage.channelId
		) {
			return this.focusedMessage;
		}
		if (!this.focusedChannelId || !this.focusedMessageId) {
			return null;
		}
		return MessageStore.getMessage(this.focusedChannelId, this.focusedMessageId) ?? null;
	}
}

export default new MessageFocusStore();
