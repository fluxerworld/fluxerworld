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

import type {SelectOption} from '@app/components/form/Select';
import {ClickableUser, CopyIdInline} from '@app/components/modals/guild_tabs/GuildAuditLogTab.Components';
import type {AuditLogTargetType} from '@app/components/modals/guild_tabs/GuildAuditLogTab.Constants';
import styles from '@app/components/modals/guild_tabs/GuildAuditLogTab.module.css';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import {getFormattedDateTime} from '@app/utils/DateUtils';
import {
	type ChangeShapeWithUnknowns,
	formatDateStringValue,
	getChannelTypeLabel,
	isBasicRecord,
	isEmptyString,
	looksLikeSnowflake,
	resolveIdToName,
	safeScalarString,
	shouldHideChangeKey,
	toChangeShape,
} from '@app/utils/modals/guild_tabs/GuildAuditLogTabUtils';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {AuditLogChange, GuildAuditLogEntryResponse} from '@fluxer/schema/src/domains/guild/GuildAuditLogSchemas';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans} from '@lingui/react/macro';
import type React from 'react';

export const shouldNotRenderChangeDetail = (targetType: AuditLogTargetType, changeKey: string): boolean =>
	shouldHideChangeKey(targetType, changeKey);

const looksLikeHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s);

const renderEntityInline = (label: string, guildId: string | undefined, i18n: I18n): React.ReactNode => {
	if (!label) return <strong>{i18n._(msg`something`)}</strong>;

	if (looksLikeSnowflake(label) && guildId) {
		const name = resolveIdToName(label, guildId);
		if (name)
			return (
				<CopyIdInline id={label}>
					<strong>{name}</strong>
				</CopyIdInline>
			);
	}

	if (looksLikeSnowflake(label)) return <strong>{i18n._(msg`unknown entity`)}</strong>;
	return <strong>{label}</strong>;
};

const renderActorInline = (
	actorUser: UserRecord | null,
	actorId: string | null | undefined,
	guildId: string | undefined,
	i18n: I18n,
): React.ReactNode => {
	if (actorUser) return <ClickableUser user={actorUser} guildId={guildId} showAvatar={false} />;
	if (actorId) return <strong>{i18n._(msg`Someone`)}</strong>;
	return <strong>{i18n._(msg`Someone`)}</strong>;
};

const renderMemberInline = (
	memberUser: UserRecord | null,
	memberIdOrLabel: string | null | undefined,
	guildId: string | undefined,
	i18n: I18n,
): React.ReactNode => {
	if (memberUser) return <ClickableUser user={memberUser} guildId={guildId} showAvatar={false} />;
	if (memberIdOrLabel) return renderEntityInline(memberIdOrLabel, guildId, i18n);
	return <strong>{i18n._(msg`someone`)}</strong>;
};

const renderBoldValue = (content: React.ReactNode): React.ReactNode => <strong>{content}</strong>;

export const renderValueInline = (value: unknown, guildId: string | undefined, i18n: I18n): React.ReactNode => {
	if (isEmptyString(value)) return renderBoldValue(i18n._(msg`nothing`));

	const scalar = safeScalarString(value, i18n);
	if (scalar !== null) {
		if (typeof value === 'number') return renderBoldValue(scalar);
		if (typeof value === 'boolean') return renderBoldValue(scalar);
		if (typeof value === 'string' && looksLikeSnowflake(value)) {
			if (guildId) {
				const name = resolveIdToName(value, guildId);
				if (name)
					return (
						<CopyIdInline id={value}>
							<strong>{name}</strong>
						</CopyIdInline>
					);
			}

			return (
				<CopyIdInline id={value}>
					<strong>{value}</strong>
				</CopyIdInline>
			);
		}
		if (typeof value === 'string' && looksLikeHexColor(value)) return <strong>{value}</strong>;

		return renderBoldValue(scalar);
	}

	if (Array.isArray(value)) {
		const count = value.length;
		return renderBoldValue(count === 1 ? i18n._(msg`${count} item`) : i18n._(msg`${count} items`));
	}

	if (isBasicRecord(value)) return renderBoldValue(i18n._(msg`details`));

	return renderBoldValue(i18n._(msg`value`));
};

export const shouldShowFallbackChangeDetail = (change: ChangeShapeWithUnknowns): boolean => {
	return change.key.trim().length > 0 && (change.oldValue != null || change.newValue != null);
};

const formatChangeKeyLabel = (key: string): string => key.replace(/_/g, ' ').trim();

export const renderFallbackChangeDetail = (
	change: ChangeShapeWithUnknowns,
	guildId: string | undefined,
	i18n: I18n,
): React.ReactNode => {
	const fieldLabel = formatChangeKeyLabel(change.key);
	const fieldNode = renderValueInline(fieldLabel, guildId, i18n);

	if (change.oldValue != null && change.newValue != null) {
		return (
			<Trans>
				Updated {fieldNode} from {renderValueInline(change.oldValue, guildId, i18n)} to{' '}
				{renderValueInline(change.newValue, guildId, i18n)}.
			</Trans>
		);
	}

	if (change.newValue != null) {
		return (
			<Trans>
				Set {fieldNode} to {renderValueInline(change.newValue, guildId, i18n)}.
			</Trans>
		);
	}

	if (change.oldValue != null) {
		return (
			<Trans>
				Cleared {fieldNode} (was {renderValueInline(change.oldValue, guildId, i18n)}).
			</Trans>
		);
	}

	return <Trans>Updated {fieldNode}.</Trans>;
};

export const renderOptionDetailSentence = (
	key: string,
	value: unknown,
	guildId: string | undefined,
	_actionType: AuditLogActionType | undefined,
	i18n: I18n,
): React.ReactNode => {
	if (key === 'type') {
		const label = getChannelTypeLabel(value, i18n);
		if (label) {
			return <Trans>Channel type: {renderValueInline(label, guildId, i18n)}.</Trans>;
		}
		return <Trans>Channel type: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'channel_id') {
		return <Trans>Channel: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'message_id') {
		return <Trans>Message: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'inviter_id') {
		return <Trans>Invited by {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'vanity_url_code') {
		return <Trans>Vanity URL code: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'uses') {
		const count = typeof value === 'number' ? value : Number(value);
		return count === 1 ? (
			<Trans>Used {renderValueInline(value, guildId, i18n)} time.</Trans>
		) : (
			<Trans>Used {renderValueInline(value, guildId, i18n)} times.</Trans>
		);
	}

	if (key === 'created_at') {
		const formatted = formatDateStringValue(value);
		if (formatted) {
			return <Trans>Created on {renderValueInline(formatted, guildId, i18n)}.</Trans>;
		}
	}

	if (key === 'temporary') {
		return value === true ? (
			<Trans>
				<strong>Grants</strong> temporary membership.
			</Trans>
		) : (
			<Trans>
				<strong>Grants</strong> permanent membership.
			</Trans>
		);
	}

	if (key === 'name') {
		return <Trans>Name: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'count' || key === 'delete_count' || key === 'messages' || key === 'message_count') {
		const count = typeof value === 'number' ? value : Number(value);
		return count === 1 ? (
			<Trans>Deleted {renderValueInline(value, guildId, i18n)} message.</Trans>
		) : (
			<Trans>Deleted {renderValueInline(value, guildId, i18n)} messages.</Trans>
		);
	}

	if (key === 'members_removed' || key === 'members_pruned') {
		const count = typeof value === 'number' ? value : Number(value);
		return count === 1 ? (
			<Trans>Removed {renderValueInline(value, guildId, i18n)} member.</Trans>
		) : (
			<Trans>Removed {renderValueInline(value, guildId, i18n)} members.</Trans>
		);
	}

	if (key === 'channel') {
		return <Trans>Channel: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	if (key === 'max_age') {
		const seconds = typeof value === 'number' ? value : null;
		if (seconds === 0) {
			return <Trans>This invite never expires.</Trans>;
		}
		if (seconds != null) {
			const minutes = seconds / 60;
			const hours = minutes / 60;
			const days = hours / 24;

			if (days >= 1 && days % 1 === 0) {
				return days === 1 ? (
					<Trans>This invite expires in {days} day.</Trans>
				) : (
					<Trans>This invite expires in {days} days.</Trans>
				);
			}
			if (hours >= 1 && hours % 1 === 0) {
				return hours === 1 ? (
					<Trans>This invite expires in {hours} hour.</Trans>
				) : (
					<Trans>This invite expires in {hours} hours.</Trans>
				);
			}
			if (minutes >= 1 && minutes % 1 === 0) {
				return minutes === 1 ? (
					<Trans>This invite expires in {minutes} minute.</Trans>
				) : (
					<Trans>This invite expires in {minutes} minutes.</Trans>
				);
			}
			return seconds === 1 ? (
				<Trans>This invite expires in {seconds} second.</Trans>
			) : (
				<Trans>This invite expires in {seconds} seconds.</Trans>
			);
		}
	}

	if (key === 'delete_member_days') {
		const days = typeof value === 'number' ? value : null;
		if (days != null) {
			return days === 1 ? (
				<Trans>Members inactive for {days} day will be pruned.</Trans>
			) : (
				<Trans>Members inactive for {days} days will be pruned.</Trans>
			);
		}
	}

	if (key === 'role_name') {
		return <Trans>Role: {renderValueInline(value, guildId, i18n)}.</Trans>;
	}

	const fallbackLabel = formatChangeKeyLabel(key);
	return (
		<Trans>
			Value for {renderValueInline(fallbackLabel, guildId, i18n)}: {renderValueInline(value, guildId, i18n)}.
		</Trans>
	);
};

export const findChangeNewNumber = (changes: Array<AuditLogChange> | null | undefined, key: string): number | null => {
	if (!changes) return null;
	for (const raw of changes) {
		const c = toChangeShape(raw);
		if (c.key === key && typeof c.newValue === 'number') return c.newValue;
	}
	return null;
};

export const findChangeNewScalar = (
	changes: Array<AuditLogChange> | null | undefined,
	key: string,
	i18n: I18n,
): string | null => {
	if (!changes) return null;
	for (const raw of changes) {
		const c = toChangeShape(raw);
		if (c.key !== key) continue;
		const s = safeScalarString(c.newValue, i18n);
		if (s != null) return s;
	}
	return null;
};

export const findChangeScalar = (
	changes: Array<AuditLogChange> | null | undefined,
	key: string,
	i18n: I18n,
): string | null => {
	if (!changes) return null;
	for (const raw of changes) {
		const c = toChangeShape(raw);
		if (c.key !== key) continue;
		const newScalar = safeScalarString(c.newValue, i18n);
		if (newScalar != null) return newScalar;
		const oldScalar = safeScalarString(c.oldValue, i18n);
		if (oldScalar != null) return oldScalar;
	}
	return null;
};

const getOptionScalar = (entry: GuildAuditLogEntryResponse, keys: Array<string>, i18n: I18n): string | null => {
	const options: unknown = entry.options;
	if (!isBasicRecord(options)) return null;
	for (const k of keys) {
		const v: unknown = options[k];
		const s = safeScalarString(v, i18n);
		if (s != null) return s;
	}
	return null;
};

const getOptionNumber = (entry: GuildAuditLogEntryResponse, keys: Array<string>, i18n: I18n): number | null => {
	const options: unknown = entry.options;
	if (!isBasicRecord(options)) return null;
	for (const k of keys) {
		const v: unknown = options[k];
		if (typeof v === 'number') return v;
		const s = safeScalarString(v, i18n);
		if (s != null) {
			const n = Number(s);
			if (!Number.isNaN(n)) return n;
		}
	}
	return null;
};

export const resolveTargetLabel = (entry: GuildAuditLogEntryResponse, i18n: I18n): string => {
	if (entry.target_id) return entry.target_id;

	const options: unknown = entry.options;
	if (isBasicRecord(options)) {
		const maybe: unknown =
			options.name ??
			options.title ??
			options.code ??
			options.channel ??
			options.channel_id ??
			options.id ??
			options.target_id ??
			null;

		const scalar = safeScalarString(maybe, i18n);
		if (scalar) return scalar;
	}

	return i18n._(msg`Unknown target`);
};

export const resolveChannelLabel = (
	entry: GuildAuditLogEntryResponse,
	guildId: string | undefined,
	i18n: I18n,
): string | null => {
	const options: unknown = entry.options;
	if (!isBasicRecord(options)) return null;

	const channelValue: unknown = options.channel ?? options.channel_id;
	const channelId = safeScalarString(channelValue, i18n);
	if (!channelId) return null;

	if (guildId && looksLikeSnowflake(channelId)) {
		const channel = ChannelStore.getChannel(channelId);
		if (channel?.name) return channel.name;
	}

	return looksLikeSnowflake(channelId) ? null : channelId;
};

const resolveChannelRecord = (entry: GuildAuditLogEntryResponse, i18n: I18n) => {
	const options: unknown = entry.options;
	if (!isBasicRecord(options)) return null;

	const channelValue: unknown = options.channel ?? options.channel_id;
	const channelId = safeScalarString(channelValue, i18n);
	if (!channelId) return null;

	return ChannelStore.getChannel(channelId) ?? null;
};

export const formatTimestamp = (logId: string): string => {
	const timestamp = SnowflakeUtils.extractTimestamp(logId);
	return getFormattedDateTime(timestamp);
};

export interface AuditLogUserOption extends SelectOption<string> {
	user: UserRecord;
}

export const buildUserOptions = (members: Array<{user: UserRecord}> | undefined): Array<AuditLogUserOption> => {
	if (!members) return [];
	return members
		.slice()
		.sort((a, b) => a.user.username.localeCompare(b.user.username))
		.map((member) => {
			const label = member.user.globalName ?? `${member.user.username}#${member.user.discriminator}`;
			return {value: member.user.id, label, user: member.user};
		});
};

export const renderEntrySummary = (args: {
	entry: GuildAuditLogEntryResponse;
	actorUser: UserRecord | null;
	targetUser: UserRecord | null;
	targetLabel: string;
	channelLabel: string | null;
	guildId: string;
	i18n: I18n;
}): React.ReactNode => {
	const {entry, actorUser, targetUser, targetLabel, channelLabel, guildId, i18n} = args;

	const actor = renderActorInline(actorUser, entry.user_id, guildId, i18n);
	const targetMember = renderMemberInline(targetUser, entry.target_id ?? targetLabel, guildId, i18n);
	const targetEntity = renderEntityInline(targetLabel, guildId, i18n);
	const channelRecord = resolveChannelRecord(entry, i18n);

	const channelDisplayLabel = channelRecord
		? `${channelRecord.type === ChannelTypes.GUILD_TEXT ? '#' : ''}${channelRecord.name ?? i18n._(msg`Unknown channel`)}`
		: (channelLabel ?? null);

	const channelNode = channelDisplayLabel ? <span className={styles.channelPlain}>{channelDisplayLabel}</span> : null;

	const actionType = entry.action_type as AuditLogActionType;

	const changedName =
		findChangeScalar(entry.changes, 'name', i18n) ??
		findChangeScalar(entry.changes, 'nick', i18n) ??
		findChangeScalar(entry.changes, 'code', i18n) ??
		getOptionScalar(entry, ['name', 'title', 'code'], i18n) ??
		null;

	const namedTarget = changedName ? renderEntityInline(changedName, guildId, i18n) : targetEntity;

	const pruneDaysRaw = findChangeNewScalar(entry.changes, 'prune_delete_days', i18n);
	const pruneDays = pruneDaysRaw ? Number(pruneDaysRaw) : null;

	const bulkCount = getOptionNumber(entry, ['count', 'delete_count', 'messages', 'message_count'], i18n);
	const reason = typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : null;

	const withBecause = (sentence: React.ReactNode) =>
		reason ? (
			<>
				{sentence} <Trans>Because {reason}.</Trans>
			</>
		) : (
			sentence
		);

	switch (actionType) {
		case AuditLogActionType.GUILD_UPDATE:
			return withBecause(<Trans>{actor} updated the community settings.</Trans>);

		case AuditLogActionType.CHANNEL_CREATE:
			return withBecause(
				<Trans>
					{actor} created the channel {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.CHANNEL_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the channel {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.CHANNEL_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the channel {namedTarget}.
				</Trans>,
			);

		case AuditLogActionType.CHANNEL_OVERWRITE_CREATE:
			return withBecause(
				<Trans>
					{actor} added channel permissions for {targetEntity}
					{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.CHANNEL_OVERWRITE_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated channel permissions for {targetEntity}
					{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.CHANNEL_OVERWRITE_DELETE:
			return withBecause(
				<Trans>
					{actor} removed channel permissions for {targetEntity}
					{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);

		case AuditLogActionType.MEMBER_KICK:
			return withBecause(
				<Trans>
					{actor} kicked {targetMember}.
				</Trans>,
			);
		case AuditLogActionType.MEMBER_BAN_ADD:
			return withBecause(
				<Trans>
					{actor} banned {targetMember}.
				</Trans>,
			);
		case AuditLogActionType.MEMBER_BAN_REMOVE:
			return withBecause(
				<Trans>
					{actor} unbanned {targetMember}.
				</Trans>,
			);

		case AuditLogActionType.MEMBER_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated {targetMember}.
				</Trans>,
			);
		case AuditLogActionType.MEMBER_ROLE_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated roles for {targetMember}.
				</Trans>,
			);

		case AuditLogActionType.MEMBER_PRUNE:
			return withBecause(
				pruneDays != null && !Number.isNaN(pruneDays) ? (
					pruneDays === 1 ? (
						<Trans>
							{actor} pruned members inactive for {renderValueInline(pruneDays, guildId, i18n)} day.
						</Trans>
					) : (
						<Trans>
							{actor} pruned members inactive for {renderValueInline(pruneDays, guildId, i18n)} days.
						</Trans>
					)
				) : (
					<Trans>{actor} pruned inactive members.</Trans>
				),
			);

		case AuditLogActionType.MEMBER_MOVE:
			return withBecause(
				channelNode ? (
					<Trans>
						{actor} moved {targetMember} to {channelNode}.
					</Trans>
				) : (
					<Trans>
						{actor} moved {targetMember} to another voice channel.
					</Trans>
				),
			);

		case AuditLogActionType.MEMBER_DISCONNECT:
			return withBecause(
				<Trans>
					{actor} disconnected {targetMember} from voice.
				</Trans>,
			);

		case AuditLogActionType.BOT_ADD:
			return withBecause(
				<Trans>
					{actor} added the bot {targetMember}.
				</Trans>,
			);

		case AuditLogActionType.ROLE_CREATE:
			return withBecause(
				<Trans>
					{actor} created the role {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.ROLE_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the role {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.ROLE_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the role {namedTarget}.
				</Trans>,
			);

		case AuditLogActionType.INVITE_CREATE:
			return withBecause(
				<Trans>
					{actor} created the invite {namedTarget}
					{channelNode ? <> for {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.INVITE_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the invite {namedTarget}
					{channelNode ? <> for {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.INVITE_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the invite {namedTarget}
					{channelNode ? <> for {channelNode}</> : null}.
				</Trans>,
			);

		case AuditLogActionType.WEBHOOK_CREATE:
			return withBecause(
				<Trans>
					{actor} created the webhook {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.WEBHOOK_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the webhook {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.WEBHOOK_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the webhook {namedTarget}.
				</Trans>,
			);

		case AuditLogActionType.EMOJI_CREATE:
			return withBecause(
				<Trans>
					{actor} added the emoji {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.EMOJI_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the emoji {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.EMOJI_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the emoji {namedTarget}.
				</Trans>,
			);

		case AuditLogActionType.STICKER_CREATE:
			return withBecause(
				<Trans>
					{actor} added the sticker {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.STICKER_UPDATE:
			return withBecause(
				<Trans>
					{actor} updated the sticker {namedTarget}.
				</Trans>,
			);
		case AuditLogActionType.STICKER_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted the sticker {namedTarget}.
				</Trans>,
			);

		case AuditLogActionType.MESSAGE_DELETE:
			return withBecause(
				<Trans>
					{actor} deleted a message{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.MESSAGE_BULK_DELETE:
			return withBecause(
				bulkCount != null ? (
					bulkCount === 1 ? (
						<Trans>
							{actor} deleted {renderValueInline(bulkCount, guildId, i18n)} message
							{channelNode ? <> in {channelNode}</> : null}.
						</Trans>
					) : (
						<Trans>
							{actor} deleted {renderValueInline(bulkCount, guildId, i18n)} messages
							{channelNode ? <> in {channelNode}</> : null}.
						</Trans>
					)
				) : (
					<Trans>
						{actor} deleted multiple messages{channelNode ? <> in {channelNode}</> : null}.
					</Trans>
				),
			);
		case AuditLogActionType.MESSAGE_PIN:
			return withBecause(
				<Trans>
					{actor} pinned a message{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);
		case AuditLogActionType.MESSAGE_UNPIN:
			return withBecause(
				<Trans>
					{actor} unpinned a message{channelNode ? <> in {channelNode}</> : null}.
				</Trans>,
			);

		default:
			return withBecause(
				<Trans>
					{actor} performed an audit action on {targetEntity}.
				</Trans>,
			);
	}
};
