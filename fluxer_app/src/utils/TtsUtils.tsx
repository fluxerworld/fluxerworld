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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {TtsUnsupportedModal} from '@app/components/alerts/TtsUnsupportedModal';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import MessageReferenceStore from '@app/stores/MessageReferenceStore';
import NotificationStore, {TTSNotificationMode} from '@app/stores/NotificationStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {SystemMessageUtils} from '@app/utils/SystemMessageUtils';
import * as TtsSpeechUtils from '@app/utils/TtsSpeechUtils';
import {formatMessageForTts} from '@app/utils/TtsTextFormatter';
import {MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {reaction} from 'mobx';

const MAX_RECENT_MESSAGES = 10;
const MAX_TEXT_LENGTH = 200;

let recentMessageIds: Array<string> = [];
let currentMessage: {channelId: string; messageId: string} | null = null;
let selectedVoice: SpeechSynthesisVoice | null = null;
let speaking = false;
let initialized = false;
let disposers: Array<() => void> = [];
let i18n: I18n | null = null;

function setI18n(instance: I18n): void {
	i18n = instance;
}

function showUnsupportedModal(): void {
	ContextMenuActionCreators.close();
	ModalActionCreators.push(modal(() => <TtsUnsupportedModal />));
}

function pickPreferredVoice(candidates: Array<SpeechSynthesisVoice>): SpeechSynthesisVoice | null {
	if (candidates.length === 0) {
		return null;
	}
	return candidates.find((v) => !v.localService) ?? candidates[0];
}

function findVoiceForLocale(locale: string): SpeechSynthesisVoice | null {
	const voices = TtsSpeechUtils.getVoices();
	if (voices.length === 0) {
		return null;
	}

	const exactMatches = voices.filter((v) => v.lang === locale);
	if (exactMatches.length > 0) {
		return pickPreferredVoice(exactMatches);
	}

	const prefix = locale.split('-')[0];
	const prefixMatches = voices.filter((v) => v.lang?.startsWith(prefix));
	if (prefixMatches.length > 0) {
		return pickPreferredVoice(prefixMatches);
	}

	const defaultVoice = voices.find((v) => v.default);
	return defaultVoice ?? voices[0] ?? null;
}

function refreshVoices(): void {
	const locale = UserSettingsStore.locale;
	selectedVoice = findVoiceForLocale(locale);
}

function stopSpeaking(): void {
	TtsSpeechUtils.cancel();
	currentMessage = null;
	speaking = false;
}

function addRecentMessageId(messageId: string): void {
	recentMessageIds = [messageId, ...recentMessageIds.filter((id) => id !== messageId)].slice(0, MAX_RECENT_MESSAGES);
}

function hasRecentlySpoken(messageId: string): boolean {
	return recentMessageIds.includes(messageId);
}

interface SpeakTextOptions {
	text: string;
	interrupt?: boolean;
	maxLength?: number;
	rate?: number;
	onStart?: () => void;
	onEnd?: () => void;
}

function speakText(options: SpeakTextOptions): void {
	const {text, interrupt = true, maxLength = MAX_TEXT_LENGTH, rate, onStart, onEnd} = options;

	if (!TtsSpeechUtils.isSupported()) {
		showUnsupportedModal();
		return;
	}

	if (interrupt) {
		stopSpeaking();
	}

	if (selectedVoice === null) {
		refreshVoices();
	}

	const utterance = TtsSpeechUtils.createUtterance(text, maxLength);
	if (!utterance) {
		return;
	}

	if (rate !== undefined) {
		utterance.rate = rate;
	}

	utterance.onstart = () => {
		speaking = true;
		onStart?.();
	};

	utterance.onend = () => {
		speaking = false;
		currentMessage = null;
		onEnd?.();
	};

	utterance.onerror = (event) => {
		if (event.error !== 'canceled' && event.error !== 'interrupted') {
			speaking = false;
			currentMessage = null;
			onEnd?.();
		}
	};

	TtsSpeechUtils.speak(utterance, selectedVoice);
}

function speakMessage(content: string): void {
	if (!TtsSpeechUtils.isSupported()) {
		showUnsupportedModal();
		return;
	}

	if (speaking) {
		stopSpeaking();
		return;
	}

	speakText({text: content});
}

function isUserMessageType(type: number): boolean {
	return type === MessageTypes.DEFAULT || type === MessageTypes.REPLY || type === MessageTypes.CLIENT_SYSTEM;
}

function describeNonTextContent(message: Message, localI18n: I18n): string | null {
	if (message.stickers && message.stickers.length > 0) {
		return localI18n._(msg`sent a sticker`);
	}
	if (message.attachments && message.attachments.length > 0) {
		if (message.attachments.length === 1) {
			return localI18n._(msg`sent an attachment`);
		}
		const count = String(message.attachments.length);
		return localI18n._(msg`sent ${count} attachments`);
	}
	if (message.embeds && message.embeds.length > 0) {
		return localI18n._(msg`sent an embed`);
	}
	return null;
}

function shouldSpeakMessage(message: Message): boolean {
	const mode = NotificationStore.ttsNotificationMode;
	const isExplicitTts = message.tts === true;
	const isSelf = message.author.id === AuthenticationStore.currentUserId;
	const isSystemMessage = !isUserMessageType(message.type);

	if (isSelf && !isSystemMessage) {
		return false;
	}

	if (mode === TTSNotificationMode.NEVER) {
		return isExplicitTts && AccessibilityStore.enableTTSCommand;
	}

	if (mode === TTSNotificationMode.FOR_CURRENT_CHANNEL) {
		if (message.channel_id !== SelectedChannelStore.currentChannelId) {
			return false;
		}
	}

	return true;
}

function handleIncomingTtsMessage(message: Message): void {
	if (!TtsSpeechUtils.isSupported()) {
		return;
	}

	if (!shouldSpeakMessage(message)) {
		return;
	}

	if (hasRecentlySpoken(message.id)) {
		return;
	}

	if (RelationshipStore.isBlocked(message.author.id)) {
		return;
	}

	const channel = ChannelStore.getChannel(message.channel_id);
	if (!channel) {
		return;
	}

	if (
		UserGuildSettingsStore.isGuildOrChannelMuted(channel.guildId ?? null, channel.id) ||
		UserGuildSettingsStore.isCategoryMuted(channel.guildId ?? null, channel.id)
	) {
		return;
	}

	if (!i18n) {
		return;
	}

	if (!isUserMessageType(message.type)) {
		const systemText = SystemMessageUtils.stringify(message, i18n);
		if (!systemText) {
			return;
		}
		addRecentMessageId(message.id);
		currentMessage = {channelId: message.channel_id, messageId: message.id};
		speakText({text: systemText});
		return;
	}

	const author = UserStore.getUser(message.author.id);
	if (!author) {
		return;
	}

	const authorName = NicknameUtils.getNickname(author, channel.guildId ?? undefined);

	if (!message.content.trim()) {
		const description = describeNonTextContent(message, i18n);
		if (!description) {
			return;
		}
		addRecentMessageId(message.id);
		currentMessage = {channelId: message.channel_id, messageId: message.id};
		speakText({text: i18n._(msg`${authorName} ${description}`)});
		return;
	}

	let replyAuthorName: string | null = null;
	if (message.message_reference?.message_id) {
		const refChannelId = message.message_reference.channel_id ?? message.channel_id;
		const refMessageId = message.message_reference.message_id;
		const ref = MessageReferenceStore.getMessageReference(refChannelId, refMessageId);
		if (ref.message) {
			const replyAuthor = UserStore.getUser(ref.message.author.id);
			if (replyAuthor) {
				replyAuthorName = NicknameUtils.getNickname(replyAuthor, channel.guildId ?? undefined);
			}
		}
	}

	const formattedText = formatMessageForTts(
		message.content,
		authorName,
		channel.guildId ?? null,
		i18n,
		replyAuthorName,
	);

	addRecentMessageId(message.id);
	currentMessage = {channelId: message.channel_id, messageId: message.id};

	speakText({text: formattedText});
}

function handleMessageDelete(channelId: string, messageId: string): void {
	if (currentMessage?.channelId === channelId && currentMessage?.messageId === messageId) {
		stopSpeaking();
	}
}

function handleChannelSelect(channelId: string | null): void {
	if (currentMessage && currentMessage.channelId !== channelId) {
		stopSpeaking();
	}
}

function init(): void {
	if (initialized) {
		return;
	}
	initialized = true;

	if (!TtsSpeechUtils.isSupported()) {
		return;
	}

	window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
	refreshVoices();

	disposers.push(
		reaction(
			() => SelectedChannelStore.currentChannelId,
			(channelId) => handleChannelSelect(channelId),
		),
	);

	disposers.push(
		reaction(
			() => UserSettingsStore.locale,
			() => refreshVoices(),
		),
	);
}

function dispose(): void {
	if (!initialized) {
		return;
	}

	stopSpeaking();

	if (TtsSpeechUtils.isSupported()) {
		window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
	}

	for (const disposer of disposers) {
		disposer();
	}
	disposers = [];

	recentMessageIds = [];
	selectedVoice = null;
	initialized = false;
}

function isSupported(): boolean {
	return TtsSpeechUtils.isSupported();
}

function isSpeaking(): boolean {
	return speaking;
}

function hasVoices(): boolean {
	return selectedVoice !== null || TtsSpeechUtils.getVoices().length > 0;
}

interface SpeakOptions {
	rate?: number;
	onEnd?: () => void;
}

function speak(text: string, options?: SpeakOptions): void {
	speakText({
		text,
		maxLength: 2000,
		rate: options?.rate,
		onEnd: options?.onEnd,
	});
}

function stop(): void {
	stopSpeaking();
}

export default {
	init,
	dispose,
	setI18n,
	isSupported,
	isSpeaking,
	hasVoices,
	speak,
	stop,
	speakMessage,
	stopSpeaking,
	handleIncomingTtsMessage,
	handleMessageDelete,
	handleChannelSelect,
};
