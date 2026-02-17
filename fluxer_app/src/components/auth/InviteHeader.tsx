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

import styles from '@app/components/auth/AuthPageStyles.module.css';
import {GuildBadge} from '@app/components/guild/GuildBadge';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {Avatar} from '@app/components/uikit/Avatar';
import {BaseAvatar} from '@app/components/uikit/BaseAvatar';
import {UserRecord} from '@app/records/UserRecord';
import {isGroupDmInvite, isGuildInvite, isPackInvite} from '@app/types/InviteTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import type {GroupDmInvite, GuildInvite, Invite, PackInvite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useMemo, useState} from 'react';

interface InviteHeaderProps {
	invite: Invite;
}

interface GuildInviteHeaderProps {
	invite: GuildInvite;
}

interface GroupDMInviteHeaderProps {
	invite: GroupDmInvite;
}

interface PackInviteHeaderProps {
	invite: PackInvite;
}

interface PreviewGuildInviteHeaderProps {
	guildId: string;
	guildName: string;
	guildIcon: string | null;
	features: ReadonlyArray<string>;
	presenceCount: number;
	memberCount: number;
	previewIconUrl?: string | null;
	previewName?: string | null;
}

function formatInviteCount(value: number): string {
	return formatNumber(value, getCurrentLocale());
}

export const GuildInviteHeader = observer(function GuildInviteHeader({invite}: GuildInviteHeaderProps) {
	const {t} = useLingui();
	const guild = invite.guild;
	const features = Array.isArray(guild.features) ? guild.features : [...guild.features];
	const presenceCount = invite.presence_count ?? 0;
	const memberCount = invite.member_count ?? 0;
	const formattedPresenceCount = formatInviteCount(presenceCount);
	const formattedMemberCount = formatInviteCount(memberCount);

	return (
		<div className={styles.entityHeader}>
			<div className={styles.entityIconWrapper}>
				<GuildIcon id={guild.id} name={guild.name} icon={guild.icon} className={styles.entityIcon} sizePx={80} />
			</div>
			<div className={styles.entityDetails}>
				<p className={styles.entityText}>
					<Trans>You've been invited to join</Trans>
				</p>
				<div className={styles.entityTitleWrapper}>
					<h2 className={styles.entityTitle}>{guild.name}</h2>
					<GuildBadge features={features} />
				</div>
				<div className={styles.entityStats}>
					<div className={styles.entityStat}>
						<div className={styles.onlineDot} />
						<span className={styles.statText}>
							<Trans>{formattedPresenceCount} Online</Trans>
						</span>
					</div>
					<div className={styles.entityStat}>
						<div className={styles.offlineDot} />
						<span className={styles.statText}>
							{memberCount === 1 ? t`${formattedMemberCount} Member` : t`${formattedMemberCount} Members`}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
});

export const GroupDMInviteHeader = observer(function GroupDMInviteHeader({invite}: GroupDMInviteHeaderProps) {
	const {t} = useLingui();
	const inviter = invite.inviter;
	const avatarUrl = inviter ? AvatarUtils.getUserAvatarURL(inviter, false) : null;
	const memberCount = invite.member_count ?? 0;
	const formattedMemberCount = formatInviteCount(memberCount);

	return (
		<div className={styles.entityHeader}>
			{inviter && avatarUrl ? <BaseAvatar size={80} avatarUrl={avatarUrl} shouldPlayAnimated={false} /> : null}
			<div className={styles.entityDetails}>
				<p className={styles.entityText}>
					<Trans>You've been invited to join a group DM by</Trans>
				</p>
				{inviter ? (
					<h2 className={styles.entityTitle}>
						{inviter.username}#{inviter.discriminator}
					</h2>
				) : null}
				<div className={styles.entityStats}>
					<div className={styles.entityStat}>
						<div className={styles.offlineDot} />
						<span className={styles.statText}>
							{memberCount === 1 ? t`${formattedMemberCount} Member` : t`${formattedMemberCount} Members`}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
});

export const PackInviteHeader = observer(function PackInviteHeader({invite}: PackInviteHeaderProps) {
	const {t} = useLingui();
	const pack = invite.pack;
	const creatorRecord = useMemo(() => new UserRecord(pack.creator), [pack.creator]);
	const packKindLabel = pack.type === 'emoji' ? t`Emoji pack` : t`Sticker pack`;
	const inviterTag = invite.inviter ? `${invite.inviter.username}#${invite.inviter.discriminator}` : null;

	return (
		<div className={styles.entityHeader}>
			<div className={styles.entityIconWrapper}>
				<Avatar user={creatorRecord} size={80} className={styles.entityIcon} />
			</div>
			<div className={styles.entityDetails}>
				<p className={styles.entityText}>
					<Trans>You've been invited to install</Trans>
				</p>
				<div className={styles.entityTitleWrapper}>
					<h2 className={styles.entityTitle}>{pack.name}</h2>
					<span className={styles.packBadge}>{packKindLabel}</span>
				</div>
				<p className={styles.packDescription}>{pack.description || t`No description provided.`}</p>
				<div className={styles.packMeta}>
					<span className={styles.packMetaText}>{t`Created by ${pack.creator.username}`}</span>
					{inviterTag ? <span className={styles.packMetaText}>{t`Invited by ${inviterTag}`}</span> : null}
				</div>
			</div>
		</div>
	);
});

export function InviteHeader({invite}: InviteHeaderProps) {
	if (isGroupDmInvite(invite)) {
		return <GroupDMInviteHeader invite={invite} />;
	}

	if (isPackInvite(invite)) {
		return <PackInviteHeader invite={invite} />;
	}

	if (isGuildInvite(invite)) {
		return <GuildInviteHeader invite={invite} />;
	}

	return null;
}

export const PreviewGuildInviteHeader = observer(function PreviewGuildInviteHeader({
	guildId,
	guildName,
	guildIcon,
	features,
	presenceCount,
	memberCount,
	previewIconUrl,
	previewName,
}: PreviewGuildInviteHeaderProps) {
	const {t} = useLingui();
	const displayName = previewName ?? guildName;
	const formattedPresenceCount = formatInviteCount(presenceCount);
	const formattedMemberCount = formatInviteCount(memberCount);
	const [hasPreviewIconError, setPreviewIconError] = useState(false);

	useEffect(() => {
		setPreviewIconError(false);
	}, [previewIconUrl]);

	const shouldShowPreviewIcon = Boolean(previewIconUrl && !hasPreviewIconError);

	return (
		<div className={styles.entityHeader}>
			<div className={styles.entityIconWrapper}>
				{shouldShowPreviewIcon ? (
					<img
						src={previewIconUrl as string}
						alt=""
						className={styles.entityIcon}
						onError={(e) => {
							e.currentTarget.style.display = 'none';
							setPreviewIconError(true);
						}}
					/>
				) : (
					<GuildIcon id={guildId} name={displayName} icon={guildIcon} className={styles.entityIcon} sizePx={80} />
				)}
			</div>
			<div className={styles.entityDetails}>
				<p className={styles.entityText}>
					<Trans>You've been invited to join</Trans>
				</p>
				<div className={styles.entityTitleWrapper}>
					<h2 className={styles.entityTitle}>{displayName}</h2>
					<GuildBadge features={features} />
				</div>
				<div className={styles.entityStats}>
					<div className={styles.entityStat}>
						<div className={styles.onlineDot} />
						<span className={styles.statText}>
							<Trans>{formattedPresenceCount} Online</Trans>
						</span>
					</div>
					<div className={styles.entityStat}>
						<div className={styles.offlineDot} />
						<span className={styles.statText}>
							{memberCount === 1 ? t`${formattedMemberCount} Member` : t`${formattedMemberCount} Members`}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
});
