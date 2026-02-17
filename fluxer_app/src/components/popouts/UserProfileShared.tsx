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

import {AddRoleButton, RoleList} from '@app/components/guild/RoleManagement';
import {BlueskyIcon} from '@app/components/icons/BlueskyIcon';
import {FluxerIcon} from '@app/components/icons/FluxerIcon';
import {UnverifiedConnectionIcon} from '@app/components/icons/UnverifiedConnectionIcon';
import {VerifiedConnectionIcon} from '@app/components/icons/VerifiedConnectionIcon';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import styles from '@app/components/popouts/UserProfileShared.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {SafeMarkdown} from '@app/lib/markdown';
import {MarkdownContext} from '@app/lib/markdown/renderers/RendererTypes';
import type {GuildRoleRecord} from '@app/records/GuildRoleRecord';
import type {ProfileRecord} from '@app/records/ProfileRecord';
import type {UserRecord} from '@app/records/UserRecord';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import markupStyles from '@app/styles/Markup.module.css';
import * as DateUtils from '@app/utils/DateUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {ConnectionTypes} from '@fluxer/constants/src/ConnectionConstants';
import type {UserProfile} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {ArrowSquareOutIcon, GlobeSimpleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

export const UserProfileBio: React.FC<{
	profile: ProfileRecord;
	profileData?: Readonly<UserProfile> | null;
	onShowMore?: () => void;
}> = observer(({profile, profileData, onShowMore}) => {
	const resolvedProfile = profileData ?? profile?.getEffectiveProfile() ?? null;
	const bioContent = resolvedProfile?.bio ?? '';

	const shouldTruncate = !!onShowMore;
	const bioRef = useRef<HTMLDivElement | null>(null);
	const [isBioTruncated, setIsBioTruncated] = useState(false);
	const [isBioInteracting, setIsBioInteracting] = useState(false);
	const shouldAnimateEmoji = UserSettingsStore.getAnimateEmoji();

	const updateBioEmojiAnimation = useCallback((shouldAnimate: boolean) => {
		const bioElement = bioRef.current;
		if (!bioElement) {
			return;
		}

		const emojiImages = bioElement.querySelectorAll<HTMLImageElement>('img[data-emoji-id][data-animated="true"]');
		for (const emojiImage of emojiImages) {
			const url = new URL(emojiImage.src, window.location.origin);
			const nextAnimated = shouldAnimate.toString();
			if (url.searchParams.get('animated') === nextAnimated) {
				continue;
			}
			url.searchParams.set('animated', nextAnimated);
			emojiImage.src = url.toString();
		}
	}, []);

	const checkBioTruncation = useCallback(() => {
		if (!shouldTruncate || !bioContent) {
			setIsBioTruncated(false);
			return;
		}

		const bioElement = bioRef.current;
		if (!bioElement) {
			setIsBioTruncated(false);
			return;
		}

		const isOverflowingHeight = bioElement.scrollHeight - bioElement.clientHeight > 1;
		const isOverflowingWidth = bioElement.scrollWidth - bioElement.clientWidth > 1;
		setIsBioTruncated(isOverflowingHeight || isOverflowingWidth);
	}, [bioContent, shouldTruncate]);

	useLayoutEffect(() => {
		if (!shouldTruncate || !bioContent) {
			setIsBioTruncated(false);
			return;
		}

		const frameId = requestAnimationFrame(checkBioTruncation);
		const bioElement = bioRef.current;

		if (!bioElement || typeof ResizeObserver === 'undefined') {
			return () => {
				cancelAnimationFrame(frameId);
			};
		}

		const resizeObserver = new ResizeObserver(() => {
			checkBioTruncation();
		});
		resizeObserver.observe(bioElement);

		return () => {
			cancelAnimationFrame(frameId);
			resizeObserver.disconnect();
		};
	}, [bioContent, checkBioTruncation, shouldTruncate]);

	useEffect(() => {
		updateBioEmojiAnimation(shouldAnimateEmoji || isBioInteracting);
	}, [bioContent, isBioInteracting, shouldAnimateEmoji, updateBioEmojiAnimation]);

	useEffect(() => {
		const bioElement = bioRef.current;
		if (!bioElement) {
			return;
		}

		const handlePointerEnter = () => {
			setIsBioInteracting(true);
		};
		const handlePointerLeave = () => {
			setIsBioInteracting(false);
		};
		const handleFocusIn = () => {
			setIsBioInteracting(true);
		};
		const handleFocusOut = (event: FocusEvent) => {
			if (!bioElement.contains(event.relatedTarget as Node | null)) {
				setIsBioInteracting(false);
			}
		};

		bioElement.addEventListener('pointerenter', handlePointerEnter);
		bioElement.addEventListener('pointerleave', handlePointerLeave);
		bioElement.addEventListener('focusin', handleFocusIn);
		bioElement.addEventListener('focusout', handleFocusOut);

		return () => {
			bioElement.removeEventListener('pointerenter', handlePointerEnter);
			bioElement.removeEventListener('pointerleave', handlePointerLeave);
			bioElement.removeEventListener('focusin', handleFocusIn);
			bioElement.removeEventListener('focusout', handleFocusOut);
		};
	}, [bioContent]);

	if (!bioContent) {
		return null;
	}

	return (
		<div className={styles.bioContainer}>
			<div
				ref={bioRef}
				className={clsx(markupStyles.markup, markupStyles.bio, {
					[styles.bioClamped]: shouldTruncate,
				})}
			>
				<SafeMarkdown content={bioContent} options={{context: MarkdownContext.RESTRICTED_USER_BIO}} />
			</div>

			{shouldTruncate && isBioTruncated && (
				<FocusRing offset={-2}>
					<button type="button" onClick={onShowMore} className={styles.viewFullButton}>
						<Trans>View Full Profile</Trans>
					</button>
				</FocusRing>
			)}
		</div>
	);
});

interface UserProfilePreviewBioProps {
	profile: ProfileRecord;
	profileData?: Readonly<UserProfile> | null;
	onShowMore: () => void;
}

export const UserProfilePreviewBio: React.FC<UserProfilePreviewBioProps> = ({profile, profileData, onShowMore}) => {
	return <UserProfileBio profile={profile} profileData={profileData} onShowMore={onShowMore} />;
};

export const UserProfileMembershipInfo: React.FC<{profile: ProfileRecord; user: UserRecord}> = observer(
	({profile, user}) => {
		const {t} = useLingui();
		if (profile?.guild && profile.guildMember) {
			return (
				<div className={styles.membershipContainer}>
					<span className={styles.membershipTitle}>
						<Trans>Member Since</Trans>
					</span>
					<div className={styles.membershipDates}>
						<div className={styles.membershipDate}>
							<Tooltip text={t`Fluxer`}>
								<div className={styles.membershipIcon}>
									<FluxerIcon className={clsx(styles.iconSmall, styles.textChat)} />
								</div>
							</Tooltip>
							<span className={styles.membershipDateText}>{DateUtils.getFormattedShortDate(user.createdAt)}</span>
						</div>
						<div className={styles.membershipDate}>
							<Tooltip text={profile.guild.name}>
								<div className={styles.membershipIcon}>
									<GuildIcon
										id={profile.guild.id}
										name={profile.guild.name}
										icon={profile.guild.icon}
										className={clsx(styles.membershipGuildIcon, styles.textXs)}
										sizePx={16}
									/>
								</div>
							</Tooltip>
							<span className={styles.membershipDateText}>
								{DateUtils.getFormattedShortDate(profile.guildMember.joinedAt)}
							</span>
						</div>
					</div>
				</div>
			);
		}

		return (
			<div className={styles.membershipContainer}>
				<span className={styles.membershipTitle}>
					<Trans>Fluxer Member Since</Trans>
				</span>
				<span className={styles.membershipDateText}>{DateUtils.getFormattedShortDate(user.createdAt)}</span>
			</div>
		);
	},
);

export const UserProfileRoles: React.FC<{
	profile: ProfileRecord;
	user: UserRecord;
	memberRoles: Array<GuildRoleRecord>;
	canManageRoles: boolean;
}> = observer(({profile, user, memberRoles, canManageRoles}) => {
	return profile?.guild && profile?.guildMember && (memberRoles.length > 0 || canManageRoles) ? (
		<div className={styles.rolesContainer}>
			<div className={styles.rolesHeader}>
				<span className={styles.rolesTitle}>
					<Trans>Roles</Trans>
				</span>
				{canManageRoles && <AddRoleButton guildId={profile.guild.id} userId={user.id} />}
			</div>
			{memberRoles.length > 0 ? (
				<RoleList guildId={profile.guild.id} userId={user.id} roles={memberRoles} canManage={canManageRoles} />
			) : (
				<span className={styles.rolesEmpty}>
					<Trans>This user has no roles in this community.</Trans>
				</span>
			)}
		</div>
	) : null;
});

function getConnectionUrl(type: string, name: string): string {
	return type === ConnectionTypes.BLUESKY ? `https://bsky.app/profile/${name}` : `https://${name}`;
}

const ConnectionCard: React.FC<{
	connection: {id: string; type: string; name: string; verified: boolean};
	onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, url: string) => void;
	mobile?: boolean;
}> = ({connection, onLinkClick, mobile}) => {
	const {t} = useLingui();
	const url = getConnectionUrl(connection.type, connection.name);

	const iconLabel = connection.type === ConnectionTypes.BLUESKY ? t`Bluesky` : t`Domain`;

	const icon = (
		<Tooltip text={iconLabel}>
			<div className={styles.connectionIcon}>
				{connection.type === ConnectionTypes.BLUESKY ? (
					<BlueskyIcon size={18} />
				) : (
					<GlobeSimpleIcon size={18} className={styles.connectionDomainIcon} />
				)}
			</div>
		</Tooltip>
	);

	const nameRow = (
		<div className={styles.connectionCardNameRow}>
			<span className={styles.connectionCardName}>{connection.name}</span>
			<Tooltip
				text={connection.verified ? t`This connection has been verified.` : t`This connection has not been verified.`}
			>
				<div className={styles.connectionBadge}>
					{connection.verified ? <VerifiedConnectionIcon size={16} /> : <UnverifiedConnectionIcon size={16} />}
				</div>
			</Tooltip>
		</div>
	);

	if (mobile) {
		return (
			<a
				href={url}
				target="_blank"
				rel="noopener noreferrer"
				className={styles.connectionCard}
				onClick={(e) => onLinkClick(e, url)}
			>
				{icon}
				{nameRow}
				<ArrowSquareOutIcon size={16} weight="bold" className={styles.connectionExternalArrow} />
			</a>
		);
	}

	return (
		<div className={styles.connectionCard}>
			{icon}
			{nameRow}
			<Tooltip text={t`Open Link`}>
				<div>
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className={styles.connectionExternalLink}
						onClick={(e) => onLinkClick(e, url)}
					>
						<ArrowSquareOutIcon size={16} weight="bold" />
					</a>
				</div>
			</Tooltip>
		</div>
	);
};

export const UserProfileConnections: React.FC<{
	profile: ProfileRecord;
	variant?: 'compact' | 'cards' | 'mobile';
}> = observer(({profile, variant}) => {
	const handleConnectionClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
		e.preventDefault();
		void openExternalUrl(url);
	}, []);

	const connections = profile.connectedAccounts;
	if (!connections || connections.length === 0) {
		return null;
	}

	if (variant === 'compact') {
		return (
			<div className={styles.connectionsCompactWrapper}>
				<div className={styles.connectionsCompactSeparator} />
				<div className={styles.connectionsCompact}>
					{connections.map((connection) => {
						const url = getConnectionUrl(connection.type, connection.name);

						return (
							<Tooltip
								key={connection.id}
								text={() => (
									<span className={styles.connectionTooltipContent}>
										<span>{connection.name}</span>
										{connection.verified ? (
											<VerifiedConnectionIcon size={14} />
										) : (
											<UnverifiedConnectionIcon size={14} />
										)}
									</span>
								)}
							>
								<div>
									<a
										href={url}
										target="_blank"
										rel="noopener noreferrer"
										className={styles.connectionCompactIcon}
										onClick={(e) => handleConnectionClick(e, url)}
									>
										{connection.type === ConnectionTypes.BLUESKY ? (
											<BlueskyIcon size={16} />
										) : (
											<GlobeSimpleIcon size={16} className={styles.connectionDomainIcon} />
										)}
									</a>
								</div>
							</Tooltip>
						);
					})}
				</div>
			</div>
		);
	}

	if (variant === 'cards' || variant === 'mobile') {
		const listClass = variant === 'cards' ? styles.connectionsGrid : styles.connectionsListMobile;
		const isMobile = variant === 'mobile';

		return (
			<div className={styles.connectionsContainer}>
				<span className={styles.connectionsTitle}>
					<Trans>Connections</Trans>
				</span>
				<div className={listClass}>
					{connections.map((connection) => (
						<ConnectionCard
							key={connection.id}
							connection={connection}
							onLinkClick={handleConnectionClick}
							mobile={isMobile}
						/>
					))}
				</div>
			</div>
		);
	}

	return null;
});
