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
import * as RelationshipActionCreators from '@app/actions/RelationshipActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import styles from '@app/components/channel/direct_message/DMWelcomeSection.module.css';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {UserProfileBadges} from '@app/components/popouts/UserProfileBadges';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {Button} from '@app/components/uikit/button/Button';
import {DMContextMenu} from '@app/components/uikit/context_menu/DMContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {ProfileRecord} from '@app/records/ProfileRecord';
import GuildStore from '@app/stores/GuildStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserStore from '@app/stores/UserStore';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('DMWelcomeSection');

interface DMWelcomeSectionProps {
	userId: string;
	channel?: ChannelRecord;
}

export const DMWelcomeSection: React.FC<DMWelcomeSectionProps> = observer(function DMWelcomeSection({userId, channel}) {
	const {t} = useLingui();

	const user = UserStore.getUser(userId);
	const relationship = RelationshipStore.getRelationship(user?.id ?? '');
	const relationshipType = relationship?.type;
	const [profile, setProfile] = useState<ProfileRecord | null>(null);
	const mobileLayout = MobileLayoutStore;
	const profileMutualGuilds = useMemo(() => profile?.mutualGuilds ?? [], [profile?.mutualGuilds]);
	const mutualGuildRecords = useMemo(() => {
		return profileMutualGuilds
			.map((mutualGuild) => GuildStore.getGuild(mutualGuild.id))
			.filter((guild): guild is GuildRecord => guild !== undefined);
	}, [profileMutualGuilds]);

	useEffect(() => {
		if (!user) return;
		UserProfileActionCreators.fetch(user.id)
			.then((fetchedProfile) => {
				setProfile(fetchedProfile);
			})
			.catch((error) => {
				logger.error('Failed to fetch user profile:', error);
			});
	}, [user]);

	const openFullProfile = useCallback(() => {
		if (!user) return;

		UserProfileActionCreators.openUserProfile(user.id);
	}, [user]);

	const handleUserContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (!channel || !user) return;
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<DMContextMenu channel={channel} recipient={user} onClose={onClose} />
			));
		},
		[channel, user],
	);

	if (!user) {
		return null;
	}

	const handleSendFriendRequest = () => {
		RelationshipActionCreators.sendFriendRequest(user.id);
	};

	const handleAcceptFriendRequest = () => {
		RelationshipActionCreators.acceptFriendRequest(user.id);
	};

	const handleRemoveFriend = () => {
		RelationshipActionCreators.removeRelationship(user.id);
	};

	const handleCancelFriendRequest = () => {
		RelationshipActionCreators.removeRelationship(user.id);
	};

	const handleIgnoreFriendRequest = () => {
		RelationshipActionCreators.removeRelationship(user.id);
	};

	const hasMutualGuilds = profileMutualGuilds.length > 0;
	const currentUserUnclaimed = !(UserStore.currentUser?.isClaimed() ?? true);
	const shouldShowActionButton =
		!user.bot &&
		(relationshipType === undefined ||
			relationshipType === RelationshipTypes.INCOMING_REQUEST ||
			relationshipType === RelationshipTypes.OUTGOING_REQUEST ||
			relationshipType === RelationshipTypes.FRIEND);
	const mutualGuildCount = profileMutualGuilds.length;

	const renderActionButton = () => {
		if (user.bot) return null;
		switch (relationshipType) {
			case undefined: {
				const tooltipText = t`Claim your account to send friend requests.`;
				const button = (
					<Button small={true} onClick={handleSendFriendRequest} disabled={currentUserUnclaimed}>
						<Trans>Send Friend Request</Trans>
					</Button>
				);
				if (currentUserUnclaimed) {
					return (
						<Tooltip text={tooltipText} maxWidth="xl">
							<div>{button}</div>
						</Tooltip>
					);
				}
				return button;
			}
			case RelationshipTypes.INCOMING_REQUEST:
				return (
					<div className={styles.actionButtonsContainer}>
						<Button small={true} onClick={handleAcceptFriendRequest}>
							<Trans>Accept</Trans>
						</Button>
						<Button variant="secondary" small={true} onClick={handleIgnoreFriendRequest}>
							<Trans>Ignore</Trans>
						</Button>
					</div>
				);
			case RelationshipTypes.OUTGOING_REQUEST:
				return (
					<Button variant="secondary" small={true} onClick={handleCancelFriendRequest}>
						<Trans>Cancel Friend Request</Trans>
					</Button>
				);
			case RelationshipTypes.FRIEND:
				return (
					<Button variant="secondary" small={true} onClick={handleRemoveFriend}>
						<Trans>Remove Friend</Trans>
					</Button>
				);
			default:
				return null;
		}
	};

	const renderMutualGuilds = () => {
		if (!hasMutualGuilds) return null;

		return (
			<div className={styles.mutualGuildsContainer}>
				{mutualGuildRecords.length > 0 && (
					<AvatarStack size={32} maxVisible={3}>
						{mutualGuildRecords.map((guild) => (
							<div key={guild.id} className={styles.guildIconWrapper}>
								<GuildIcon id={guild.id} name={guild.name} icon={guild.icon} className={styles.guildIcon} sizePx={32} />
							</div>
						))}
					</AvatarStack>
				)}

				<span className={styles.mutualGuildsText}>
					{mutualGuildCount === 1 ? t`${mutualGuildCount} mutual community` : t`${mutualGuildCount} mutual communities`}
				</span>
			</div>
		);
	};

	return (
		<div className={styles.welcomeSection}>
			<div className={styles.profileSection}>
				<FocusRing offset={-2}>
					<button
						type="button"
						onClick={openFullProfile}
						onContextMenu={handleUserContextMenu}
						className={styles.avatarButton}
					>
						<StatusAwareAvatar user={user} size={80} showOffline={true} />
					</button>
				</FocusRing>

				<FocusRing offset={-2}>
					<button
						type="button"
						onClick={openFullProfile}
						onContextMenu={handleUserContextMenu}
						className={styles.usernameButton}
					>
						<span className={styles.username}>{user.username}</span>
						<span className={styles.discriminator}>#{user.discriminator}</span>
					</button>
				</FocusRing>

				<UserProfileBadges user={user} profile={profile} isModal={true} isMobile={mobileLayout.enabled} />
			</div>

			<p className={styles.welcomeText}>
				<Trans>
					This is the beginning of your direct message history with <strong>{user.username}</strong>.
				</Trans>
			</p>

			{(hasMutualGuilds || shouldShowActionButton) && (
				<div className={styles.actionSection}>
					{renderMutualGuilds()}
					{shouldShowActionButton && renderActionButton()}
				</div>
			)}
		</div>
	);
});
