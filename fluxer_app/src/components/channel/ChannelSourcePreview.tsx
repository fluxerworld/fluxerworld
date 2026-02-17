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

import styles from '@app/components/channel/ChannelSourcePreview.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadge} from '@app/components/uikit/MentionBadge';
import {Link} from '@app/lib/router/React';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {getGroupDMAccentColor} from '@app/utils/GroupDMColorUtils';
import {getInitialsLength} from '@app/utils/GuildInitialsUtils';
import * as StringUtils from '@app/utils/StringUtils';
import {MEDIA_PROXY_ICON_SIZE_DEFAULT} from '@fluxer/constants/src/MediaProxyAssetSizes';
import type {MediaProxyImageSize} from '@fluxer/constants/src/MediaProxyImageSizes';
import {useLingui} from '@lingui/react/macro';
import {CaretRightIcon, HashIcon, NotePencilIcon, UserIcon, UsersIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

type SubtextTone = 'muted' | 'primary';

interface ChannelSourcePreviewProps {
	channel: ChannelRecord;
	onClick?: () => void;
	linkTo?: string;
	onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
	mentionCount?: number;
	avatarSize?: MediaProxyImageSize;
	variant?: 'default' | 'inline';
	showChannelIcon?: boolean;
	className?: string;
}

function getChannelDisplayName(channel: ChannelRecord): string {
	if (channel.isPrivate()) {
		return ChannelUtils.getDMDisplayName(channel);
	}
	return channel.name?.trim() || ChannelUtils.getName(channel);
}

function getGroupDmMemberCount(channel: ChannelRecord): number {
	const currentUserId = AuthenticationStore.currentUserId;
	if (!currentUserId) return channel.recipientIds.length;
	const memberIds = new Set(channel.recipientIds);
	memberIds.add(currentUserId);
	return memberIds.size;
}

function renderAvatarImage(props: {url: string; label: string; size: number}): React.ReactNode {
	const {url, label, size} = props;
	return (
		<div
			className={styles.avatar}
			style={{width: size, height: size, backgroundImage: `url(${url})`}}
			role="img"
			aria-label={label}
		/>
	);
}

function renderAvatarFallback(props: {
	label: string;
	size: number;
	background?: string;
	content: React.ReactNode;
	initialsLength?: string;
}): React.ReactNode {
	const {label, size, background, content, initialsLength} = props;
	return (
		<div
			className={styles.avatar}
			style={{width: size, height: size, backgroundColor: background}}
			role="img"
			aria-label={label}
			data-initials-length={initialsLength}
		>
			{content}
		</div>
	);
}

function renderChannelAvatar(channel: ChannelRecord, size: MediaProxyImageSize): React.ReactNode {
	if (channel.guildId) {
		const guild = GuildStore.getGuild(channel.guildId);
		if (!guild) {
			return renderAvatarFallback({
				label: 'Channel',
				size,
				content: <HashIcon className={styles.fallbackIcon} weight="bold" />,
			});
		}

		const iconUrl = AvatarUtils.getGuildIconURL({id: guild.id, icon: guild.icon}, true);
		if (iconUrl) {
			return renderAvatarImage({url: iconUrl, label: guild.name, size});
		}

		const initials = StringUtils.getInitialsFromName(guild.name);
		const initialsLength = getInitialsLength(initials);

		return renderAvatarFallback({
			label: guild.name,
			size,
			content: <span className={styles.initials}>{initials}</span>,
			initialsLength,
		});
	}

	if (channel.isDM()) {
		const recipientId = channel.getRecipientId();
		const recipient = recipientId ? UserStore.getUser(recipientId) : null;
		if (recipient) {
			const url = AvatarUtils.getUserAvatarURL({id: recipient.id, avatar: recipient.avatar}, false);
			return renderAvatarImage({url, label: recipient.tag, size});
		}

		return renderAvatarFallback({
			label: 'Direct message',
			size,
			content: <UserIcon className={styles.fallbackIcon} weight="bold" />,
		});
	}

	if (channel.isGroupDM()) {
		const iconUrl = AvatarUtils.getChannelIconURL(
			{id: channel.id, icon: channel.icon},
			MEDIA_PROXY_ICON_SIZE_DEFAULT,
			true,
		);
		if (iconUrl) {
			return renderAvatarImage({url: iconUrl, label: 'Group', size});
		}

		const accentColor = getGroupDMAccentColor(channel.id);
		return renderAvatarFallback({
			label: 'Group',
			size,
			background: accentColor,
			content: <UsersIcon className={styles.fallbackIcon} weight="bold" />,
		});
	}

	if (channel.isPersonalNotes()) {
		return renderAvatarFallback({
			label: 'Personal notes',
			size,
			content: <NotePencilIcon className={styles.fallbackIcon} weight="bold" />,
		});
	}

	return renderAvatarFallback({
		label: 'Channel',
		size,
		content: <HashIcon className={styles.fallbackIcon} weight="bold" />,
	});
}

export const ChannelSourcePreview = observer(function ChannelSourcePreview({
	channel,
	onClick,
	linkTo,
	onContextMenu,
	mentionCount,
	avatarSize,
	variant = 'default',
	showChannelIcon = true,
	className,
}: ChannelSourcePreviewProps) {
	const {t} = useLingui();

	const guild = channel.guildId ? (GuildStore.getGuild(channel.guildId) ?? null) : null;
	const category = channel.parentId ? (ChannelStore.getChannel(channel.parentId) ?? null) : null;
	const isGroupDm = channel.isGroupDM();
	const isUserDm = channel.isDM();

	const channelDisplayName = getChannelDisplayName(channel);
	const displayName = isUserDm ? `@${channelDisplayName}` : channelDisplayName;
	const resolvedAvatarSize: MediaProxyImageSize = avatarSize ?? (variant === 'inline' ? 24 : 32);

	const {subtext, subtextTone} = useMemo(() => {
		if (isGroupDm) {
			const memberCount = getGroupDmMemberCount(channel);
			const label = memberCount === 1 ? t`${memberCount} Member` : t`${memberCount} Members`;
			return {subtext: label, subtextTone: 'primary' as SubtextTone};
		}

		if (guild) {
			if (category?.name) {
				return {
					subtext: (
						<span className={styles.subtextBreadcrumb}>
							<span>{guild.name}</span>
							<CaretRightIcon className={styles.subtextChevron} weight="bold" />
							<span>{category.name}</span>
						</span>
					),
					subtextTone: 'muted' as SubtextTone,
				};
			}

			return {subtext: guild.name, subtextTone: 'muted' as SubtextTone};
		}

		return {subtext: null, subtextTone: 'muted' as SubtextTone};
	}, [category?.name, channel, guild, isGroupDm, t]);

	const nameContent = <span className={styles.nameText}>{displayName}</span>;
	const nameAriaLabel = t`Jump to ${displayName}`;

	const renderNameAction = () => {
		if (linkTo) {
			return (
				<FocusRing offset={-2} ringClassName={styles.focusRingTight}>
					<Link to={linkTo} className={styles.nameLink} aria-label={nameAriaLabel}>
						{nameContent}
					</Link>
				</FocusRing>
			);
		}

		if (onClick) {
			return (
				<FocusRing offset={-2} ringClassName={styles.focusRingTight}>
					<button type="button" className={styles.nameButton} onClick={onClick} aria-label={nameAriaLabel}>
						{nameContent}
					</button>
				</FocusRing>
			);
		}

		return nameContent;
	};
	const containerInteractionProps = onContextMenu ? {onContextMenu} : {};

	return (
		<div
			className={clsx(styles.container, variant === 'inline' && styles.inline, className)}
			{...containerInteractionProps}
		>
			{renderChannelAvatar(channel, resolvedAvatarSize)}
			<div className={styles.textContainer}>
				<div className={styles.nameRow}>
					{showChannelIcon && channel.guildId
						? ChannelUtils.getIcon(channel, {className: styles.channelIcon, weight: 'bold'})
						: null}
					{renderNameAction()}
					{mentionCount != null && mentionCount > 0 ? <MentionBadge mentionCount={mentionCount} size="small" /> : null}
				</div>
				{subtext ? (
					<div
						className={clsx(styles.subtext, subtextTone === 'primary' ? styles.subtextPrimary : styles.subtextMuted)}
					>
						{subtext}
					</div>
				) : null}
			</div>
		</div>
	);
});
