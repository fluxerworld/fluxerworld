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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import {
	requestCopyMessageId,
	requestCopyMessageLink,
	requestCopyMessageText,
	requestDeleteMessage,
	requestMarkMessageUnread,
	requestMessageForward,
	requestMessagePin,
	requestMessageReply,
	requestSpeakMessage,
	requestToggleBookmark,
	requestToggleSuppressEmbeds,
	startMessageEdit,
	triggerAddReaction,
} from '@app/components/channel/MessageActionUtils';
import {AddGuildModal} from '@app/components/modals/AddGuildModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {CreateDMModal} from '@app/components/modals/CreateDMModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildListStore from '@app/stores/GuildListStore';
import GuildStore from '@app/stores/GuildStore';
import InboxStore from '@app/stores/InboxStore';
import KeybindStore, {type KeybindCommand, type KeybindConfig, type KeyCombo} from '@app/stores/KeybindStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MessageFocusStore from '@app/stores/MessageFocusStore';
import NavigationStore from '@app/stores/NavigationStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import SelectedGuildStore from '@app/stores/SelectedGuildStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {goToMessage} from '@app/utils/MessageNavigator';
import {checkNativePermission} from '@app/utils/NativePermissions';
import {getElectronAPI, isNativeMacOS} from '@app/utils/NativeUtils';
import * as RouterUtils from '@app/utils/RouterUtils';
import {jsKeyToUiohookKeycode} from '@app/utils/UiohookKeycodes';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {JumpTypes} from '@fluxer/constants/src/JumpConstants';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import CombokeysImport from 'combokeys';
import {autorun} from 'mobx';
import React from 'react';

interface CombokeysInstance {
	bind(keys: string | Array<string>, callback: (event: KeyboardEvent) => void, action?: string): void;
	reset(): void;
	detach(): void;
	stopCallback: (e: Event, element: Element) => boolean;
}

type ShortcutSource = 'local' | 'global';

type KeybindHandler = (payload: {
	type: 'press' | 'release';
	source: ShortcutSource;
	context?: {focusedMessage?: MessageRecord};
}) => void;

const NON_TEXT_INPUT_TYPES = new Set([
	'button',
	'checkbox',
	'radio',
	'range',
	'color',
	'file',
	'image',
	'submit',
	'reset',
]);

const isEditableElement = (target: EventTarget | null): target is HTMLElement => {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tagName = target.tagName;
	if (tagName === 'TEXTAREA') return true;
	if (tagName === 'INPUT') {
		const type = ((target as HTMLInputElement).type || '').toLowerCase();
		return !NON_TEXT_INPUT_TYPES.has(type);
	}
	return false;
};

const isAltOnlyArrowCombo = (combo: KeyCombo): boolean => {
	if (!combo.alt || combo.ctrlOrMeta || combo.ctrl || combo.meta) return false;
	const key = combo.code ?? combo.key;
	return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
};

const comboToShortcutString = (combo: KeyCombo): string => {
	const parts: Array<string> = [];
	if (combo.ctrl) {
		parts.push('Control');
	} else if (combo.ctrlOrMeta) {
		parts.push('CommandOrControl');
	}
	if (combo.meta) parts.push('Super');
	if (combo.shift) parts.push('Shift');
	if (combo.alt) parts.push('Alt');
	const rawKey = combo.code ?? combo.key;
	const key = rawKey === ' ' ? 'Space' : rawKey;
	parts.push(key && key.length === 1 ? key.toUpperCase() : (key ?? ''));
	return parts.filter(Boolean).join('+');
};

const keyFromComboForCombokeys = (combo: KeyCombo): string | null => {
	const raw = combo.code ?? combo.key;
	if (!raw) return null;

	if (raw === ' ') return 'space';
	if (raw.length === 1) {
		return raw.toLowerCase();
	}

	if (/^Key[A-Z]$/.test(raw)) {
		return raw.slice(3).toLowerCase();
	}

	if (/^Digit[0-9]$/.test(raw)) {
		return raw.slice(5);
	}

	switch (raw) {
		case 'Space':
		case 'Spacebar':
			return 'space';
		case 'Escape':
		case 'Esc':
			return 'esc';
		case 'Enter':
			return 'enter';
		case 'Tab':
			return 'tab';
		case 'Backspace':
			return 'backspace';
		case 'ArrowUp':
		case 'Up':
			return 'up';
		case 'ArrowDown':
		case 'Down':
			return 'down';
		case 'ArrowLeft':
		case 'Left':
			return 'left';
		case 'ArrowRight':
		case 'Right':
			return 'right';
		default:
			return raw.toLowerCase();
	}
};

const comboToCombokeysString = (combo: KeyCombo): string | null => {
	const parts: Array<string> = [];
	if (combo.ctrl) {
		parts.push('ctrl');
	} else if (combo.ctrlOrMeta) {
		parts.push('mod');
	}
	if (combo.meta) parts.push('meta');
	if (combo.shift) parts.push('shift');
	if (combo.alt) parts.push('alt');

	const key = keyFromComboForCombokeys(combo);
	if (!key) return null;

	parts.push(key);
	return parts.join('+');
};

class KeybindManager {
	private handlers = new Map<KeybindCommand, KeybindHandler>();
	private initialized = false;
	private globalShortcutsEnabled = false;
	private suspended = false;
	private disposers: Array<() => void> = [];
	private combokeys: CombokeysInstance | null = null;
	private accessibilityStatus: 'unknown' | 'granted' | 'denied' = 'unknown';
	private pttReleaseTimer: ReturnType<typeof setTimeout> | null = null;
	private globalShortcutUnsubscribe: (() => void) | null = null;
	private globalKeyHookUnsubscribes: Array<() => void> = [];
	private globalKeyHookStarted = false;
	private pttKeycode: number | null = null;
	private pttMouseButton: number | null = null;
	private logger = new Logger('KeybindManager');

	private get currentChannelId(): string | null {
		return SelectedChannelStore.currentChannelId;
	}

	private get currentGuildId(): string | null {
		return SelectedGuildStore.selectedGuildId;
	}

	private navigateToChannel(guildId: string | null, channelId: string): void {
		const channel = ChannelStore.getChannel(channelId);
		const effectiveGuildId = guildId ?? channel?.guildId ?? null;

		if (channel?.guildId) {
			NavigationActionCreators.selectChannel(channel.guildId, channelId);
			return;
		}

		if (channel && !channel.guildId) {
			NavigationActionCreators.selectChannel(ME, channelId);
			return;
		}

		if (effectiveGuildId) {
			NavigationActionCreators.selectChannel(effectiveGuildId, channelId);
		}
	}

	private get activeKeybinds(): Array<KeybindConfig & {combo: KeyCombo}> {
		return KeybindStore.getAll().filter(({combo}) => combo.enabled ?? true);
	}

	private get activeGlobalKeybinds(): Array<KeybindConfig & {combo: KeyCombo}> {
		return this.activeKeybinds.filter(
			(k) => k.allowGlobal && (k.combo.global ?? false) && ((k.combo.key ?? '') !== '' || (k.combo.code ?? '') !== ''),
		);
	}

	private getOrderedGuilds(): Array<GuildRecord> {
		if (GuildListStore.guilds.length > 0) {
			return GuildListStore.guilds;
		}
		return GuildStore.getGuilds();
	}

	private getFirstSelectableChannelId(guildId: string): string | undefined {
		const channels = ChannelStore.getGuildChannels(guildId);
		const selectableChannel = channels.find((c) => c.type !== ChannelTypes.GUILD_CATEGORY);
		return selectableChannel?.id;
	}

	private isAppRoute(pathname: string): boolean {
		return pathname.startsWith('/channels/');
	}

	private ensureCombokeys(): CombokeysInstance | null {
		if (!this.combokeys && CombokeysImport) {
			this.combokeys = new CombokeysImport(document.documentElement);
			if (this.combokeys) {
				this.combokeys.stopCallback = () => false;
			}
		}
		return this.combokeys;
	}

	private async checkInputMonitoringPermission(): Promise<boolean> {
		if (!isNativeMacOS()) return true;
		if (this.accessibilityStatus === 'granted') return true;

		const result = await checkNativePermission('input-monitoring');
		if (result === 'granted') {
			this.accessibilityStatus = 'granted';
			return true;
		}

		if (result === 'denied') {
			this.accessibilityStatus = 'denied';
		} else {
			this.accessibilityStatus = 'unknown';
		}
		return false;
	}

	async init(i18n: I18n) {
		if (this.initialized) return;
		this.initialized = true;

		this.ensureCombokeys();

		this.registerDefaultHandlers(i18n);

		this.refreshLocalShortcuts();

		this.disposers.push(
			autorun(() => {
				this.refreshLocalShortcuts();
			}),
		);

		this.disposers.push(
			autorun(() => {
				void this.refreshGlobalShortcuts();
			}),
		);

		this.disposers.push(
			autorun(() => {
				MediaEngineStore.handlePushToTalkModeChange();
			}),
		);

		this.disposers.push(
			autorun(() => {
				void this.refreshGlobalKeyHook();
			}),
		);

		this.disposers.push(
			autorun(() => {
				const pathname = NavigationStore.pathname;
				const isAppRoute = this.isAppRoute(pathname);

				if (!isAppRoute && !this.suspended) {
					this.suspend();
				} else if (isAppRoute && this.suspended) {
					this.resume();
				}
			}),
		);

		await this.refreshGlobalShortcuts();
		await this.refreshGlobalKeyHook();
	}

	private async refreshGlobalKeyHook(): Promise<void> {
		const electronApi = getElectronAPI();
		if (!electronApi?.globalKeyHookStart) return;

		const pttKeybind = KeybindStore.getByAction('push_to_talk');
		const isPttEnabled = KeybindStore.isPushToTalkEnabled();
		const hasPttKeybind = !!(pttKeybind.combo.key || pttKeybind.combo.code);
		const shouldUseGlobalHook = isPttEnabled && hasPttKeybind && (pttKeybind.combo.global ?? false);

		if (shouldUseGlobalHook) {
			const started = await this.startGlobalKeyHook();
			if (started) {
				this.pttKeycode = jsKeyToUiohookKeycode(pttKeybind.combo.code ?? pttKeybind.combo.key);
				this.pttMouseButton = null;
			}
		} else {
			this.stopGlobalKeyHook();
			this.pttKeycode = null;
			this.pttMouseButton = null;
		}
	}

	async reapplyGlobalShortcuts() {
		if (!this.initialized) return;
		await this.refreshGlobalShortcuts();
	}

	destroy() {
		if (!this.initialized) return;
		this.initialized = false;

		this.disposers.forEach((dispose) => dispose());
		this.disposers = [];

		if (this.globalShortcutUnsubscribe) {
			this.globalShortcutUnsubscribe();
			this.globalShortcutUnsubscribe = null;
		}

		this.stopGlobalKeyHook();

		const electronApi = getElectronAPI();
		if (electronApi) {
			void electronApi.unregisterAllGlobalShortcuts?.().catch(() => {});
		}

		this.handlers.clear();

		this.combokeys?.detach();
		this.combokeys = null;
	}

	async startGlobalKeyHook(): Promise<boolean> {
		const electronApi = getElectronAPI();
		if (!electronApi?.globalKeyHookStart) return false;

		if (this.globalKeyHookStarted) return true;

		if (!(await this.checkInputMonitoringPermission())) {
			return false;
		}

		const started = await electronApi.globalKeyHookStart();
		if (!started) return false;

		this.globalKeyHookStarted = true;

		const keyEventUnsub = electronApi.onGlobalKeyEvent?.((event) => {
			this.handleGlobalKeyEvent(event as {type: 'keydown' | 'keyup'; keycode: number; keyName: string});
		});
		if (keyEventUnsub) this.globalKeyHookUnsubscribes.push(keyEventUnsub);

		const mouseEventUnsub = electronApi.onGlobalMouseEvent?.((event) => {
			this.handleGlobalMouseEvent(event as {type: 'mousedown' | 'mouseup'; button: number});
		});
		if (mouseEventUnsub) this.globalKeyHookUnsubscribes.push(mouseEventUnsub);

		return true;
	}

	stopGlobalKeyHook(): void {
		const electronApi = getElectronAPI();

		this.globalKeyHookUnsubscribes.forEach((unsub) => unsub());
		this.globalKeyHookUnsubscribes = [];

		if (electronApi?.globalKeyHookStop && this.globalKeyHookStarted) {
			void electronApi.globalKeyHookStop();
		}

		this.globalKeyHookStarted = false;
	}

	private handleGlobalKeyEvent(event: {type: 'keydown' | 'keyup'; keycode: number; keyName: string}): void {
		if (this.pttKeycode !== null && event.keycode === this.pttKeycode) {
			const handler = this.handlers.get('push_to_talk');
			if (handler) {
				handler({
					type: event.type === 'keydown' ? 'press' : 'release',
					source: 'global',
				});
			}
		}
	}

	private handleGlobalMouseEvent(event: {type: 'mousedown' | 'mouseup'; button: number}): void {
		if (this.pttMouseButton !== null && event.button === this.pttMouseButton) {
			const handler = this.handlers.get('push_to_talk');
			if (handler) {
				handler({
					type: event.type === 'mousedown' ? 'press' : 'release',
					source: 'global',
				});
			}
		}
	}

	setPttKeybind(keycode: number | null, mouseButton: number | null): void {
		this.pttKeycode = keycode;
		this.pttMouseButton = mouseButton;
	}

	suspend(): void {
		this.suspended = true;
		this.combokeys?.reset();
	}

	resume(): void {
		this.suspended = false;
		this.refreshLocalShortcuts();
	}

	register(action: KeybindCommand, handler: KeybindHandler) {
		this.handlers.set(action, handler);
	}

	private registerDefaultHandlers(i18n: I18n) {
		this.register('quick_switcher', ({type}) => {
			if (type !== 'press') return;

			if (QuickSwitcherStore.getIsOpen()) QuickSwitcherStore.hide();
			else QuickSwitcherStore.show();
		});

		this.register('toggle_hotkeys', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(UserSettingsModal, {initialTab: 'keybinds'})));
			ComponentDispatch.dispatch('USER_SETTINGS_TAB_SELECT', {tab: 'keybinds'});
		});

		this.register('get_help', ({type}) => {
			if (type !== 'press') return;
			window.open(Routes.help(), '_blank', 'noopener');
		});

		this.register('search', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('MESSAGE_SEARCH_OPEN');
		});

		this.register('toggle_mute', ({type}) => {
			if (type !== 'press') return;
			const connectedGuildId = MediaEngineStore.guildId;
			const voiceState = MediaEngineStore.getVoiceState(connectedGuildId);
			const isGuildMuted = voiceState?.mute ?? false;

			if (isGuildMuted) {
				ModalActionCreators.push(
					modal(() =>
						React.createElement(ConfirmModal, {
							title: i18n._(msg`Community Muted`),
							description: i18n._(msg`You cannot unmute yourself because you have been muted by a moderator.`),
							primaryText: i18n._(msg`Okay`),
							primaryVariant: 'primary',
							secondaryText: false,
							onPrimary: () => {},
						}),
					),
				);
				return;
			}

			void VoiceStateActionCreators.toggleSelfMute(null);
		});

		this.register('toggle_deafen', ({type}) => {
			if (type !== 'press') return;
			const connectedGuildId = MediaEngineStore.guildId;
			const voiceState = MediaEngineStore.getVoiceState(connectedGuildId);
			const isGuildDeafened = voiceState?.deaf ?? false;

			if (isGuildDeafened) {
				ModalActionCreators.push(
					modal(() =>
						React.createElement(ConfirmModal, {
							title: i18n._(msg`Community Deafened`),
							description: i18n._(msg`You cannot undeafen yourself because you have been deafened by a moderator.`),
							primaryText: i18n._(msg`Okay`),
							primaryVariant: 'primary',
							secondaryText: false,
							onPrimary: () => {},
						}),
					),
				);
				return;
			}

			void VoiceStateActionCreators.toggleSelfDeaf(null);
		});

		this.register('toggle_settings', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(UserSettingsModal)));
		});

		this.register('push_to_talk', ({type}) => {
			if (type === 'press') {
				if (this.pttReleaseTimer) {
					clearTimeout(this.pttReleaseTimer);
					this.pttReleaseTimer = null;
				}
				const shouldUnmute = KeybindStore.handlePushToTalkPress();
				if (shouldUnmute) {
					MediaEngineStore.applyPushToTalkHold(true);
				}
			} else {
				const shouldMute = KeybindStore.handlePushToTalkRelease();
				if (shouldMute) {
					const delay = KeybindStore.pushToTalkReleaseDelay;
					this.pttReleaseTimer = setTimeout(() => {
						this.pttReleaseTimer = null;
						MediaEngineStore.applyPushToTalkHold(false);
					}, delay);
				}
			}
		});

		this.register('scroll_chat_up', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('SCROLL_PAGE_UP');
		});

		this.register('scroll_chat_down', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('SCROLL_PAGE_DOWN');
		});

		this.register('jump_to_oldest_unread', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			const targetId = ReadStateStore.getOldestUnreadMessageId(channelId);
			if (!targetId) return;
			goToMessage(channelId, targetId, {jumpType: JumpTypes.ANIMATED});
		});

		this.register('mark_channel_read', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			if (ReadStateStore.hasUnread(channelId)) {
				ReadStateActionCreators.ack(channelId, true, true);
			}
		});

		this.register('mark_server_read', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const channelIds = channels
				.filter((channel) => ReadStateStore.hasUnread(channel.id))
				.map((channel) => channel.id);
			if (channelIds.length > 0) {
				void ReadStateActionCreators.bulkAckChannels(channelIds);
			}
		});

		this.register('mark_top_inbox_read', ({type}) => {
			if (type !== 'press') return;

			const inboxTab = InboxStore.selectedTab;

			if (inboxTab === 'bookmarks') {
				const savedMessages = SavedMessagesStore.savedMessages;
				const unreadBookmark = savedMessages.find((message) => {
					return ReadStateStore.hasUnread(message.channelId);
				});

				if (unreadBookmark) {
					ReadStateActionCreators.ack(unreadBookmark.channelId, true, true);
				}
			} else {
				const mentions = RecentMentionsStore.recentMentions;
				const unreadMention = mentions.find((message) => {
					return ReadStateStore.hasUnread(message.channelId);
				});

				if (unreadMention) {
					ReadStateActionCreators.ack(unreadMention.channelId, true, true);
				}
			}
		});

		this.register('edit_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			startMessageEdit(message);
		});

		this.register('delete_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestDeleteMessage(message, i18n);
		});

		this.register('pin_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestMessagePin(message, i18n);
		});

		this.register('add_reaction', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			triggerAddReaction(message);
		});

		this.register('reply_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestMessageReply(message);
		});

		this.register('forward_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestMessageForward(message);
		});

		this.register('copy_text', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestCopyMessageText(message, i18n);
		});

		this.register('speak_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestSpeakMessage(message);
		});

		this.register('mark_unread', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestMarkMessageUnread(message);
		});

		this.register('bookmark_message', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestToggleBookmark(message, i18n);
		});

		this.register('toggle_suppress_embeds', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestToggleSuppressEmbeds(message, i18n);
		});

		this.register('copy_message_link', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestCopyMessageLink(message, i18n);
		});

		this.register('copy_message_id', ({type, context}) => {
			if (type !== 'press') return;
			const message = context?.focusedMessage ?? MessageFocusStore.getFocusedMessage();
			if (!message) return;
			requestCopyMessageId(message, i18n);
		});

		this.register('navigate_history_back', ({type}) => {
			if (type !== 'press') return;
			const history = RouterUtils.getHistory();
			if (history?.go) history.go(-1);
		});

		this.register('navigate_history_forward', ({type}) => {
			if (type !== 'press') return;
			const history = RouterUtils.getHistory();
			if (history?.go) history.go(1);
		});

		this.register('navigate_to_current_call', ({type}) => {
			if (type !== 'press') return;
			const channelId = MediaEngineStore.channelId;
			const guildId = MediaEngineStore.guildId;
			if (!channelId) return;
			this.navigateToChannel(guildId, channelId);
		});

		this.register('navigate_last_server_or_dm', ({type}) => {
			if (type !== 'press') return;
			const lastGuild = SelectedGuildStore.lastSelectedGuildId;
			const dmChannel = SelectedChannelStore.selectedChannelIds.get(ME);
			if (lastGuild) {
				const channelId = SelectedChannelStore.selectedChannelIds.get(lastGuild);
				if (channelId) {
					this.navigateToChannel(lastGuild, channelId);
					return;
				}
			}
			if (dmChannel) {
				this.navigateToChannel(ME, dmChannel);
			}
		});

		this.register('navigate_channel_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const current = this.currentChannelId;
			if (!channels.length || !current) return;
			const idx = channels.findIndex((c) => c.id === current);
			const next = channels[(idx + 1) % channels.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_channel_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const channels = ChannelStore.getGuildChannels(guildId);
			const current = this.currentChannelId;
			if (!channels.length || !current) return;
			const idx = channels.findIndex((c) => c.id === current);
			const prev = channels[(idx - 1 + channels.length) % channels.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('navigate_server_next', ({type}) => {
			if (type !== 'press') return;
			const guilds = this.getOrderedGuilds();
			if (!guilds.length) return;
			const currentId = this.currentGuildId ?? guilds[0].id;
			const idx = guilds.findIndex((g) => g.id === currentId);
			const safeIdx = idx === -1 ? 0 : idx;
			const next = guilds[(safeIdx + 1) % guilds.length];
			const channelId =
				SelectedChannelStore.selectedChannelIds.get(next.id) ?? this.getFirstSelectableChannelId(next.id);
			if (!channelId) return;
			this.navigateToChannel(next.id, channelId);
		});

		this.register('navigate_server_previous', ({type}) => {
			if (type !== 'press') return;
			const guilds = this.getOrderedGuilds();
			if (!guilds.length) return;
			const currentId = this.currentGuildId ?? guilds[0].id;
			const idx = guilds.findIndex((g) => g.id === currentId);
			const safeIdx = idx === -1 ? 0 : idx;
			const prev = guilds[(safeIdx - 1 + guilds.length) % guilds.length];
			const channelId =
				SelectedChannelStore.selectedChannelIds.get(prev.id) ?? this.getFirstSelectableChannelId(prev.id);
			if (!channelId) return;
			this.navigateToChannel(prev.id, channelId);
		});

		this.register('navigate_unread_channel_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.hasUnread(c.id));
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const next = unread[(idx + 1) % unread.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_unread_channel_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.hasUnread(c.id));
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const prev = unread[(idx - 1 + unread.length) % unread.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('navigate_unread_mentions_next', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.getMentionCount(c.id) > 0);
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const next = unread[(idx + 1) % unread.length];
			this.navigateToChannel(guildId, next.id);
		});

		this.register('navigate_unread_mentions_previous', ({type}) => {
			if (type !== 'press') return;
			const guildId = this.currentGuildId;
			if (!guildId) return;
			const unread = ChannelStore.getGuildChannels(guildId).filter((c) => ReadStateStore.getMentionCount(c.id) > 0);
			if (!unread.length) return;
			const current = this.currentChannelId;
			const idx = unread.findIndex((c) => c.id === current);
			const prev = unread[(idx - 1 + unread.length) % unread.length];
			this.navigateToChannel(guildId, prev.id);
		});

		this.register('start_pm_call', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			const channel = ChannelStore.getChannel(channelId);
			if (!channel || channel.guildId) return;
			CallActionCreators.startCall(channelId);
		});

		this.register('toggle_pins_popout', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('CHANNEL_PINS_OPEN');
		});

		this.register('toggle_mentions_popout', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('INBOX_OPEN');
		});

		this.register('toggle_channel_member_list', ({type}) => {
			if (type !== 'press') return;
			ComponentDispatch.dispatch('CHANNEL_MEMBER_LIST_TOGGLE');
		});

		this.register('create_or_join_server', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(AddGuildModal)));
		});

		this.register('create_private_group', ({type}) => {
			if (type !== 'press') return;
			ModalActionCreators.push(modal(() => React.createElement(CreateDMModal)));
		});

		this.register('focus_text_area', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			ComponentDispatch.dispatch('FOCUS_TEXTAREA', {channelId});
		});

		this.register('upload_file', ({type}) => {
			if (type !== 'press') return;
			const channelId = this.currentChannelId;
			if (!channelId) return;
			ComponentDispatch.dispatch('TEXTAREA_UPLOAD_FILE', {channelId});
		});

		this.register('zoom_in', ({type}) => {
			if (type !== 'press') return;
			void AccessibilityStore.adjustZoom(0.1);
		});

		this.register('zoom_out', ({type}) => {
			if (type !== 'press') return;
			void AccessibilityStore.adjustZoom(-0.1);
		});

		this.register('zoom_reset', ({type}) => {
			if (type !== 'press') return;
			AccessibilityStore.updateSettings({zoomLevel: 1.0});
		});
	}

	private async refreshGlobalShortcuts() {
		const electronApi = getElectronAPI();
		if (!electronApi) return;

		const keybinds = this.activeGlobalKeybinds;

		try {
			await electronApi.unregisterAllGlobalShortcuts?.();
		} catch (error) {
			this.logger.error('Failed to unregister global shortcuts', error);
		}

		if (!keybinds.length) {
			this.globalShortcutsEnabled = false;
			return;
		}

		if (!(await this.checkInputMonitoringPermission())) {
			return;
		}

		if (!this.globalShortcutUnsubscribe) {
			this.globalShortcutUnsubscribe =
				electronApi.onGlobalShortcut?.((id: string) => {
					const keybind = keybinds.find((k) => comboToShortcutString(k.combo) === id);
					if (!keybind) return;

					const handler = this.handlers.get(keybind.action);
					if (!handler) return;

					handler({
						type: 'press',
						source: 'global',
					});
				}) ?? null;
		}

		const shortcuts = keybinds
			.map((k) => ({entry: k, shortcut: comboToShortcutString(k.combo)}))
			.filter((s): s is {entry: KeybindConfig & {combo: KeyCombo}; shortcut: string} => !!s.shortcut);

		if (!shortcuts.length) return;

		for (const {shortcut} of shortcuts) {
			try {
				await electronApi.registerGlobalShortcut?.(shortcut, shortcut);
			} catch (error) {
				this.logger.error(`Failed to register global shortcut ${shortcut}`, error);
			}
		}

		this.globalShortcutsEnabled = true;
	}

	private refreshLocalShortcuts() {
		if (!this.combokeys || this.suspended) return;

		this.combokeys.reset();

		this.activeKeybinds.forEach((entry) => this.bindLocalShortcut(entry));
	}

	private bindLocalShortcut(entry: KeybindConfig & {combo: KeyCombo}) {
		const {combo, action} = entry;
		const requiresKeyboardMode = entry.requiresKeyboardMode ?? false;
		const requiresMessageFocus = entry.requiresMessageFocus ?? false;
		const handler = this.handlers.get(action);
		if (!handler) return;

		const shortcut = comboToCombokeysString(combo);
		if (!shortcut) return;

		const hasModifier = !!(combo.ctrl || combo.ctrlOrMeta || combo.alt || combo.meta);
		const ignoreInEditable = isAltOnlyArrowCombo(combo);

		const shouldIgnoreEvent = (event: KeyboardEvent): boolean => {
			const target = event.target ?? null;
			if (!isEditableElement(target)) return false;
			if (!hasModifier) return true;
			if (entry.ignoreWhileTyping) return true;
			return ignoreInEditable;
		};

		const wrapHandler = (type: 'press' | 'release') => (event?: KeyboardEvent) => {
			if (!event) return;

			if (shouldIgnoreEvent(event)) return;

			if (this.globalShortcutsEnabled && (combo.global ?? false)) {
				return;
			}

			if (requiresKeyboardMode && !KeyboardModeStore.keyboardModeEnabled) {
				return;
			}

			if (action === 'focus_text_area' && KeyboardModeStore.keyboardModeEnabled) {
				return;
			}

			let focusedMessage: MessageRecord | null = null;
			if (requiresMessageFocus) {
				focusedMessage = MessageFocusStore.getFocusedMessage();
				if (!focusedMessage) {
					return;
				}
			}

			handler({
				type,
				source: 'local',
				context: focusedMessage ? {focusedMessage} : undefined,
			});
			if (type === 'press') event.preventDefault();
		};

		const combokeys = this.ensureCombokeys();
		if (combokeys) {
			combokeys.bind(shortcut, wrapHandler('press'), 'keydown');
			combokeys.bind(shortcut, wrapHandler('release'), 'keyup');
		}
	}
}

export default new KeybindManager();
