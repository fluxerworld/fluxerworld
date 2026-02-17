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

import {makePersistent} from '@app/lib/MobXPersistence';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {makeAutoObservable, runInAction} from 'mobx';

export type KeybindCommand =
	| 'quick_switcher'
	| 'navigate_history_back'
	| 'navigate_history_forward'
	| 'navigate_server_previous'
	| 'navigate_server_next'
	| 'navigate_channel_previous'
	| 'navigate_channel_next'
	| 'navigate_unread_channel_previous'
	| 'navigate_unread_channel_next'
	| 'navigate_unread_mentions_previous'
	| 'navigate_unread_mentions_next'
	| 'navigate_to_current_call'
	| 'navigate_last_server_or_dm'
	| 'mark_channel_read'
	| 'mark_server_read'
	| 'mark_top_inbox_read'
	| 'edit_message'
	| 'delete_message'
	| 'pin_message'
	| 'add_reaction'
	| 'reply_message'
	| 'forward_message'
	| 'speak_message'
	| 'copy_text'
	| 'mark_unread'
	| 'bookmark_message'
	| 'toggle_suppress_embeds'
	| 'copy_message_link'
	| 'copy_message_id'
	| 'toggle_hotkeys'
	| 'toggle_pins_popout'
	| 'toggle_mentions_popout'
	| 'toggle_channel_member_list'
	| 'toggle_emoji_picker'
	| 'toggle_gif_picker'
	| 'toggle_sticker_picker'
	| 'toggle_memes_picker'
	| 'scroll_chat_up'
	| 'scroll_chat_down'
	| 'jump_to_oldest_unread'
	| 'create_or_join_server'
	| 'answer_incoming_call'
	| 'decline_incoming_call'
	| 'create_private_group'
	| 'start_pm_call'
	| 'focus_text_area'
	| 'toggle_mute'
	| 'toggle_deafen'
	| 'toggle_settings'
	| 'get_help'
	| 'search'
	| 'upload_file'
	| 'push_to_talk'
	| 'toggle_soundboard'
	| 'zoom_in'
	| 'zoom_out'
	| 'zoom_reset';

export interface KeyCombo {
	key: string;
	code?: string;
	ctrlOrMeta?: boolean;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	global?: boolean;
	enabled?: boolean;
}

export interface KeybindConfig {
	action: KeybindCommand;
	label: string;
	description?: string;
	combo: KeyCombo;
	ignoreWhileTyping?: boolean;
	allowGlobal?: boolean;
	requiresKeyboardMode?: boolean;
	requiresMessageFocus?: boolean;
	category: 'navigation' | 'voice' | 'messaging' | 'popouts' | 'calls' | 'system';
}

const TRANSMIT_MODES = ['voice_activity', 'push_to_talk'] as const;
type TransmitMode = (typeof TRANSMIT_MODES)[number];

const DEFAULT_RELEASE_DELAY_MS = 20;
const MIN_RELEASE_DELAY_MS = 20;
const MAX_RELEASE_DELAY_MS = 2000;
const LATCH_TAP_THRESHOLD_MS = 200;

const getDefaultKeybinds = (i18n: I18n): ReadonlyArray<KeybindConfig> =>
	[
		{
			action: 'quick_switcher',
			label: i18n._(msg`Find or Start a Direct Message`),
			description: i18n._(msg`Open the quick switcher overlay`),
			combo: {key: 'k', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_server_previous',
			label: i18n._(msg`Previous Community`),
			description: i18n._(msg`Navigate to the previous community`),
			combo: {key: 'ArrowUp', ctrlOrMeta: true, alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_server_next',
			label: i18n._(msg`Next Community`),
			description: i18n._(msg`Navigate to the next community`),
			combo: {key: 'ArrowDown', ctrlOrMeta: true, alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_channel_previous',
			label: i18n._(msg`Previous Channel`),
			description: i18n._(msg`Navigate to the previous channel in the community`),
			combo: {key: 'ArrowUp', alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_channel_next',
			label: i18n._(msg`Next Channel`),
			description: i18n._(msg`Navigate to the next channel in the community`),
			combo: {key: 'ArrowDown', alt: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_channel_previous',
			label: i18n._(msg`Previous Unread Channel`),
			description: i18n._(msg`Jump to the previous unread channel`),
			combo: {key: 'ArrowUp', alt: true, shift: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_channel_next',
			label: i18n._(msg`Next Unread Channel`),
			description: i18n._(msg`Jump to the next unread channel`),
			combo: {key: 'ArrowDown', alt: true, shift: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_mentions_previous',
			label: i18n._(msg`Previous Unread Mention`),
			description: i18n._(msg`Jump to the previous unread channel with mentions`),
			combo: {key: 'ArrowUp', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_unread_mentions_next',
			label: i18n._(msg`Next Unread Mention`),
			description: i18n._(msg`Jump to the next unread channel with mentions`),
			combo: {key: 'ArrowDown', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_history_back',
			label: i18n._(msg`Navigate Back`),
			description: i18n._(msg`Go back in navigation history`),
			combo: {key: '[', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_history_forward',
			label: i18n._(msg`Navigate Forward`),
			description: i18n._(msg`Go forward in navigation history`),
			combo: {key: ']', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_to_current_call',
			label: i18n._(msg`Go to Current Call`),
			description: i18n._(msg`Jump to the channel of the active call`),
			combo: {key: 'v', alt: true, shift: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'navigate_last_server_or_dm',
			label: i18n._(msg`Toggle Last Community / DMs`),
			description: i18n._(msg`Switch between the last community and direct messages`),
			combo: {key: 'ArrowRight', alt: true, ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'toggle_settings',
			label: i18n._(msg`Open User Settings`),
			description: i18n._(msg`Open user settings modal`),
			combo: {key: ',', ctrlOrMeta: true},
			category: 'navigation',
		},
		{
			action: 'toggle_hotkeys',
			label: i18n._(msg`Toggle Hotkeys`),
			description: i18n._(msg`Show or hide keyboard shortcut help`),
			combo: {key: '/', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'toggle_pins_popout',
			label: i18n._(msg`Toggle Pins Popout`),
			description: i18n._(msg`Open or close pinned messages`),
			combo: {key: 'p', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_mentions_popout',
			label: i18n._(msg`Toggle Inbox Popout`),
			description: i18n._(msg`Open or close the inbox popout`),
			combo: {key: 'i', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_channel_member_list',
			label: i18n._(msg`Toggle Channel Member List`),
			description: i18n._(msg`Show or hide the member list for the current channel`),
			combo: {key: 'u', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_emoji_picker',
			label: i18n._(msg`Toggle Emoji Picker`),
			description: i18n._(msg`Open or close the emoji picker`),
			combo: {key: 'e', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_gif_picker',
			label: i18n._(msg`Toggle GIF Picker`),
			description: i18n._(msg`Open or close the GIF picker`),
			combo: {key: 'g', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_sticker_picker',
			label: i18n._(msg`Toggle Sticker Picker`),
			description: i18n._(msg`Open or close the sticker picker`),
			combo: {key: 's', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'toggle_memes_picker',
			label: i18n._(msg`Toggle Saved Media`),
			description: i18n._(msg`Open or close the saved media picker`),
			combo: {key: 'm', ctrlOrMeta: true},
			category: 'popouts',
		},
		{
			action: 'scroll_chat_up',
			label: i18n._(msg`Scroll Chat Up`),
			description: i18n._(msg`Scroll the chat history up`),
			combo: {key: 'PageUp'},
			category: 'messaging',
		},
		{
			action: 'scroll_chat_down',
			label: i18n._(msg`Scroll Chat Down`),
			description: i18n._(msg`Scroll the chat history down`),
			combo: {key: 'PageDown'},
			category: 'messaging',
		},
		{
			action: 'jump_to_oldest_unread',
			label: i18n._(msg`Jump to Oldest Unread Message`),
			description: i18n._(msg`Jump to the oldest unread message in the channel`),
			combo: {key: 'PageUp', shift: true},
			category: 'messaging',
		},
		{
			action: 'mark_channel_read',
			label: i18n._(msg`Mark Channel as Read`),
			description: i18n._(msg`Mark the current channel as read`),
			combo: {key: 'Escape'},
			category: 'messaging',
		},
		{
			action: 'mark_server_read',
			label: i18n._(msg`Mark Community as Read`),
			description: i18n._(msg`Mark the current community as read`),
			combo: {key: 'Escape', shift: true},
			category: 'messaging',
		},
		{
			action: 'mark_top_inbox_read',
			label: i18n._(msg`Mark Top Inbox Channel as Read`),
			description: i18n._(msg`Mark the first unread channel in your inbox as read`),
			combo: {key: 'e', ctrlOrMeta: true, shift: true},
			category: 'messaging',
		},
		{
			action: 'edit_message',
			label: i18n._(msg`Edit Message`),
			description: i18n._(msg`Start editing the focused message`),
			combo: {key: 'e'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'delete_message',
			label: i18n._(msg`Delete Message`),
			description: i18n._(msg`Remove the focused message`),
			combo: {key: 'd'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'pin_message',
			label: i18n._(msg`Pin Message`),
			description: i18n._(msg`Pin or unpin the focused message`),
			combo: {key: 'p'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'add_reaction',
			label: i18n._(msg`Add Reaction`),
			description: i18n._(msg`Open the emoji picker for the focused message`),
			combo: {key: 'a'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'reply_message',
			label: i18n._(msg`Reply`),
			description: i18n._(msg`Start a reply to the focused message`),
			combo: {key: 'r'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'forward_message',
			label: i18n._(msg`Forward Message`),
			description: i18n._(msg`Forward the focused message to a different channel`),
			combo: {key: 'f'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'speak_message',
			label: i18n._(msg`Speak Message`),
			description: i18n._(msg`Read the focused message aloud`),
			combo: {key: 't'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'copy_text',
			label: i18n._(msg`Copy Text`),
			description: i18n._(msg`Copy the focused message text to the clipboard`),
			combo: {key: 'c'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'mark_unread',
			label: i18n._(msg`Mark Unread`),
			description: i18n._(msg`Mark the focused message as unread`),
			combo: {key: 'u'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'bookmark_message',
			label: i18n._(msg`Bookmark Message`),
			description: i18n._(msg`Save or remove the focused message from bookmarks`),
			combo: {key: 'b'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'toggle_suppress_embeds',
			label: i18n._(msg`Toggle Embed Suppression`),
			description: i18n._(msg`Suppress or reveal embeds on the focused message`),
			combo: {key: 's'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'copy_message_link',
			label: i18n._(msg`Copy Message Link`),
			description: i18n._(msg`Copy a jump link to the focused message`),
			combo: {key: 'l'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'copy_message_id',
			label: i18n._(msg`Copy Message ID`),
			description: i18n._(msg`Copy the focused message ID to the clipboard`),
			combo: {key: 'i'},
			requiresKeyboardMode: true,
			requiresMessageFocus: true,
			category: 'messaging',
		},
		{
			action: 'create_or_join_server',
			label: i18n._(msg`Create or Join a Community`),
			description: i18n._(msg`Open the create or join community flow`),
			combo: {key: 'n', ctrlOrMeta: true, shift: true},
			category: 'system',
		},
		{
			action: 'create_private_group',
			label: i18n._(msg`Create a Private Group`),
			description: i18n._(msg`Start a new private group`),
			combo: {key: 't', ctrlOrMeta: true, shift: true},
			category: 'system',
		},
		{
			action: 'start_pm_call',
			label: i18n._(msg`Start Call in Private Message or Group`),
			description: i18n._(msg`Begin a call in the current private conversation`),
			combo: {key: "'", ctrl: true},
			category: 'calls',
		},
		{
			action: 'answer_incoming_call',
			label: i18n._(msg`Answer Incoming Call`),
			description: i18n._(msg`Accept the incoming call`),
			combo: {key: 'Enter', ctrlOrMeta: true},
			category: 'calls',
		},
		{
			action: 'decline_incoming_call',
			label: i18n._(msg`Decline Incoming Call`),
			description: i18n._(msg`Decline or dismiss the incoming call`),
			combo: {key: 'Escape'},
			category: 'calls',
		},
		{
			action: 'focus_text_area',
			label: i18n._(msg`Focus Text Area`),
			description: i18n._(msg`Move focus to the message composer`),
			combo: {key: 'Tab'},
			category: 'messaging',
		},
		{
			action: 'toggle_mute',
			label: i18n._(msg`Toggle Mute`),
			description: i18n._(msg`Mute / unmute microphone`),
			combo: {key: 'm', ctrlOrMeta: true, shift: true, global: true, enabled: true},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'toggle_deafen',
			label: i18n._(msg`Toggle Deaf`),
			description: i18n._(msg`Deafen / undeafen`),
			combo: {key: 'd', ctrlOrMeta: true, shift: true, global: true, enabled: true},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'get_help',
			label: i18n._(msg`Get Help`),
			description: i18n._(msg`Open the help center`),
			combo: {key: 'h', ctrlOrMeta: true, shift: true},
			category: 'system',
		},
		{
			action: 'search',
			label: i18n._(msg`Search`),
			description: i18n._(msg`Search within the current view`),
			combo: {key: 'f', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'upload_file',
			label: i18n._(msg`Upload a File`),
			description: i18n._(msg`Open the upload file dialog`),
			combo: {key: 'u', ctrlOrMeta: true, shift: true},
			category: 'messaging',
		},
		{
			action: 'push_to_talk',
			label: i18n._(msg`Push-To-Talk (hold)`),
			description: i18n._(msg`Hold to temporarily unmute when push-to-talk is enabled`),
			combo: {key: '', enabled: false, global: false},
			allowGlobal: true,
			category: 'voice',
		},
		{
			action: 'zoom_in',
			label: i18n._(msg`Zoom In`),
			description: i18n._(msg`Increase app zoom level`),
			combo: {key: '=', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'zoom_out',
			label: i18n._(msg`Zoom Out`),
			description: i18n._(msg`Decrease app zoom level`),
			combo: {key: '-', ctrlOrMeta: true},
			category: 'system',
		},
		{
			action: 'zoom_reset',
			label: i18n._(msg`Reset Zoom`),
			description: i18n._(msg`Reset zoom to 100%`),
			combo: {key: '0', ctrlOrMeta: true},
			category: 'system',
		},
	] as const;

type KeybindState = Record<KeybindCommand, KeyCombo>;

class KeybindStore {
	keybinds: KeybindState = {} as KeybindState;

	transmitMode: TransmitMode = 'voice_activity';
	pushToTalkHeld = false;
	pushToTalkReleaseDelay = DEFAULT_RELEASE_DELAY_MS;
	pushToTalkLatching = false;

	private pushToTalkLatched = false;
	private pushToTalkPressTime = 0;
	private i18n: I18n | null = null;
	private initialized = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});

		void makePersistent(
			this,
			'KeybindStore',
			['keybinds', 'transmitMode', 'pushToTalkReleaseDelay', 'pushToTalkLatching'],
			{version: 3},
		);
	}

	setI18n(i18n: I18n): void {
		this.i18n = i18n;
		if (!this.initialized) {
			this.resetToDefaults();
			this.initialized = true;
		}
	}

	getAll(): Array<KeybindConfig & {combo: KeyCombo}> {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		const defaultKeybinds = getDefaultKeybinds(this.i18n);
		return defaultKeybinds.map((entry) => ({
			...entry,
			combo: this.keybinds[entry.action] ?? entry.combo,
		}));
	}

	getByAction(action: KeybindCommand): KeybindConfig & {combo: KeyCombo} {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		const defaultKeybinds = getDefaultKeybinds(this.i18n);
		const base = defaultKeybinds.find((k) => k.action === action);
		if (!base) throw new Error(`Unknown keybind action: ${action}`);

		return {
			...base,
			combo: this.keybinds[action] ?? base.combo,
		};
	}

	setKeybind(action: KeybindCommand, combo: KeyCombo): void {
		runInAction(() => {
			this.keybinds[action] = combo;
		});
	}

	toggleGlobal(action: KeybindCommand, enabled: boolean): void {
		const config = this.getByAction(action);
		if (!config.allowGlobal) return;

		this.setKeybind(action, {...config.combo, global: enabled});
	}

	resetToDefaults(): void {
		if (!this.i18n) {
			throw new Error('KeybindStore: i18n not initialized');
		}
		const defaultKeybinds = getDefaultKeybinds(this.i18n);
		runInAction(() => {
			this.keybinds = defaultKeybinds.reduce<KeybindState>((acc, entry) => {
				acc[entry.action] = {...entry.combo};
				return acc;
			}, {} as KeybindState);
		});
	}

	setTransmitMode(mode: TransmitMode): void {
		runInAction(() => {
			this.transmitMode = mode;
		});
	}

	isPushToTalkEnabled(): boolean {
		return this.transmitMode === 'push_to_talk';
	}

	setPushToTalkHeld(held: boolean): void {
		runInAction(() => {
			this.pushToTalkHeld = held;
		});
	}

	isPushToTalkMuted(userMuted: boolean): boolean {
		if (!this.isPushToTalkEnabled()) return false;
		if (userMuted) return false;
		if (this.pushToTalkLatched) return false;
		return !this.pushToTalkHeld;
	}

	hasPushToTalkKeybind(): boolean {
		const {combo} = this.getByAction('push_to_talk');
		return Boolean(combo.key || combo.code);
	}

	isPushToTalkEffective(): boolean {
		return this.isPushToTalkEnabled() && this.hasPushToTalkKeybind();
	}

	setPushToTalkReleaseDelay(delayMs: number): void {
		const clamped = Math.max(MIN_RELEASE_DELAY_MS, Math.min(MAX_RELEASE_DELAY_MS, delayMs));

		runInAction(() => {
			this.pushToTalkReleaseDelay = clamped;
		});
	}

	setPushToTalkLatching(enabled: boolean): void {
		runInAction(() => {
			this.pushToTalkLatching = enabled;
			if (!enabled) this.pushToTalkLatched = false;
		});
	}

	handlePushToTalkPress(nowMs: number = Date.now()): boolean {
		this.pushToTalkPressTime = nowMs;

		if (this.pushToTalkLatching && this.pushToTalkLatched) {
			runInAction(() => {
				this.pushToTalkLatched = false;
				this.pushToTalkHeld = false;
			});
			return false;
		}

		runInAction(() => {
			this.pushToTalkHeld = true;
		});
		return true;
	}

	handlePushToTalkRelease(nowMs: number = Date.now()): boolean {
		const pressDuration = nowMs - this.pushToTalkPressTime;

		if (this.pushToTalkLatching && pressDuration < LATCH_TAP_THRESHOLD_MS && !this.pushToTalkLatched) {
			runInAction(() => {
				this.pushToTalkLatched = true;
			});
			return false;
		}

		runInAction(() => {
			this.pushToTalkHeld = false;
		});
		return true;
	}

	isPushToTalkLatched(): boolean {
		return this.pushToTalkLatched;
	}

	resetPushToTalkState(): void {
		runInAction(() => {
			this.pushToTalkHeld = false;
			this.pushToTalkLatched = false;
			this.pushToTalkPressTime = 0;
		});
	}
}

export default new KeybindStore();

export function getDefaultKeybind(action: KeybindCommand, i18n: I18n): KeyCombo | null {
	const defaultKeybinds = getDefaultKeybinds(i18n);
	const found = defaultKeybinds.find((k) => k.action === action);
	return found ? {...found.combo} : null;
}
