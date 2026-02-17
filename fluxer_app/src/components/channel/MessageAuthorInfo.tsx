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

import {MessageAvatar} from '@app/components/channel/MessageAvatar';
import {MessageUsername} from '@app/components/channel/MessageUsername';
import {TimestampWithTooltip} from '@app/components/channel/TimestampWithTooltip';
import {UserTag} from '@app/components/channel/UserTag';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {MessageRecord} from '@app/records/MessageRecord';
import type {UserRecord} from '@app/records/UserRecord';
import styles from '@app/styles/Message.module.css';
import * as DateUtils from '@app/utils/DateUtils';
import type {MessagePreviewContext} from '@fluxer/constants/src/ChannelConstants';
import {formatShortRelativeTime} from '@fluxer/date_utils/src/DateDuration';
import {Trans, useLingui} from '@lingui/react/macro';
import {ClockIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';

interface MessageAuthorInfoProps {
	message: MessageRecord;
	author: UserRecord;
	guild?: GuildRecord;
	member?: GuildMemberRecord;
	shouldGroup: boolean;
	shouldAppearAuthorless: boolean;
	messageDisplayCompact: boolean;
	showUserAvatarsInCompactMode: boolean;
	mobileLayoutEnabled: boolean;
	isHovering: boolean;
	formattedDate: string;
	previewContext?: keyof typeof MessagePreviewContext;
	previewOverrides?: {
		usernameColor?: string;
		displayName?: string;
	};
}

export const MessageAuthorInfo = observer((props: MessageAuthorInfoProps) => {
	const {t} = useLingui();
	const {
		message,
		author,
		guild,
		member,
		shouldGroup,
		shouldAppearAuthorless,
		messageDisplayCompact,
		showUserAvatarsInCompactMode,
		mobileLayoutEnabled,
		isHovering,
		formattedDate,
		previewContext,
		previewOverrides,
	} = props;

	const isPreview = useMemo(() => Boolean(previewContext), [previewContext]);

	const timeoutUntil = useMemo(() => member?.communicationDisabledUntil ?? null, [member?.communicationDisabledUntil]);
	const isMemberTimedOut = useMemo(() => Boolean(member?.isTimedOut?.()), [member]);

	const timeoutIndicator = useMemo(
		() =>
			timeoutUntil && isMemberTimedOut ? (
				<Tooltip
					text={() => (
						<Trans>
							Timeout ends {formatShortRelativeTime(timeoutUntil)} ({DateUtils.getFormattedDateTime(timeoutUntil)})
						</Trans>
					)}
					position="top"
					maxWidth="none"
				>
					<span className={styles.messageTimeoutIndicator} role="img" aria-label={t`Timed out`}>
						<ClockIcon size={16} weight="bold" />
					</span>
				</Tooltip>
			) : null,
		[timeoutUntil, isMemberTimedOut],
	);

	const username = useMemo(
		() => (
			<MessageUsername
				user={author}
				message={message}
				guild={guild}
				member={member}
				className={styles.messageUsername}
				isPreview={isPreview}
				previewColor={previewOverrides?.usernameColor}
				previewName={previewOverrides?.displayName}
			/>
		),
		[author, message, guild, member, isPreview, previewOverrides?.usernameColor, previewOverrides?.displayName],
	);

	const timestampClass = useMemo(
		() => (shouldGroup ? styles.messageTimestampCompactHover : styles.messageTimestampCompact),
		[shouldGroup],
	);

	if (shouldAppearAuthorless) return null;

	if (messageDisplayCompact) {
		if (shouldGroup && mobileLayoutEnabled) return null;

		return (
			<span className={styles.messageAuthorInfoCompact}>
				<TimestampWithTooltip date={message.timestamp} className={timestampClass}>
					<span className={styles.copyOnly}>[</span>
					{DateUtils.getFormattedTime(message.timestamp)}
					<span className={styles.copyOnly}>]</span>
				</TimestampWithTooltip>

				<span className={styles.copyOnly}> </span>

				{author.bot && <UserTag className={styles.userTagCompact} system={author.system} />}

				{showUserAvatarsInCompactMode && (
					<MessageAvatar
						user={author}
						message={message}
						guildId={guild?.id}
						size={16}
						className={styles.messageAvatarCompact}
						isHovering={isHovering}
						isPreview={isPreview}
					/>
				)}

				<span className={styles.messageAuthorPart}>
					{timeoutIndicator}
					{username}
				</span>

				<span className={styles.copyOnly}>: </span>
			</span>
		);
	}

	if (!shouldGroup) {
		return (
			<>
				<div className={styles.messageGutterLeft} />
				<MessageAvatar
					user={author}
					message={message}
					guildId={guild?.id}
					size={40}
					className={styles.messageAvatar}
					isHovering={isHovering}
					isPreview={isPreview}
				/>
				<div className={styles.messageGutterRight} />
				<h3 className={styles.messageAuthorInfo}>
					<span className={styles.messageAuthorRow}>
						<span className={styles.messageAuthorPart}>
							{timeoutIndicator}
							{username}
							{author.bot && <UserTag className={styles.userTagOffset} system={author.system} />}
						</span>
						<TimestampWithTooltip date={message.timestamp} className={styles.messageTimestamp}>
							<span aria-hidden="true" className={styles.authorDashSeparator}>
								{' \u2014 '}
							</span>
							{formattedDate}
						</TimestampWithTooltip>
					</span>
				</h3>
			</>
		);
	}

	if (mobileLayoutEnabled) return null;

	return (
		<>
			<div className={styles.messageGutterLeft} />
			<TimestampWithTooltip date={message.timestamp} className={styles.messageTimestampHover}>
				<span className={styles.textSeparator}>[</span>
				{DateUtils.getFormattedTime(message.timestamp)}
				<span className={styles.textSeparator}>]</span>
			</TimestampWithTooltip>
			<div className={styles.messageGutterRight} />
		</>
	);
});
