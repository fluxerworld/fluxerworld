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

import AppStorage from '@app/lib/AppStorage';
import {makeAutoObservable, reaction} from 'mobx';

interface EditingState {
	messageId: string;
	content: string;
}

const MESSAGE_EDIT_STORAGE_KEY = 'MessageEditStore';

class MessageEditStore {
	private editingStates: Record<string, EditingState> = {};
	editingDrafts: Record<string, string> = {};

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		AppStorage.removeItem(MESSAGE_EDIT_STORAGE_KEY);
	}

	startEditing(channelId: string, messageId: string, initialContent: string): void {
		const currentState = this.editingStates[channelId];
		if (currentState?.messageId === messageId && currentState.content === initialContent) {
			return;
		}

		const contentToUse = initialContent;
		this.editingStates = {
			...this.editingStates,
			[channelId]: {
				messageId,
				content: contentToUse,
			},
		};

		this.editingDrafts = {
			...this.editingDrafts,
			[messageId]: contentToUse,
		};
	}

	stopEditing(channelId: string): void {
		const state = this.editingStates[channelId];
		const {[channelId]: _, ...remainingEdits} = this.editingStates;
		this.editingStates = remainingEdits;

		if (state) {
			this.editingDrafts = {
				...this.editingDrafts,
				[state.messageId]: state.content,
			};
		}
	}

	isEditing(channelId: string, messageId: string): boolean {
		const state = this.editingStates[channelId];
		return state?.messageId === messageId;
	}

	getEditingMessageId(channelId: string): string | null {
		return this.editingStates[channelId]?.messageId ?? null;
	}

	setEditingContent(channelId: string, messageId: string, content: string): void {
		const state = this.editingStates[channelId];
		if (!state || state.messageId !== messageId || state.content === content) {
			return;
		}

		this.editingStates = {
			...this.editingStates,
			[channelId]: {
				...state,
				content,
			},
		};

		this.editingDrafts = {
			...this.editingDrafts,
			[messageId]: content,
		};
	}

	getEditingContent(channelId: string, messageId: string): string | null {
		const state = this.editingStates[channelId];
		if (!state || state.messageId !== messageId) {
			return null;
		}

		return state.content;
	}

	getDraftContent(messageId: string): string | null {
		return this.editingDrafts[messageId] ?? null;
	}

	clearDraftContent(messageId: string): void {
		if (!(messageId in this.editingDrafts)) {
			return;
		}

		const {[messageId]: _, ...remainingDrafts} = this.editingDrafts;
		this.editingDrafts = remainingDrafts;
	}

	subscribe(callback: () => void): () => void {
		return reaction(
			() => this.editingStates,
			() => callback(),
			{fireImmediately: true},
		);
	}
}

export default new MessageEditStore();
