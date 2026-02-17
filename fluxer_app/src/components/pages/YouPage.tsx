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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {CustomStatusDisplay} from '@app/components/common/custom_status_display/CustomStatusDisplay';
import {NoteEditSheet} from '@app/components/modals/NoteEditSheet';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import styles from '@app/components/pages/YouPage.module.css';
import {UserProfileBadges} from '@app/components/popouts/UserProfileBadges';
import {UserProfileBio, UserProfileMembershipInfo} from '@app/components/popouts/UserProfileShared';
import {Scroller} from '@app/components/uikit/Scroller';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {normalizeCustomStatus} from '@app/lib/CustomStatus';
import PresenceStore from '@app/stores/PresenceStore';
import UserNoteStore from '@app/stores/UserNoteStore';
import UserStore from '@app/stores/UserStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {createMockProfile} from '@app/utils/ProfileUtils';
import {Trans} from '@lingui/react/macro';
import {GearIcon, NotePencilIcon, PencilIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useMemo, useState} from 'react';

interface YouPageProps {
	onAvatarClick: () => void;
}

export const YouPage = observer(({onAvatarClick}: YouPageProps) => {
	const user = UserStore.currentUser;
	const userNote = user ? UserNoteStore.getUserNote(user.id) : '';
	const [noteSheetOpen, setNoteSheetOpen] = useState(false);

	const handleSettings = () => {
		ModalActionCreators.push(modal(() => <UserSettingsModal />));
	};

	const handleEditProfile = () => {
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="my_profile" />));
	};

	const profile = useMemo(() => (user ? createMockProfile(user) : null), [user]);
	const normalizedCustomStatus = useMemo(() => {
		if (!user) return null;
		return normalizeCustomStatus(PresenceStore.getCustomStatus(user.id));
	}, [user]);

	const hasCustomStatus = Boolean(normalizedCustomStatus);

	if (!user || !profile) return null;

	const bannerUrl = user.banner ? AvatarUtils.getUserBannerURL({id: user.id, banner: user.banner}, true) : null;

	return (
		<>
			<div className={styles.container}>
				<Scroller key="you-page-scroller">
					<div style={{paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px) + 1rem)'}}>
						<div className={styles.banner}>
							{bannerUrl ? (
								<div className={styles.bannerImage} style={{backgroundImage: `url(${bannerUrl})`}} />
							) : (
								<div className={styles.bannerDefault} />
							)}
						</div>

						<div className={styles.profile}>
							<button type="button" onClick={onAvatarClick} className={styles.avatarButton}>
								<StatusAwareAvatar size={80} user={user} />
							</button>

							<div className={styles.content}>
								<div className={styles.actions}>
									<button type="button" onClick={handleSettings} className={styles.settingsButton}>
										<GearIcon className={styles.settingsIcon} weight="fill" />
									</button>
								</div>

								<div className={styles.userInfo}>
									<div className={styles.usernameRow}>
										<span className={styles.username}>{user.username}</span>
									</div>
									<div className={styles.tagBadgeRow}>
										<span className={styles.fullTag}>
											{user.username}#{user.discriminator}
										</span>
										<div className={styles.badgesWrapper}>
											<UserProfileBadges user={user} profile={profile} isModal={true} isMobile={true} />
										</div>
									</div>
									{hasCustomStatus && (
										<div className={styles.customStatusRow}>
											<CustomStatusDisplay
												userId={user.id}
												className={styles.customStatusText}
												showTooltip
												allowJumboEmoji
												animateOnParentHover
											/>
										</div>
									)}
								</div>

								<button type="button" onClick={handleEditProfile} className={styles.editButton}>
									<PencilIcon className={styles.editIcon} />
									<span className={styles.editLabel}>
										<Trans>Edit Profile</Trans>
									</span>
								</button>

								{(profile?.userProfile.bio || profile) && (
									<div className={styles.section}>
										{profile?.userProfile.bio && (
											<div className={styles.sectionHeader}>
												<h3 className={styles.sectionTitle}>
													<Trans>About Me</Trans>
												</h3>
												<UserProfileBio profile={profile} />
											</div>
										)}
										<UserProfileMembershipInfo profile={profile} user={user} />
									</div>
								)}

								<button type="button" onClick={() => setNoteSheetOpen(true)} className={styles.noteButton}>
									<div>
										<h3 className={styles.noteLabel}>
											<Trans>Note</Trans>
										</h3>
										<p className={styles.noteSubtext}>
											<Trans>(only visible to you)</Trans>
										</p>
										{userNote && <p className={styles.noteText}>{userNote}</p>}
									</div>
									<div className={styles.noteIconWrapper}>
										<NotePencilIcon className={styles.noteIcon} />
									</div>
								</button>
							</div>
						</div>
					</div>
				</Scroller>
			</div>

			<NoteEditSheet
				isOpen={noteSheetOpen}
				onClose={() => setNoteSheetOpen(false)}
				userId={user.id}
				initialNote={userNote}
			/>
		</>
	);
});
