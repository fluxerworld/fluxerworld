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

import {shouldShowHdrSettings} from '@app/components/modals/tabs/appearance_tab/HdrTab';
import {shouldShowAppZoomLevel} from '@app/components/modals/utils/AppZoomLevelUtils';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export type UserSettingsTabType =
	| 'my_profile'
	| 'account_security'
	| 'plutonium'
	| 'gift_inventory'
	| 'privacy_safety'
	| 'authorized_apps'
	| 'blocked_users'
	| 'devices'
	| 'appearance'
	| 'accessibility'
	| 'chat_settings'
	| 'voice_video'
	| 'notifications'
	| 'advanced'
	| 'applications'
	| 'developer_options'
	| 'component_gallery'
	| 'language'
	| 'keybinds'
	| 'expression_packs'
	| 'limits_config'
	| 'linked_accounts';

export interface SectionDefinition {
	id: string;
	tabType: UserSettingsTabType;
	label: MessageDescriptor;
	description?: MessageDescriptor;
	keywords: Array<MessageDescriptor>;
	isAdvanced: boolean;
	isVisible?: () => boolean;
}

export interface SettingsSectionConfig {
	id: string;
	label: string;
	isAdvanced: boolean;
}

export interface SearchableSettingItem {
	id: string;
	tabType: UserSettingsTabType;
	sectionId?: string;
	label: string;
	keywords: Array<string>;
	description?: string;
}

const SECTION_REGISTRY: Array<SectionDefinition> = [
	{
		id: 'theme',
		tabType: 'appearance',
		label: msg`Theme`,
		description: msg`Choose between dark, coal, or light appearance. You can still add custom CSS overrides below for limitless control.`,
		keywords: [
			msg`theme`,
			msg`dark mode`,
			msg`light mode`,
			msg`dark`,
			msg`light`,
			msg`coal`,
			msg`color scheme`,
			msg`system theme`,
			msg`sync`,
			msg`sync theme`,
			msg`theme sync`,
			msg`devices`,
			msg`css`,
			msg`custom`,
			msg`theme tokens`,
			msg`overrides`,
			msg`colors`,
			msg`fonts`,
			msg`styling`,
		],
		isAdvanced: false,
	},
	{
		id: 'hdr',
		tabType: 'appearance',
		label: msg`High dynamic range`,
		description: msg`Control how HDR images are displayed on HDR-capable monitors.`,
		keywords: [msg`hdr`, msg`high dynamic range`, msg`brightness`, msg`color`, msg`display`, msg`tone`],
		isAdvanced: false,
		isVisible: shouldShowHdrSettings,
	},
	{
		id: 'chat-font-scaling',
		tabType: 'appearance',
		label: msg`Chat font scaling`,
		description: msg`Adjust the font size in the chat area.`,
		keywords: [msg`font`, msg`size`, msg`text size`, msg`zoom`, msg`scale`, msg`chat font`],
		isAdvanced: false,
	},
	{
		id: 'app-zoom-level',
		tabType: 'appearance',
		label: msg`App zoom level`,
		description: msg`Adjust the application's zoom level.`,
		keywords: [msg`zoom`, msg`scale`, msg`app zoom`, msg`interface size`, msg`display scaling`],
		isAdvanced: false,
		isVisible: shouldShowAppZoomLevel,
	},
	{
		id: 'messages',
		tabType: 'appearance',
		label: msg`Messages`,
		description: msg`Choose how messages are displayed in chat channels.`,
		keywords: [
			msg`messages`,
			msg`display`,
			msg`compact`,
			msg`cozy`,
			msg`message style`,
			msg`comfy`,
			msg`dense`,
			msg`message layout`,
			msg`display mode`,
			msg`grouping`,
			msg`spacing`,
			msg`timestamps`,
			msg`time`,
			msg`date`,
			msg`message time`,
			msg`avatars`,
			msg`hide avatars`,
			msg`compact mode`,
			msg`user avatars`,
			msg`profile pictures`,
			msg`message groups`,
			msg`gap`,
			msg`space between`,
			msg`message spacing`,
		],
		isAdvanced: false,
	},
	{
		id: 'interface',
		tabType: 'appearance',
		label: msg`Interface`,
		description: msg`Customize interface elements and behaviors.`,
		keywords: [
			msg`sidebar`,
			msg`channel list`,
			msg`navigation`,
			msg`member list`,
			msg`users`,
			msg`members`,
			msg`typing`,
			msg`typing indicator`,
			msg`typing avatars`,
			msg`indicator`,
			msg`who is typing`,
			msg`keyboard`,
			msg`hints`,
			msg`tooltips`,
			msg`shortcut badges`,
			msg`keyboard shortcuts`,
			msg`voice channel`,
			msg`join`,
			msg`double click`,
			msg`double-click`,
			msg`single click`,
			msg`voice join`,
		],
		isAdvanced: false,
	},
	{
		id: 'channel-list',
		tabType: 'appearance',
		label: msg`Channel list`,
		description: msg`Control unread indicator behavior for muted channels in channel lists.`,
		keywords: [
			msg`channel list`,
			msg`muted channels`,
			msg`muted`,
			msg`unread`,
			msg`unread indicator`,
			msg`faded unread`,
			msg`sidebar`,
			msg`favorites`,
		],
		isAdvanced: false,
	},
	{
		id: 'active-now',
		tabType: 'appearance',
		label: msg`Active Now`,
		description: msg`Control how Active Now surfaces across the app.`,
		keywords: [
			msg`active now`,
			msg`activity`,
			msg`presence`,
			msg`online`,
			msg`voice activity`,
			msg`voice`,
			msg`dm sidebar`,
			msg`direct message`,
			msg`friends`,
			msg`join voice`,
			msg`home screen`,
		],
		isAdvanced: false,
	},
	{
		id: 'favorites',
		tabType: 'appearance',
		label: msg`Favorites`,
		description: msg`Control the visibility of favorites throughout the app.`,
		keywords: [msg`favorites`, msg`favorite channels`, msg`starred`, msg`saved`, msg`quick access`],
		isAdvanced: true,
	},

	{
		id: 'visual',
		tabType: 'accessibility',
		label: msg`Visual`,
		keywords: [
			msg`contrast`,
			msg`high contrast`,
			msg`visibility`,
			msg`accessibility`,
			msg`saturation`,
			msg`color`,
			msg`colors`,
			msg`vibrancy`,
			msg`screen reader`,
			msg`a11y`,
			msg`aria`,
		],
		isAdvanced: false,
	},
	{
		id: 'tts',
		tabType: 'accessibility',
		label: msg`Text-to-speech`,
		keywords: [msg`tts`, msg`text to speech`, msg`speech`, msg`narration`, msg`read aloud`],
		isAdvanced: false,
	},
	{
		id: 'keyboard',
		tabType: 'accessibility',
		label: msg`Keyboard`,
		keywords: [msg`keyboard`, msg`navigation`, msg`shortcuts`, msg`focus`, msg`tab`],
		isAdvanced: false,
	},
	{
		id: 'animation',
		tabType: 'accessibility',
		label: msg`Animation`,
		keywords: [
			msg`stickers`,
			msg`animation`,
			msg`animated stickers`,
			msg`gif`,
			msg`emoji`,
			msg`animated emoji`,
			msg`autoplay`,
			msg`auto play`,
		],
		isAdvanced: false,
	},
	{
		id: 'motion',
		tabType: 'accessibility',
		label: msg`Motion`,
		keywords: [msg`motion`, msg`animation`, msg`reduced motion`, msg`accessibility`, msg`animations`],
		isAdvanced: true,
	},

	{
		id: 'display',
		tabType: 'chat_settings',
		label: msg`Display`,
		keywords: [msg`reactions`, msg`emoji`, msg`react`, msg`spoilers`, msg`spoiler`, msg`hide`, msg`reveal`],
		isAdvanced: false,
	},
	{
		id: 'media',
		tabType: 'chat_settings',
		label: msg`Media`,
		keywords: [
			msg`embeds`,
			msg`previews`,
			msg`links`,
			msg`url preview`,
			msg`link preview`,
			msg`media`,
			msg`images`,
			msg`videos`,
			msg`attachments`,
			msg`inline`,
		],
		isAdvanced: false,
	},
	{
		id: 'input',
		tabType: 'chat_settings',
		label: msg`Input`,
		keywords: [
			msg`autocomplete`,
			msg`suggestions`,
			msg`emoji picker`,
			msg`mentions`,
			msg`sticker`,
			msg`stickers`,
			msg`expressions`,
		],
		isAdvanced: false,
	},
	{
		id: 'interaction',
		tabType: 'chat_settings',
		label: msg`Interaction`,
		keywords: [msg`typing`, msg`indicator`, msg`typing status`],
		isAdvanced: true,
	},
	{
		id: 'links',
		tabType: 'chat_settings',
		label: msg`External Links`,
		description: msg`Configure how external link warnings are handled.`,
		keywords: [
			msg`links`,
			msg`external links`,
			msg`link warnings`,
			msg`url warnings`,
			msg`external urls`,
			msg`link safety`,
			msg`warning prompts`,
		],
		isAdvanced: false,
	},
	{
		id: 'sidebar',
		tabType: 'chat_settings',
		label: msg`Sidebar`,
		description: msg`Configure how the guild sidebar is displayed.`,
		keywords: [
			msg`sidebar`,
			msg`guild sidebar`,
			msg`server sidebar`,
			msg`channel list`,
			msg`navigation`,
			msg`sidebar display`,
		],
		isAdvanced: false,
	},

	{
		id: 'audio',
		tabType: 'voice_video',
		label: msg`Audio`,
		keywords: [
			msg`microphone`,
			msg`mic`,
			msg`input`,
			msg`audio input`,
			msg`device`,
			msg`speaker`,
			msg`output`,
			msg`audio output`,
			msg`headphones`,
			msg`volume`,
			msg`loudness`,
			msg`audio level`,
			msg`push to talk`,
			msg`ptt`,
			msg`voice activation`,
			msg`keybind`,
			msg`noise`,
			msg`suppression`,
			msg`echo`,
			msg`background noise`,
			msg`krisp`,
			msg`cancellation`,
		],
		isAdvanced: false,
	},
	{
		id: 'video',
		tabType: 'voice_video',
		label: msg`Video`,
		keywords: [
			msg`camera`,
			msg`webcam`,
			msg`video`,
			msg`video input`,
			msg`preview`,
			msg`video preview`,
			msg`camera preview`,
			msg`stream preview`,
			msg`screen share preview`,
			msg`screen sharing`,
			msg`streaming`,
		],
		isAdvanced: false,
	},
	{
		id: 'connections',
		tabType: 'privacy_safety',
		label: msg`Connections`,
		keywords: [msg`activity`, msg`status`, msg`online status`, msg`presence`, msg`invisible`],
		isAdvanced: false,
	},
	{
		id: 'communication',
		tabType: 'privacy_safety',
		label: msg`Communication`,
		keywords: [
			msg`dm`,
			msg`direct message`,
			msg`privacy`,
			msg`who can dm`,
			msg`friends`,
			msg`requests`,
			msg`friend requests`,
			msg`incoming calls`,
			msg`who can call`,
			msg`call permissions`,
			msg`block calls`,
			msg`friends only calls`,
			msg`call privacy`,
			msg`silent`,
			msg`silent calls`,
			msg`ring behavior`,
			msg`mute calls`,
			msg`no ring`,
			msg`group chat`,
			msg`group dm`,
			msg`add to group`,
			msg`who can add`,
			msg`group permissions`,
			msg`group privacy`,
			msg`friends of friends`,
			msg`mutual friends`,
			msg`extended network`,
			msg`community`,
			msg`guild members`,
			msg`server members`,
			msg`community members`,
		],
		isAdvanced: false,
	},
	{
		id: 'data-export',
		tabType: 'privacy_safety',
		label: msg`Data Export`,
		keywords: [msg`export`, msg`data`, msg`download`, msg`gdpr`],
		isAdvanced: true,
	},
	{
		id: 'data-deletion',
		tabType: 'privacy_safety',
		label: msg`Data Deletion`,
		keywords: [msg`delete`, msg`data`, msg`privacy`, msg`gdpr`, msg`remove`],
		isAdvanced: true,
	},

	{
		id: 'account',
		tabType: 'account_security',
		label: msg`Account`,
		keywords: [
			msg`email`,
			msg`mail`,
			msg`address`,
			msg`contact`,
			msg`phone`,
			msg`number`,
			msg`mobile`,
			msg`telephone`,
			msg`sms`,
		],
		isAdvanced: false,
	},
	{
		id: 'security',
		tabType: 'account_security',
		label: msg`Security`,
		keywords: [
			msg`password`,
			msg`credentials`,
			msg`login`,
			msg`security`,
			msg`change password`,
			msg`2fa`,
			msg`two factor`,
			msg`mfa`,
			msg`authentication`,
			msg`authenticator`,
			msg`totp`,
			msg`otp`,
			msg`backup codes`,
			msg`recovery`,
			msg`codes`,
			msg`2fa backup`,
		],
		isAdvanced: false,
	},
	{
		id: 'danger_zone',
		tabType: 'account_security',
		label: msg`Danger Zone`,
		keywords: [msg`delete`, msg`remove`, msg`close account`, msg`deactivate`, msg`disable`, msg`suspend`],
		isAdvanced: false,
	},

	{
		id: 'notifications',
		tabType: 'notifications',
		label: msg`Notifications`,
		keywords: [
			msg`notifications`,
			msg`desktop`,
			msg`alerts`,
			msg`popup`,
			msg`toast`,
			msg`mentions`,
			msg`ping`,
			msg`@`,
			msg`notify`,
			msg`dm`,
			msg`direct message`,
			msg`private message`,
		],
		isAdvanced: false,
	},
	{
		id: 'sounds',
		tabType: 'notifications',
		label: msg`Sounds`,
		keywords: [
			msg`sounds`,
			msg`audio`,
			msg`notification sound`,
			msg`alert sound`,
			msg`mute`,
			msg`message sound`,
			msg`sound effect`,
			msg`new message`,
			msg`call`,
			msg`ring`,
			msg`ringtone`,
			msg`incoming call`,
			msg`disable sounds`,
			msg`mute all`,
			msg`silence`,
			msg`quiet`,
			msg`mute notifications`,
			msg`custom sounds`,
			msg`upload sound`,
			msg`custom notification`,
			msg`custom ringtone`,
			msg`mp3`,
			msg`wav`,
			msg`plutonium`,
		],
		isAdvanced: false,
	},
	{
		id: 'text-to-speech',
		tabType: 'notifications',
		label: msg`Text-to-speech`,
		keywords: [
			msg`tts`,
			msg`text to speech`,
			msg`speech`,
			msg`narration`,
			msg`read aloud`,
			msg`accessibility`,
			msg`/tts`,
			msg`tts command`,
			msg`speech command`,
			msg`playback`,
			msg`auto narration`,
			msg`automatic`,
			msg`speak messages`,
			msg`read messages`,
			msg`narrate`,
		],
		isAdvanced: false,
	},
	{
		id: 'push',
		tabType: 'notifications',
		label: msg`Push Settings`,
		keywords: [msg`push`, msg`mobile`, msg`push notifications`],
		isAdvanced: false,
	},
	{
		id: 'general',
		tabType: 'developer_options',
		label: msg`General`,
		keywords: [msg`developer`, msg`debug`, msg`tools`, msg`dev tools`, msg`testing`],
		isAdvanced: false,
	},
	{
		id: 'account_premium',
		tabType: 'developer_options',
		label: msg`Account & Premium`,
		keywords: [msg`account`, msg`premium`, msg`plutonium`, msg`subscription`],
		isAdvanced: false,
	},
	{
		id: 'mocking',
		tabType: 'developer_options',
		label: msg`Mocking`,
		keywords: [msg`mock`, msg`mocking`, msg`fake`, msg`simulate`],
		isAdvanced: false,
	},
	{
		id: 'nagbars',
		tabType: 'developer_options',
		label: msg`Nagbars`,
		keywords: [msg`nagbar`, msg`nagbars`, msg`banner`, msg`notification bar`],
		isAdvanced: false,
	},
	{
		id: 'tools',
		tabType: 'developer_options',
		label: msg`Tools`,
		keywords: [msg`tools`, msg`utilities`, msg`debug tools`],
		isAdvanced: false,
	},
	{
		id: 'typography',
		tabType: 'developer_options',
		label: msg`Typography`,
		keywords: [msg`typography`, msg`fonts`, msg`text styles`],
		isAdvanced: false,
	},

	{
		id: 'buttons',
		tabType: 'component_gallery',
		label: msg`Buttons`,
		keywords: [msg`buttons`, msg`button`, msg`click`, msg`action`],
		isAdvanced: false,
	},
	{
		id: 'inputs',
		tabType: 'component_gallery',
		label: msg`Inputs & Text`,
		keywords: [msg`inputs`, msg`text`, msg`input field`, msg`text field`, msg`form`],
		isAdvanced: false,
	},
	{
		id: 'selections',
		tabType: 'component_gallery',
		label: msg`Selections`,
		keywords: [msg`selections`, msg`select`, msg`dropdown`, msg`checkbox`, msg`radio`, msg`switch`, msg`toggle`],
		isAdvanced: false,
	},
	{
		id: 'overlays',
		tabType: 'component_gallery',
		label: msg`Overlays & Menus`,
		keywords: [msg`overlays`, msg`menus`, msg`modal`, msg`popup`, msg`context menu`, msg`dropdown menu`],
		isAdvanced: false,
	},
	{
		id: 'indicators',
		tabType: 'component_gallery',
		label: msg`Indicators & Status`,
		keywords: [msg`indicators`, msg`status`, msg`loading`, msg`spinner`, msg`progress`, msg`badge`],
		isAdvanced: false,
	},
	{
		id: 'status',
		tabType: 'component_gallery',
		label: msg`Status Slate`,
		keywords: [msg`status slate`, msg`empty state`, msg`error state`, msg`placeholder`],
		isAdvanced: false,
	},
	{
		id: 'markdown',
		tabType: 'component_gallery',
		label: msg`Markdown`,
		keywords: [msg`markdown`, msg`formatting`, msg`rich text`, msg`md`],
		isAdvanced: false,
	},
	{
		id: 'messages',
		tabType: 'component_gallery',
		label: msg`Messages`,
		keywords: [msg`messages`, msg`chat`, msg`message component`, msg`message display`],
		isAdvanced: false,
	},
];

export function getSectionsForTab(tabType: UserSettingsTabType, i18n: I18n): Array<SettingsSectionConfig> {
	return SECTION_REGISTRY.filter((section) => {
		if (section.tabType !== tabType) return false;
		if (section.isVisible && !section.isVisible()) return false;
		return true;
	}).map((section) => ({
		id: section.id,
		label: i18n._(section.label),
		isAdvanced: section.isAdvanced,
	}));
}

export function getSectionIdsForTab(tabType: UserSettingsTabType): Array<string> {
	return SECTION_REGISTRY.filter((section) => {
		if (section.tabType !== tabType) return false;
		if (section.isVisible && !section.isVisible()) return false;
		return true;
	}).map((section) => section.id);
}

export function tabHasSections(tabType: UserSettingsTabType): boolean {
	return SECTION_REGISTRY.some((section) => section.tabType === tabType);
}

export function getAllSectionDefinitions(): Array<SectionDefinition> {
	return SECTION_REGISTRY;
}

export function getSectionDefinition(sectionId: string): SectionDefinition | undefined {
	return SECTION_REGISTRY.find((section) => section.id === sectionId);
}

export function getVisibleSectionsForTab(tabType: UserSettingsTabType): Array<SectionDefinition> {
	return SECTION_REGISTRY.filter((section) => {
		if (section.tabType !== tabType) return false;
		if (section.isVisible && !section.isVisible()) return false;
		return true;
	});
}

export function isSectionIdValid(sectionId: string, tabType?: UserSettingsTabType): boolean {
	return SECTION_REGISTRY.some((section) => {
		if (section.id !== sectionId) return false;
		if (tabType && section.tabType !== tabType) return false;
		return true;
	});
}

export function getSearchableItemsFromRegistry(
	i18n: I18n,
	allowedTabTypes?: Set<UserSettingsTabType>,
): Array<SearchableSettingItem> {
	return SECTION_REGISTRY.filter((section) => {
		if (allowedTabTypes && !allowedTabTypes.has(section.tabType)) return false;
		if (section.isVisible && !section.isVisible()) return false;
		return true;
	}).map((section) => ({
		id: `section-${section.id}`,
		tabType: section.tabType,
		sectionId: section.id,
		label: i18n._(section.label),
		keywords: section.keywords.map((k) => i18n._(k)),
		description: section.description ? i18n._(section.description) : undefined,
	}));
}
