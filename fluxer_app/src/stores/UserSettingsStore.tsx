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

import {Endpoints} from '@app/Endpoints';
import {loadLocaleCatalog} from '@app/I18n';
import {type CustomStatus, normalizeCustomStatus} from '@app/lib/CustomStatus';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import AccessibilityOverrideStore from '@app/stores/AccessibilityOverrideStore';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import LocalPresenceStore from '@app/stores/LocalPresenceStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import ThemeStore from '@app/stores/ThemeStore';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {normalizeStatus, StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {
	DEFAULT_GUILD_FOLDER_ICON,
	type GuildFolderIcon,
	RenderSpoilers,
	StickerAnimationOptions,
	ThemeTypes,
	TimeFormatTypes,
} from '@fluxer/constants/src/UserConstants';
import {camelCase, isArray, isEqual, isPlainObject, mapKeys, mapValues, snakeCase} from 'lodash';
import {action, makeAutoObservable, reaction, runInAction} from 'mobx';

export interface GuildFolder {
	id: number | null;
	name: string | null;
	color: number | null;
	flags: number;
	icon: GuildFolderIcon;
	guildIds: Array<string>;
}

export interface UserSettings {
	flags: number;
	status: string;
	statusResetsAt: string | null;
	statusResetsTo: string | null;
	theme: string;
	timeFormat: number;
	locale: string;
	restrictedGuilds: Array<string>;
	botRestrictedGuilds: Array<string>;
	defaultGuildsRestricted: boolean;
	botDefaultGuildsRestricted: boolean;
	inlineAttachmentMedia: boolean;
	inlineEmbedMedia: boolean;
	gifAutoPlay: boolean;
	renderEmbeds: boolean;
	renderReactions: boolean;
	animateEmoji: boolean;
	animateStickers: number;
	renderSpoilers: number;
	messageDisplayCompact: boolean;
	developerMode: boolean;
	friendSourceFlags: number;
	incomingCallFlags: number;
	groupDmAddPermissionFlags: number;
	guildFolders: Array<GuildFolder>;
	customStatus: CustomStatus | null;
	afkTimeout: number;
	trustedDomains: Array<string>;
	defaultHideMutedChannels: boolean;
}

const logger = new Logger('UserSettingsStore');

function convertKeysToCamelCaseInternal(value: unknown): unknown {
	if (isArray(value)) {
		return value.map(convertKeysToCamelCaseInternal);
	}

	if (isPlainObject(value)) {
		const record = value as Record<string, unknown>;
		return mapValues(
			mapKeys(record, (_, key) => camelCase(key)),
			convertKeysToCamelCaseInternal,
		);
	}

	return value;
}

function convertKeysToCamelCase<T>(obj: unknown): T {
	return convertKeysToCamelCaseInternal(obj) as T;
}

function convertKeysToSnakeCaseInternal(value: unknown): unknown {
	if (isArray(value)) {
		return value.map(convertKeysToSnakeCaseInternal);
	}

	if (isPlainObject(value)) {
		const record = value as Record<string, unknown>;
		return mapValues(
			mapKeys(record, (_, key) => snakeCase(key)),
			convertKeysToSnakeCaseInternal,
		);
	}

	return value;
}

function convertKeysToSnakeCase<T>(obj: unknown): T {
	return convertKeysToSnakeCaseInternal(obj) as T;
}

class UserSettingsStore {
	flags: number = 0;
	status: StatusType = StatusTypes.ONLINE;
	statusResetsAt: string | null = null;
	statusResetsTo: string | null = null;
	theme: string = ThemeTypes.SYSTEM;
	timeFormat: number = TimeFormatTypes.AUTO;
	locale: string = 'en-US';
	restrictedGuilds: Array<string> = [];
	botRestrictedGuilds: Array<string> = [];
	defaultGuildsRestricted: boolean = false;
	botDefaultGuildsRestricted: boolean = false;
	inlineAttachmentMedia: boolean = true;
	inlineEmbedMedia: boolean = true;
	gifAutoPlay: boolean = true;
	renderEmbeds: boolean = true;
	renderReactions: boolean = true;
	animateEmoji: boolean = true;
	animateStickers: number = StickerAnimationOptions.ALWAYS_ANIMATE;
	renderSpoilers: number = RenderSpoilers.ON_CLICK;
	messageDisplayCompact: boolean = false;
	developerMode: boolean = false;
	friendSourceFlags: number = 0;
	incomingCallFlags: number = 0;
	groupDmAddPermissionFlags: number = 0;
	guildFolders: Array<GuildFolder> = [];
	customStatus: CustomStatus | null = null;
	afkTimeout: number = 600;
	trustedDomains: Array<string> = [];
	defaultHideMutedChannels: boolean = false;
	private hydrated = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	getFlags(): number {
		return this.flags;
	}

	getStatus(): StatusType {
		return this.status;
	}

	getStatusResetsAt(): string | null {
		return this.statusResetsAt;
	}

	getStatusResetsTo(): string | null {
		return this.statusResetsTo;
	}

	getTimeFormat(): number {
		return this.timeFormat;
	}

	getGuildPositions(): ReadonlyArray<string> {
		return this.guildFolders.flatMap((folder) => folder.guildIds);
	}

	getLocale(): string {
		return this.locale;
	}

	getRestrictedGuilds(): ReadonlyArray<string> {
		return this.restrictedGuilds;
	}

	getBotRestrictedGuilds(): ReadonlyArray<string> {
		return this.botRestrictedGuilds;
	}

	getBotDefaultGuildsRestricted(): boolean {
		return this.botDefaultGuildsRestricted;
	}

	getDefaultGuildsRestricted(): boolean {
		return this.defaultGuildsRestricted;
	}

	getInlineAttachmentMedia(): boolean {
		return this.inlineAttachmentMedia;
	}

	getInlineEmbedMedia(): boolean {
		return this.inlineEmbedMedia;
	}

	getGifAutoPlay(): boolean {
		if (MobileLayoutStore.isMobileLayout()) {
			if (!AccessibilityStore.mobileGifAutoPlayOverridden) {
				return false;
			}
			return AccessibilityStore.mobileGifAutoPlayValue;
		}
		return this.gifAutoPlay;
	}

	getRenderEmbeds(): boolean {
		return this.renderEmbeds;
	}

	getRenderReactions(): boolean {
		return this.renderReactions;
	}

	getAnimateEmoji(): boolean {
		if (MobileLayoutStore.isMobileLayout()) {
			if (AccessibilityStore.mobileAnimateEmojiOverridden) {
				return AccessibilityStore.mobileAnimateEmojiValue;
			}
		}
		return this.animateEmoji;
	}

	getAnimateStickers(): number {
		if (MobileLayoutStore.isMobileLayout()) {
			if (!AccessibilityStore.mobileStickerAnimationOverridden) {
				return StickerAnimationOptions.ANIMATE_ON_INTERACTION;
			}
			return AccessibilityStore.mobileStickerAnimationValue;
		}
		return this.animateStickers;
	}

	getRenderSpoilers(): number {
		return this.renderSpoilers;
	}

	getMessageDisplayCompact(): boolean {
		if (MobileLayoutStore.isMobileLayout()) {
			return false;
		}
		return this.messageDisplayCompact;
	}

	getFriendSourceFlags(): number {
		return this.friendSourceFlags;
	}

	getIncomingCallFlags(): number {
		return this.incomingCallFlags;
	}

	getGroupDmAddPermissionFlags(): number {
		return this.groupDmAddPermissionFlags;
	}

	getGuildFolders(): ReadonlyArray<GuildFolder> {
		return this.guildFolders;
	}

	getCustomStatus(): CustomStatus | null {
		return this.customStatus;
	}

	getAfkTimeout(): number {
		return this.afkTimeout;
	}

	getDeveloperMode(): boolean {
		return this.developerMode;
	}

	getTrustedDomains(): ReadonlyArray<string> {
		return this.trustedDomains;
	}

	trustAllDomains(): boolean {
		return this.trustedDomains.includes('*');
	}

	getDefaultHideMutedChannels(): boolean {
		return this.defaultHideMutedChannels;
	}

	isHydrated(): boolean {
		return this.hydrated;
	}

	@action
	setStatus(status: StatusType): void {
		this.status = status;
		LocalPresenceStore.updatePresence();
	}

	handleConnectionOpen(userSettings: unknown): void {
		this.updateUserSettings(userSettings);
	}

	updateUserSettings(userSettings: unknown, options: {hydrate?: boolean} = {}): void {
		const {hydrate = true} = options;
		const previousStatus = this.status;
		const previousMessageDisplayCompact = this.messageDisplayCompact;
		const previousCustomStatus = this.customStatus;

		if (userSettings === null || userSettings === undefined) {
			return;
		}

		const camelCaseSettings = convertKeysToCamelCase<UserSettings>(userSettings);
		if (hydrate) {
			this.hydrated = true;
		}

		this.flags = camelCaseSettings.flags;
		const normalizedStatus = normalizeStatus(camelCaseSettings.status);
		this.status = normalizedStatus;
		this.statusResetsAt = camelCaseSettings.statusResetsAt ?? null;
		this.statusResetsTo = camelCaseSettings.statusResetsTo ?? null;
		if (camelCaseSettings.theme) {
			this.theme = camelCaseSettings.theme;
			ThemeStore.updateServerTheme(camelCaseSettings.theme);
		}
		this.timeFormat = camelCaseSettings.timeFormat;
		const localeToLoad = camelCaseSettings.locale ?? this.locale;
		const normalizedLocale = loadLocaleCatalog(localeToLoad);
		this.locale = normalizedLocale;
		this.restrictedGuilds = [...camelCaseSettings.restrictedGuilds];
		this.botRestrictedGuilds = [...camelCaseSettings.botRestrictedGuilds];
		this.defaultGuildsRestricted = camelCaseSettings.defaultGuildsRestricted;
		this.botDefaultGuildsRestricted = camelCaseSettings.botDefaultGuildsRestricted;
		this.inlineAttachmentMedia = camelCaseSettings.inlineAttachmentMedia;
		this.inlineEmbedMedia = camelCaseSettings.inlineEmbedMedia;
		this.gifAutoPlay = camelCaseSettings.gifAutoPlay;
		this.renderEmbeds = camelCaseSettings.renderEmbeds;
		this.renderReactions = camelCaseSettings.renderReactions;
		this.animateEmoji = camelCaseSettings.animateEmoji;
		this.animateStickers = camelCaseSettings.animateStickers;
		this.renderSpoilers = camelCaseSettings.renderSpoilers;
		this.messageDisplayCompact = camelCaseSettings.messageDisplayCompact;

		if (camelCaseSettings.messageDisplayCompact !== previousMessageDisplayCompact) {
			const currentDefault = previousMessageDisplayCompact ? 0 : 16;
			const shouldAutoAdjust = AccessibilityStore.messageGroupSpacing === currentDefault;

			if (shouldAutoAdjust) {
				const newDefault = camelCaseSettings.messageDisplayCompact ? 0 : 16;
				AccessibilityStore.updateSettings({messageGroupSpacing: newDefault});
			}
		}

		this.developerMode = camelCaseSettings.developerMode;
		this.friendSourceFlags = camelCaseSettings.friendSourceFlags;
		this.incomingCallFlags = camelCaseSettings.incomingCallFlags;
		this.groupDmAddPermissionFlags = camelCaseSettings.groupDmAddPermissionFlags;
		this.guildFolders = camelCaseSettings.guildFolders.map((folder) => ({
			...folder,
			flags: folder.flags ?? 0,
			icon: folder.icon ?? DEFAULT_GUILD_FOLDER_ICON,
			guildIds: [...folder.guildIds],
		}));
		const newCustomStatus = normalizeCustomStatus(camelCaseSettings.customStatus ?? null);
		this.customStatus = newCustomStatus ? {...newCustomStatus} : null;
		this.afkTimeout = camelCaseSettings.afkTimeout;
		if (camelCaseSettings.trustedDomains !== undefined) {
			this.trustedDomains = [...camelCaseSettings.trustedDomains];
		}
		if (camelCaseSettings.defaultHideMutedChannels !== undefined) {
			this.defaultHideMutedChannels = camelCaseSettings.defaultHideMutedChannels;
		}

		if (normalizedStatus !== previousStatus) {
			const presence = LocalPresenceStore.getPresence();
			if (!presence.afk) {
				LocalPresenceStore.updatePresence();
			}
		}

		if (!isEqual(this.customStatus, previousCustomStatus)) {
			LocalPresenceStore.updatePresence();
		}

		AccessibilityOverrideStore.updateUserSettings(userSettings);
	}

	private get snapshot(): UserSettings {
		return {
			flags: this.flags,
			status: this.status,
			statusResetsAt: this.statusResetsAt,
			statusResetsTo: this.statusResetsTo,
			theme: this.theme,
			timeFormat: this.timeFormat,
			locale: this.locale,
			restrictedGuilds: [...this.restrictedGuilds],
			botRestrictedGuilds: [...this.botRestrictedGuilds],
			defaultGuildsRestricted: this.defaultGuildsRestricted,
			botDefaultGuildsRestricted: this.botDefaultGuildsRestricted,
			inlineAttachmentMedia: this.inlineAttachmentMedia,
			inlineEmbedMedia: this.inlineEmbedMedia,
			gifAutoPlay: this.gifAutoPlay,
			renderEmbeds: this.renderEmbeds,
			renderReactions: this.renderReactions,
			animateEmoji: this.animateEmoji,
			animateStickers: this.animateStickers,
			renderSpoilers: this.renderSpoilers,
			messageDisplayCompact: this.messageDisplayCompact,
			developerMode: this.developerMode,
			friendSourceFlags: this.friendSourceFlags,
			incomingCallFlags: this.incomingCallFlags,
			groupDmAddPermissionFlags: this.groupDmAddPermissionFlags,
			guildFolders: this.guildFolders.map((folder) => ({
				...folder,
				guildIds: [...folder.guildIds],
			})),
			customStatus: this.customStatus ? {...this.customStatus} : null,
			afkTimeout: this.afkTimeout,
			trustedDomains: [...this.trustedDomains],
			defaultHideMutedChannels: this.defaultHideMutedChannels,
		};
	}

	subscribe(callback: () => void): () => void {
		return reaction(
			() => ({
				inlineAttachmentMedia: this.inlineAttachmentMedia,
				inlineEmbedMedia: this.inlineEmbedMedia,
				gifAutoPlay: this.gifAutoPlay,
				renderEmbeds: this.renderEmbeds,
				renderReactions: this.renderReactions,
				animateEmoji: this.animateEmoji,
				animateStickers: this.animateStickers,
				renderSpoilers: this.renderSpoilers,
				messageDisplayCompact: this.messageDisplayCompact,
			}),
			() => callback(),
			{fireImmediately: true},
		);
	}

	async saveSettings(settings: Partial<UserSettings>): Promise<void> {
		const previousSnapshot = this.snapshot;
		const sanitizedSettings = {...settings};
		if ('customStatus' in sanitizedSettings) {
			sanitizedSettings.customStatus = normalizeCustomStatus(sanitizedSettings.customStatus ?? null);
		}
		const mergedSnapshot = {...previousSnapshot, ...sanitizedSettings};
		const mergedSnakeCase = convertKeysToSnakeCase(mergedSnapshot);
		runInAction(() => {
			this.updateUserSettings(mergedSnakeCase, {hydrate: false});
		});

		try {
			logger.debug('Updating user settings');
			const payload = convertKeysToSnakeCase(sanitizedSettings);
			await http.patch({url: Endpoints.USER_SETTINGS, body: payload});
			logger.debug('Successfully updated user settings');
		} catch (error) {
			logger.error('Failed to update user settings:', error);
			runInAction(() => {
				this.updateUserSettings(convertKeysToSnakeCase(previousSnapshot), {hydrate: false});
			});
			throw error;
		}
	}
}

export default new UserSettingsStore();
