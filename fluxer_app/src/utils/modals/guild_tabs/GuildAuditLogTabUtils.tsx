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

import {AuditLogActionKind, AuditLogTargetType} from '@app/components/modals/guild_tabs/GuildAuditLogTab.Constants';
import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import {getFormattedDateTime} from '@app/utils/DateUtils';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	GuildFeatures,
	GuildOperations,
	GuildSplashCardAlignment,
	SystemChannelFlags,
} from '@fluxer/constants/src/GuildConstants';
import {SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE} from '@fluxer/date_utils/src/DateConstants';
import type {AuditLogChange} from '@fluxer/schema/src/domains/guild/GuildAuditLogSchemas';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export interface BasicRecord {
	[key: string]: unknown;
}

export interface ChangeShapeWithUnknowns {
	key: string;
	oldValue: unknown;
	newValue: unknown;
}

export function isBasicRecord(value: unknown): value is BasicRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toChangeShape(raw: AuditLogChange): ChangeShapeWithUnknowns {
	const key = typeof raw.key === 'string' ? raw.key : '';
	const oldValue = 'oldValue' in raw ? raw.oldValue : raw.old_value;
	const newValue = 'newValue' in raw ? raw.newValue : raw.new_value;

	return {key, oldValue: oldValue ?? null, newValue: newValue ?? null};
}

export function safeScalarString(value: unknown, i18n: I18n): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? i18n._(msg({message: 'On'})) : i18n._(msg({message: 'Off'}));
	return null;
}

export function looksLikeSnowflake(s: string): boolean {
	return /^\d{16,22}$/.test(s);
}

export function isEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length === 0;
}

export function resolveIdToName(id: string, guildId: string): string | null {
	const user = UserStore.getUser(id);
	if (user) return user.displayName ?? user.username;

	const channel = ChannelStore.getChannel(id);
	if (channel?.name) return channel.name;

	const roles = GuildStore.getGuildRoles(guildId, true);
	const role = roles.find((r) => r.id === id);
	if (role) return role.name;

	return null;
}

const targetTypeMap: Partial<Record<AuditLogActionType, AuditLogTargetType>> = {
	[AuditLogActionType.GUILD_UPDATE]: AuditLogTargetType.GUILD,

	[AuditLogActionType.CHANNEL_CREATE]: AuditLogTargetType.CHANNEL,
	[AuditLogActionType.CHANNEL_UPDATE]: AuditLogTargetType.CHANNEL,
	[AuditLogActionType.CHANNEL_DELETE]: AuditLogTargetType.CHANNEL,
	[AuditLogActionType.CHANNEL_OVERWRITE_CREATE]: AuditLogTargetType.CHANNEL,
	[AuditLogActionType.CHANNEL_OVERWRITE_UPDATE]: AuditLogTargetType.CHANNEL,
	[AuditLogActionType.CHANNEL_OVERWRITE_DELETE]: AuditLogTargetType.CHANNEL,

	[AuditLogActionType.MEMBER_KICK]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_PRUNE]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_BAN_ADD]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_BAN_REMOVE]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_UPDATE]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_ROLE_UPDATE]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_MOVE]: AuditLogTargetType.USER,
	[AuditLogActionType.MEMBER_DISCONNECT]: AuditLogTargetType.USER,
	[AuditLogActionType.BOT_ADD]: AuditLogTargetType.USER,

	[AuditLogActionType.ROLE_CREATE]: AuditLogTargetType.ROLE,
	[AuditLogActionType.ROLE_UPDATE]: AuditLogTargetType.ROLE,
	[AuditLogActionType.ROLE_DELETE]: AuditLogTargetType.ROLE,

	[AuditLogActionType.INVITE_CREATE]: AuditLogTargetType.INVITE,
	[AuditLogActionType.INVITE_UPDATE]: AuditLogTargetType.INVITE,
	[AuditLogActionType.INVITE_DELETE]: AuditLogTargetType.INVITE,

	[AuditLogActionType.WEBHOOK_CREATE]: AuditLogTargetType.WEBHOOK,
	[AuditLogActionType.WEBHOOK_UPDATE]: AuditLogTargetType.WEBHOOK,
	[AuditLogActionType.WEBHOOK_DELETE]: AuditLogTargetType.WEBHOOK,

	[AuditLogActionType.EMOJI_CREATE]: AuditLogTargetType.EMOJI,
	[AuditLogActionType.EMOJI_UPDATE]: AuditLogTargetType.EMOJI,
	[AuditLogActionType.EMOJI_DELETE]: AuditLogTargetType.EMOJI,

	[AuditLogActionType.STICKER_CREATE]: AuditLogTargetType.STICKER,
	[AuditLogActionType.STICKER_UPDATE]: AuditLogTargetType.STICKER,
	[AuditLogActionType.STICKER_DELETE]: AuditLogTargetType.STICKER,

	[AuditLogActionType.MESSAGE_DELETE]: AuditLogTargetType.MESSAGE,
	[AuditLogActionType.MESSAGE_BULK_DELETE]: AuditLogTargetType.MESSAGE,
	[AuditLogActionType.MESSAGE_PIN]: AuditLogTargetType.MESSAGE,
	[AuditLogActionType.MESSAGE_UNPIN]: AuditLogTargetType.MESSAGE,
};

export function getTargetType(actionType: AuditLogActionType): AuditLogTargetType {
	return targetTypeMap[actionType] ?? AuditLogTargetType.ALL;
}

const suppressedDetailActions = new Set<AuditLogActionType>([
	AuditLogActionType.MEMBER_KICK,
	AuditLogActionType.MEMBER_MOVE,
	AuditLogActionType.MEMBER_DISCONNECT,
	AuditLogActionType.MESSAGE_DELETE,
	AuditLogActionType.MESSAGE_BULK_DELETE,
	AuditLogActionType.MESSAGE_PIN,
	AuditLogActionType.MESSAGE_UNPIN,
	AuditLogActionType.CHANNEL_DELETE,
]);

const NotRenderedChangeKeys: Partial<Record<AuditLogTargetType, Record<string, true>>> = {
	[AuditLogTargetType.GUILD]: {
		guild_id: true,
		banner_width: true,
		banner_height: true,
		splash_width: true,
		splash_height: true,
		embed_splash_width: true,
		embed_splash_height: true,
		member_count: true,
	},
	[AuditLogTargetType.CHANNEL]: {type: true, id: true},
	[AuditLogTargetType.INVITE]: {guild_id: true, channel_id: true, inviter_id: true},
	[AuditLogTargetType.WEBHOOK]: {application_id: true, id: true, guild_id: true, creator_id: true},
	[AuditLogTargetType.USER]: {
		user_id: true,
	},
	[AuditLogTargetType.EMOJI]: {emoji_id: true, creator_id: true},
	[AuditLogTargetType.STICKER]: {sticker_id: true, creator_id: true},
	[AuditLogTargetType.ROLE]: {role_id: true},
};

export function shouldSuppressDetailsForAction(actionType: AuditLogActionType): boolean {
	return suppressedDetailActions.has(actionType);
}

export function shouldHideChangeKey(targetType: AuditLogTargetType, changeKey: string): boolean {
	const target = NotRenderedChangeKeys[targetType];
	return target != null && target[changeKey] === true;
}

const createActions = new Set<AuditLogActionType>([
	AuditLogActionType.CHANNEL_CREATE,
	AuditLogActionType.CHANNEL_OVERWRITE_CREATE,
	AuditLogActionType.ROLE_CREATE,
	AuditLogActionType.INVITE_CREATE,
	AuditLogActionType.WEBHOOK_CREATE,
	AuditLogActionType.EMOJI_CREATE,
	AuditLogActionType.STICKER_CREATE,
	AuditLogActionType.BOT_ADD,
	AuditLogActionType.MEMBER_BAN_ADD,
	AuditLogActionType.MESSAGE_PIN,
]);

const updateActions = new Set<AuditLogActionType>([
	AuditLogActionType.GUILD_UPDATE,
	AuditLogActionType.CHANNEL_UPDATE,
	AuditLogActionType.CHANNEL_OVERWRITE_UPDATE,
	AuditLogActionType.MEMBER_UPDATE,
	AuditLogActionType.MEMBER_ROLE_UPDATE,
	AuditLogActionType.ROLE_UPDATE,
	AuditLogActionType.INVITE_UPDATE,
	AuditLogActionType.WEBHOOK_UPDATE,
	AuditLogActionType.EMOJI_UPDATE,
	AuditLogActionType.STICKER_UPDATE,
	AuditLogActionType.MEMBER_MOVE,
	AuditLogActionType.MEMBER_DISCONNECT,
]);

export function getActionKind(actionType: AuditLogActionType): AuditLogActionKind {
	if (createActions.has(actionType)) return AuditLogActionKind.CREATE;
	if (updateActions.has(actionType)) return AuditLogActionKind.UPDATE;
	return AuditLogActionKind.DELETE;
}

export function normalizeChanges(changes?: Array<AuditLogChange> | null): Array<AuditLogChange> {
	return changes ?? [];
}

export function getChannelTypeLabel(value: unknown, i18n: I18n): string | null {
	if (typeof value !== 'number') return null;

	switch (value) {
		case ChannelTypes.GUILD_TEXT:
			return i18n._(msg({message: 'Text channel'}));
		case ChannelTypes.GUILD_VOICE:
			return i18n._(msg({message: 'Voice channel'}));
		case ChannelTypes.GUILD_CATEGORY:
			return i18n._(msg({message: 'Category'}));
		case ChannelTypes.GUILD_LINK:
			return i18n._(msg({message: 'Link channel'}));
		case ChannelTypes.DM:
			return i18n._(msg({message: 'Direct message'}));
		case ChannelTypes.GROUP_DM:
			return i18n._(msg({message: 'Group message'}));
		case ChannelTypes.DM_PERSONAL_NOTES:
			return i18n._(msg({message: 'Personal notes'}));
		default:
			return null;
	}
}

export function getRtcRegionLabel(value: unknown, i18n: I18n): string | null {
	if (value === null || value === undefined) return i18n._(msg({message: 'Automatic'}));
	if (isEmptyString(value)) return i18n._(msg({message: 'Automatic'}));
	if (typeof value === 'string') return value;
	return null;
}

export function getSplashAlignmentLabel(value: unknown, i18n: I18n): string | null {
	if (typeof value !== 'number') return null;

	switch (value) {
		case GuildSplashCardAlignment.CENTER:
			return i18n._(msg({message: 'Centered'}));
		case GuildSplashCardAlignment.LEFT:
			return i18n._(msg({message: 'Left aligned'}));
		case GuildSplashCardAlignment.RIGHT:
			return i18n._(msg({message: 'Right aligned'}));
		default:
			return null;
	}
}

const featureLabelMap: Record<string, MessageDescriptor> = {
	[GuildFeatures.ANIMATED_ICON]: msg({message: 'Animated icon'}),
	[GuildFeatures.ANIMATED_BANNER]: msg({message: 'Animated banner'}),
	[GuildFeatures.BANNER]: msg({message: 'Banner'}),
	[GuildFeatures.DETACHED_BANNER]: msg({message: 'Detached banner'}),
	[GuildFeatures.INVITE_SPLASH]: msg({message: 'Invite splash'}),
	[GuildFeatures.INVITES_DISABLED]: msg({message: 'Invites disabled'}),
	[GuildFeatures.TEXT_CHANNEL_FLEXIBLE_NAMES]: msg({message: 'Flexible text channel names'}),
	[GuildFeatures.MORE_EMOJI]: msg({message: 'More emoji slots'}),
	[GuildFeatures.MORE_STICKERS]: msg({message: 'More sticker slots'}),
	[GuildFeatures.UNLIMITED_EMOJI]: msg({message: 'Unlimited emoji'}),
	[GuildFeatures.UNLIMITED_STICKERS]: msg({message: 'Unlimited stickers'}),
	[GuildFeatures.EXPRESSION_PURGE_ALLOWED]: msg({message: 'Expression purge'}),
	[GuildFeatures.VANITY_URL]: msg({message: 'Vanity URL'}),
	[GuildFeatures.VERIFIED]: msg({message: 'Verified guild'}),
	[GuildFeatures.VIP_VOICE]: msg({message: 'VIP voice'}),
	[GuildFeatures.UNAVAILABLE_FOR_EVERYONE]: msg({message: 'Unavailable for everyone'}),
	[GuildFeatures.UNAVAILABLE_FOR_EVERYONE_BUT_STAFF]: msg({message: 'Unavailable for everyone but staff'}),
	[GuildFeatures.VISIONARY]: msg({message: 'Visionary'}),
	[GuildFeatures.OPERATOR]: msg({message: 'Operator'}),
};

const normalizeFeatureList = (value: unknown): Array<string> =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function getFeatureDiff(oldValue: unknown, newValue: unknown): {added: Array<string>; removed: Array<string>} {
	const oldFeatures = new Set(normalizeFeatureList(oldValue));
	const newFeatures = normalizeFeatureList(newValue);
	const added = newFeatures.filter((feature) => !oldFeatures.has(feature));
	const removed = normalizeFeatureList(oldValue).filter((feature) => !newFeatures.includes(feature));
	return {added, removed};
}

export function getFeatureLabel(feature: string, i18n: I18n): string | null {
	const msg = featureLabelMap[feature];
	return msg ? i18n._(msg) : null;
}

interface FlagLabel {
	flag: number;
	label: MessageDescriptor;
}

const operationFlagLabels: Array<FlagLabel> = [
	{flag: GuildOperations.PUSH_NOTIFICATIONS, label: msg({message: 'Push notifications'})},
	{flag: GuildOperations.EVERYONE_MENTIONS, label: msg({message: '@everyone mentions'})},
	{flag: GuildOperations.TYPING_EVENTS, label: msg({message: 'Typing events'})},
	{flag: GuildOperations.INSTANT_INVITES, label: msg({message: 'Instant invites'})},
	{flag: GuildOperations.SEND_MESSAGE, label: msg({message: 'Send messages'})},
	{flag: GuildOperations.REACTIONS, label: msg({message: 'Reactions'})},
	{flag: GuildOperations.MEMBER_LIST_UPDATES, label: msg({message: 'Member list updates'})},
];

const systemChannelFlagLabels: Array<FlagLabel> = [
	{flag: SystemChannelFlags.SUPPRESS_JOIN_NOTIFICATIONS, label: msg({message: 'Join notifications'})},
];

const getFlagLabels = (value: unknown, labels: Array<FlagLabel>, i18n: I18n): Array<string> => {
	const mask = typeof value === 'number' ? value : Number(value ?? 0);
	if (Number.isNaN(mask)) return [];
	return labels.filter(({flag}) => (mask & flag) !== 0).map(({label}) => i18n._(label));
};

export function getOperationDiff(
	oldValue: unknown,
	newValue: unknown,
	i18n: I18n,
): {added: Array<string>; removed: Array<string>} {
	const oldLabels = new Set(getFlagLabels(oldValue, operationFlagLabels, i18n));
	const newLabels = getFlagLabels(newValue, operationFlagLabels, i18n);
	const added = newLabels.filter((label) => !oldLabels.has(label));
	const removed = getFlagLabels(oldValue, operationFlagLabels, i18n).filter((label) => !newLabels.includes(label));
	return {added, removed};
}

export function getSystemChannelFlagDiff(
	oldValue: unknown,
	newValue: unknown,
	i18n: I18n,
): {added: Array<string>; removed: Array<string>} {
	const oldLabels = new Set(getFlagLabels(oldValue, systemChannelFlagLabels, i18n));
	const newLabels = getFlagLabels(newValue, systemChannelFlagLabels, i18n);
	const added = newLabels.filter((label) => !oldLabels.has(label));
	const removed = getFlagLabels(oldValue, systemChannelFlagLabels, i18n).filter((label) => !newLabels.includes(label));
	return {added, removed};
}

const formatDateValue = (raw: unknown): string | null => {
	const timestamp =
		typeof raw === 'string' ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : Number(raw ?? NaN);
	if (Number.isNaN(timestamp)) return null;
	return getFormattedDateTime(timestamp);
};

export function formatDateStringValue(value: unknown): string | null {
	return formatDateValue(value);
}

export function formatAccentColor(value: unknown): string | null {
	const numberValue = typeof value === 'number' ? value : Number(value ?? NaN);
	if (Number.isNaN(numberValue)) return null;
	const hex = numberValue.toString(16).padStart(6, '0').toUpperCase();
	return `#${hex}`;
}

const ALL_PERMISSION_FLAGS: Array<bigint> = Object.values(Permissions);

const toBigIntSafe = (value: unknown): bigint | null => {
	if (typeof value === 'bigint') return value;
	if (typeof value === 'number') return BigInt(value);
	if (typeof value === 'string') {
		try {
			return BigInt(value);
		} catch {
			return null;
		}
	}
	return null;
};

export interface PermissionDiff {
	added: Array<bigint>;
	removed: Array<bigint>;
}

export function getPermissionDiff(oldValue: unknown, newValue: unknown): PermissionDiff {
	const oldPerms = toBigIntSafe(oldValue) ?? 0n;
	const newPerms = toBigIntSafe(newValue) ?? 0n;

	const added: Array<bigint> = [];
	const removed: Array<bigint> = [];

	for (const flag of ALL_PERMISSION_FLAGS) {
		const wasSet = (oldPerms & flag) === flag;
		const isSet = (newPerms & flag) === flag;

		if (!wasSet && isSet) {
			added.push(flag);
		} else if (wasSet && !isSet) {
			removed.push(flag);
		}
	}

	return {added, removed};
}

export interface DurationParts {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

export function secondsToDurationParts(totalSeconds: number): DurationParts {
	const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
	const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
	const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const seconds = totalSeconds % 60;
	return {days, hours, minutes, seconds};
}
