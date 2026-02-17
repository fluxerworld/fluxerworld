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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as UserNoteActionCreators from '@app/actions/UserNoteActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import {UserTag} from '@app/components/channel/UserTag';
import {CustomStatusDisplay} from '@app/components/common/custom_status_display/CustomStatusDisplay';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import type {IARContext} from '@app/components/modals/IARModal';
import {IARModal} from '@app/components/modals/IARModal';
import * as Modal from '@app/components/modals/Modal';
import userProfileModalStyles from '@app/components/modals/UserProfileModal.module.css';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import {UserProfileBadges} from '@app/components/popouts/UserProfileBadges';
import {UserProfileDataWarning} from '@app/components/popouts/UserProfileDataWarning';
import {
	UserProfileBio,
	UserProfileConnections,
	UserProfileMembershipInfo,
	UserProfileRoles,
} from '@app/components/popouts/UserProfileShared';
import {VoiceActivitySection} from '@app/components/profile/VoiceActivitySection';
import {Button} from '@app/components/uikit/button/Button';
import {GroupDMContextMenu} from '@app/components/uikit/context_menu/GroupDMContextMenu';
import {GuildContextMenu} from '@app/components/uikit/context_menu/GuildContextMenu';
import {GuildMemberContextMenu} from '@app/components/uikit/context_menu/GuildMemberContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {UserContextMenu} from '@app/components/uikit/context_menu/UserContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {Tabs} from '@app/components/uikit/tabs/Tabs';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useAutoplayExpandedProfileAnimations} from '@app/hooks/useAutoplayExpandedProfileAnimations';
import {Logger} from '@app/lib/Logger';
import {TextareaAutosize} from '@app/lib/TextareaAutosize';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {ProfileRecord} from '@app/records/ProfileRecord';
import {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import type {ContextMenuTargetElement} from '@app/stores/ContextMenuStore';
import ContextMenuStore, {isContextMenuNodeTarget} from '@app/stores/ContextMenuStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import MemberPresenceSubscriptionStore from '@app/stores/MemberPresenceSubscriptionStore';
import ModalStore from '@app/stores/ModalStore';
import PermissionStore from '@app/stores/PermissionStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import UserNoteStore from '@app/stores/UserNoteStore';
import UserProfileStore from '@app/stores/UserProfileStore';
import UserStore from '@app/stores/UserStore';
import {getUserAccentColor} from '@app/utils/AccentColorUtils';
import * as CallUtils from '@app/utils/CallUtils';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import * as ProfileDisplayUtils from '@app/utils/ProfileDisplayUtils';
import {createMockProfile} from '@app/utils/ProfileUtils';
import * as RelationshipActionUtils from '@app/utils/RelationshipActionUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	MEDIA_PROXY_AVATAR_SIZE_PROFILE,
	MEDIA_PROXY_PROFILE_BANNER_SIZE_MODAL,
} from '@fluxer/constants/src/MediaProxyAssetSizes';
import {PublicUserFlags, RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	CaretDownIcon,
	ChatTeardropIcon,
	CheckCircleIcon,
	ClockCounterClockwiseIcon,
	CopyIcon,
	DotsThreeIcon,
	FlagIcon,
	GlobeIcon,
	IdentificationCardIcon,
	PencilIcon,
	ProhibitIcon,
	UserMinusIcon,
	UserPlusIcon,
	UsersThreeIcon,
	VideoCameraIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import type {PressEvent} from 'react-aria-components';

const logger = new Logger('UserProfileModal');

export interface UserProfileModalProps {
	userId: string;
	guildId?: string;
	autoFocusNote?: boolean;
	disableEditProfile?: boolean;
	previewOverrides?: ProfileDisplayUtils.ProfilePreviewOverrides;
	previewUser?: UserRecord;
}

interface UserInfoProps {
	user: UserRecord;
	profile: ProfileRecord;
	guildId?: string;
	showProfileDataWarning?: boolean;
}

interface UserNoteEditorProps {
	userId: string;
	initialNote: string | null;
	autoFocus?: boolean;
	noteRef?: React.RefObject<HTMLTextAreaElement | null>;
}

interface ProfileContentProps {
	profile: ProfileRecord;
	user: UserRecord;
	userNote: string | null;
	autoFocusNote?: boolean;
	noteRef?: React.RefObject<HTMLTextAreaElement | null>;
}

type UserProfileModalComponent = React.FC<UserProfileModalProps>;

interface ProfileModalContentProps {
	profile: ProfileRecord;
	user: UserRecord;
	userNote: string | null;
	autoFocusNote?: boolean;
	noteRef?: React.RefObject<HTMLTextAreaElement | null>;
	renderActionButtons: () => React.ReactNode;
	previewOverrides?: ProfileDisplayUtils.ProfilePreviewOverrides;
	showProfileDataWarning?: boolean;
}

const UserInfo: React.FC<UserInfoProps> = observer(({user, profile, guildId, showProfileDataWarning}) => {
	const displayName = NicknameUtils.getNickname(user, guildId);
	const effectiveProfile = profile?.getEffectiveProfile() ?? null;
	const shouldAutoplayProfileAnimations = useAutoplayExpandedProfileAnimations();

	return (
		<div className={userProfileModalStyles.userInfo}>
			<div className={clsx(userProfileModalStyles.userInfoHeader, userProfileModalStyles.userInfoHeaderDesktop)}>
				<div className={userProfileModalStyles.userInfoContent}>
					{showProfileDataWarning && (
						<div className={userProfileModalStyles.profileDataWarning}>
							<UserProfileDataWarning />
						</div>
					)}
					<div className={userProfileModalStyles.nameRow}>
						<span className={userProfileModalStyles.userName}>{displayName}</span>
						{user.bot && <UserTag className={userProfileModalStyles.userTag} system={user.system} size="lg" />}
					</div>
					<div className={userProfileModalStyles.tagBadgeRow}>
						<div className={userProfileModalStyles.usernameRow}>{user.tag}</div>
						<div className={userProfileModalStyles.badgesWrapper}>
							<UserProfileBadges user={user} profile={profile} isModal={true} isMobile={false} />
						</div>
					</div>
					{effectiveProfile?.pronouns && (
						<div className={userProfileModalStyles.pronouns}>{effectiveProfile.pronouns}</div>
					)}
					<div className={userProfileModalStyles.customStatusRow}>
						<CustomStatusDisplay
							userId={user.id}
							className={userProfileModalStyles.customStatusText}
							showTooltip
							allowJumboEmoji
							maxLines={0}
							alwaysAnimate={shouldAutoplayProfileAnimations}
						/>
					</div>
				</div>
			</div>
		</div>
	);
});

const UserNoteEditor: React.FC<UserNoteEditorProps> = observer(({userId, initialNote, autoFocus, noteRef}) => {
	const {t} = useLingui();
	const [isEditing, setIsEditing] = useState(false);
	const [localNote, setLocalNote] = useState<string | null>(null);
	const internalNoteRef = useRef<HTMLTextAreaElement | null>(null);
	const textareaRef = noteRef || internalNoteRef;

	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			setIsEditing(true);
		}
	}, [autoFocus, textareaRef]);

	const handleBlur = () => {
		if (localNote != null && localNote !== initialNote) {
			UserNoteActionCreators.update(userId, localNote);
		}
		setIsEditing(false);
	};

	const handleFocus = () => {
		setIsEditing(true);
		if (textareaRef.current) {
			const length = textareaRef.current.value.length;
			textareaRef.current.setSelectionRange(length, length);
		}
	};

	return (
		<div className={userProfileModalStyles.userNoteEditor}>
			<span className={userProfileModalStyles.noteLabel}>
				<Trans>Note</Trans>
			</span>
			<TextareaAutosize
				ref={textareaRef}
				aria-label={t`Note`}
				className={clsx(
					userProfileModalStyles.noteTextarea,
					userProfileModalStyles.noteTextareaBase,
					isEditing ? userProfileModalStyles.noteTextareaEditing : userProfileModalStyles.noteTextareaNotEditing,
				)}
				defaultValue={initialNote ?? undefined}
				maxLength={256}
				onBlur={handleBlur}
				onChange={(event) => setLocalNote(event.target.value)}
				onFocus={handleFocus}
				placeholder={isEditing ? undefined : t`Click to add a note`}
			/>
		</div>
	);
});

const ProfileContent: React.FC<ProfileContentProps> = observer(({profile, user, userNote, autoFocusNote, noteRef}) => {
	const guildMember = GuildMemberStore.getMember(profile?.guildId ?? '', user.id);
	const memberRoles = profile?.guildId && guildMember ? guildMember.getSortedRoles() : [];
	const canManageRoles = PermissionStore.can(Permissions.MANAGE_ROLES, {guildId: profile?.guild?.id});

	const handleNavigate = useCallback(() => {
		ModalActionCreators.pop();
	}, []);

	return (
		<div className={userProfileModalStyles.profileContent}>
			<div className={userProfileModalStyles.profileContentHeader}>
				<VoiceActivitySection userId={user.id} onNavigate={handleNavigate} showAllActivities={true} />
				<UserProfileBio profile={profile} />
				<UserProfileMembershipInfo profile={profile} user={user} />
				<UserProfileRoles
					profile={profile}
					user={user}
					memberRoles={[...memberRoles]}
					canManageRoles={canManageRoles}
				/>
				<UserProfileConnections profile={profile} variant="cards" />
				<UserNoteEditor userId={user.id} initialNote={userNote} autoFocus={autoFocusNote} noteRef={noteRef} />
			</div>
		</div>
	);
});

const ProfileModalContent: React.FC<ProfileModalContentProps> = observer(
	({
		profile,
		user,
		userNote,
		autoFocusNote,
		noteRef,
		renderActionButtons,
		previewOverrides,
		showProfileDataWarning,
	}) => {
		const {t} = useLingui();
		const effectiveProfile = profile?.getEffectiveProfile() ?? null;
		const bannerColor = getUserAccentColor(user, effectiveProfile?.accent_color);

		const guildMember = GuildMemberStore.getMember(profile?.guildId ?? '', user.id);

		const profileContext = useMemo<ProfileDisplayUtils.ProfileDisplayContext>(
			() => ({
				user,
				profile,
				guildId: profile?.guildId,
				guildMember,
				guildMemberProfile: profile?.guildMemberProfile,
			}),
			[user, profile, guildMember],
		);

		const shouldAutoplayProfileAnimations = useAutoplayExpandedProfileAnimations();

		const {avatarUrl, hoverAvatarUrl} = useMemo(
			() => ProfileDisplayUtils.getProfileAvatarUrls(profileContext, previewOverrides, MEDIA_PROXY_AVATAR_SIZE_PROFILE),
			[profileContext, previewOverrides],
		);

		const bannerUrl = useMemo(
			() =>
				ProfileDisplayUtils.getProfileBannerUrl(
					profileContext,
					previewOverrides,
					shouldAutoplayProfileAnimations,
					MEDIA_PROXY_PROFILE_BANNER_SIZE_MODAL,
				),
			[profileContext, previewOverrides, shouldAutoplayProfileAnimations],
		);

		type MutualView = 'mutual_friends' | 'mutual_communities' | 'mutual_groups';

		const [activeTab, setActiveTab] = useState<'overview' | 'mutual'>('overview');
		const handleTabChange = useCallback((tab: 'overview' | 'mutual') => {
			setActiveTab(tab);
		}, []);

		const showMutualFriendsTab = !user.bot;
		const mutualFriendsCount = profile?.mutualFriends?.length ?? 0;
		const isCurrentUser = user.id === AuthenticationStore.currentUserId;

		const profileMutualGuilds = profile?.mutualGuilds ?? [];
		type MutualGuildDisplay = {
			guild: GuildRecord;
			nick: string | null;
		};
		const mutualGuildDisplayItems = useMemo(() => {
			return profileMutualGuilds
				.map((mutualGuild) => {
					const guild = GuildStore.getGuild(mutualGuild.id);
					if (!guild) {
						return null;
					}
					return {guild, nick: mutualGuild.nick};
				})
				.filter((item): item is MutualGuildDisplay => item !== null);
		}, [profileMutualGuilds]);
		const mutualGroups = ChannelStore.dmChannels.filter(
			(channel) => channel.isGroupDM() && channel.recipientIds.includes(user.id),
		);

		const [mutualView, setMutualView] = useState<MutualView>(
			showMutualFriendsTab ? 'mutual_friends' : 'mutual_communities',
		);

		const mutualMenuButtonRef = useRef<HTMLButtonElement>(null);
		const [isMutualMenuOpen, setIsMutualMenuOpen] = useState(false);

		const getMutualViewLabel = useCallback(
			(view: MutualView) => {
				switch (view) {
					case 'mutual_friends': {
						const count = mutualFriendsCount;
						return t`Mutual Friends (${count})`;
					}
					case 'mutual_groups': {
						const count = mutualGroups.length;
						return t`Mutual Groups (${count})`;
					}
					default: {
						const count = profileMutualGuilds.length;
						return t`Mutual Communities (${count})`;
					}
				}
			},
			[t, mutualFriendsCount, mutualGroups.length, profileMutualGuilds.length],
		);

		const openMutualMenu = useCallback(
			(event: React.MouseEvent<HTMLButtonElement>) => {
				const contextMenu = ContextMenuStore.contextMenu;
				const isOpen = !!contextMenu && contextMenu.target.target === event.currentTarget;

				if (isOpen) {
					return;
				}

				setActiveTab('mutual');

				ContextMenuActionCreators.openFromEvent(event, () => (
					<MenuGroup>
						{showMutualFriendsTab && (
							<MenuItemRadio
								selected={mutualView === 'mutual_friends'}
								closeOnSelect
								onSelect={() => setMutualView('mutual_friends')}
							>
								{getMutualViewLabel('mutual_friends')}
							</MenuItemRadio>
						)}
						<MenuItemRadio
							selected={mutualView === 'mutual_communities'}
							closeOnSelect
							onSelect={() => setMutualView('mutual_communities')}
						>
							{getMutualViewLabel('mutual_communities')}
						</MenuItemRadio>
						<MenuItemRadio
							selected={mutualView === 'mutual_groups'}
							closeOnSelect
							onSelect={() => setMutualView('mutual_groups')}
						>
							{getMutualViewLabel('mutual_groups')}
						</MenuItemRadio>
					</MenuGroup>
				));
			},
			[getMutualViewLabel, mutualView, showMutualFriendsTab],
		);

		const mutualTabLabelText = useMemo(() => getMutualViewLabel(mutualView), [getMutualViewLabel, mutualView]);

		const tabs = useMemo(
			() =>
				[
					{key: 'overview', label: t`Overview`},
					{key: 'mutual', label: mutualTabLabelText},
				] as Array<{key: 'overview' | 'mutual'; label: React.ReactNode}>,
			[t, mutualTabLabelText],
		);

		useEffect(() => {
			setMutualView(showMutualFriendsTab ? 'mutual_friends' : 'mutual_communities');
		}, [showMutualFriendsTab, user.id]);

		useEffect(() => {
			if (!showMutualFriendsTab && mutualView === 'mutual_friends') {
				setMutualView('mutual_communities');
			}
		}, [mutualView, showMutualFriendsTab]);

		const handleMutualFriendClick = (friendId: string) => {
			const currentModal = ModalStore.getModal();
			if (currentModal) {
				ModalActionCreators.update(currentModal.key, () =>
					modal(() => <UserProfileModal userId={friendId} guildId={profile?.guildId ?? undefined} />),
				);
			}
		};

		const handleMutualFriendContextMenu = (event: React.MouseEvent, friend: UserRecord) => {
			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<>
					{profile?.guildId ? (
						<GuildMemberContextMenu user={friend} guildId={profile.guildId} onClose={onClose} />
					) : (
						<UserContextMenu user={friend} onClose={onClose} />
					)}
				</>
			));
		};

		const handleGuildClick = (guild: GuildRecord) => {
			ModalActionCreators.pop();
			const selectedChannel = SelectedChannelStore.selectedChannelIds.get(guild.id);
			NavigationActionCreators.selectGuild(guild.id, selectedChannel);
		};

		const handleGuildContextMenu = (event: React.MouseEvent, guild: GuildRecord) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, (props) => (
				<GuildContextMenu guild={guild} onClose={props.onClose} />
			));
		};

		const handleGroupClick = (group: ChannelRecord) => {
			ModalActionCreators.pop();
			NavigationActionCreators.selectChannel(ME, group.id);
		};

		const handleGroupContextMenu = (event: React.MouseEvent, group: ChannelRecord) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<GroupDMContextMenu channel={group} onClose={onClose} />
			));
		};

		const [contextMenuTarget, setContextMenuTarget] = useState<ContextMenuTargetElement | null>(null);

		useEffect(() => {
			const disposer = autorun(() => {
				const contextMenu = ContextMenuStore.contextMenu;
				setContextMenuTarget(contextMenu?.target.target ?? null);
			});

			return () => {
				disposer();
			};
		}, []);

		const isContextMenuOpenFor = (target: EventTarget | null) => {
			if (!contextMenuTarget || !target) {
				return false;
			}
			if (target === contextMenuTarget) {
				return true;
			}
			if (target instanceof Node && isContextMenuNodeTarget(contextMenuTarget)) {
				return target.contains(contextMenuTarget);
			}
			return false;
		};

		useEffect(() => {
			const disposer = autorun(() => {
				const contextMenu = ContextMenuStore.contextMenu;
				const isOpen =
					!!contextMenu && !!mutualMenuButtonRef.current && contextMenu.target.target === mutualMenuButtonRef.current;
				setIsMutualMenuOpen(isOpen);
			});

			return () => {
				disposer();
			};
		}, []);

		const renderMutualFriendsList = useCallback(() => {
			const friends = profile?.mutualFriends ?? [];

			return (
				<div className={userProfileModalStyles.mutualFriendsList}>
					{friends.map((friend: UserPartial) => {
						const friendRecord = new UserRecord(friend);
						return (
							<MutualFriendItem
								key={friendRecord.id}
								user={friendRecord}
								profile={profile}
								onClick={() => handleMutualFriendClick(friendRecord.id)}
								onContextMenu={(e) => handleMutualFriendContextMenu(e, friendRecord)}
								isContextMenuOpen={isContextMenuOpenFor}
							/>
						);
					})}
					{friends.length === 0 && (
						<div className={userProfileModalStyles.emptyState}>
							<UsersThreeIcon className={userProfileModalStyles.emptyStateIcon} />
							<Trans>No mutual friends found.</Trans>
						</div>
					)}
				</div>
			);
		}, [handleMutualFriendClick, profile, isContextMenuOpenFor]);

		const renderMutualGroupsList = useCallback(() => {
			return (
				<div className={userProfileModalStyles.mutualFriendsList}>
					{mutualGroups.map((group) => (
						<MutualGroupItem
							key={group.id}
							group={group}
							onClick={() => handleGroupClick(group)}
							onContextMenu={(e) => handleGroupContextMenu(e, group)}
							isContextMenuOpen={isContextMenuOpenFor}
						/>
					))}
					{mutualGroups.length === 0 && (
						<div className={userProfileModalStyles.emptyState}>
							<UsersThreeIcon className={userProfileModalStyles.emptyStateIcon} />
							<Trans>No mutual groups found.</Trans>
						</div>
					)}
				</div>
			);
		}, [handleGroupClick, handleGroupContextMenu, isContextMenuOpenFor, mutualGroups]);

		const renderMutualGuildsList = useCallback(() => {
			return (
				<div className={userProfileModalStyles.mutualFriendsList}>
					{mutualGuildDisplayItems.map(({guild, nick}) => (
						<MutualGuildItem
							key={guild.id}
							guild={guild}
							nick={nick}
							onClick={() => handleGuildClick(guild)}
							onContextMenu={(e) => handleGuildContextMenu(e, guild)}
							isContextMenuOpen={isContextMenuOpenFor}
						/>
					))}
					{profileMutualGuilds.length === 0 && (
						<div className={userProfileModalStyles.emptyState}>
							<UsersThreeIcon className={userProfileModalStyles.emptyStateIcon} />
							<Trans>No mutual communities found.</Trans>
						</div>
					)}
				</div>
			);
		}, [
			handleGuildClick,
			handleGuildContextMenu,
			isContextMenuOpenFor,
			mutualGuildDisplayItems,
			profileMutualGuilds.length,
		]);

		const renderMutualTabContent = useCallback(() => {
			switch (mutualView) {
				case 'mutual_friends':
					return showMutualFriendsTab ? renderMutualFriendsList() : renderMutualGuildsList();
				case 'mutual_groups':
					return renderMutualGroupsList();
				default:
					return renderMutualGuildsList();
			}
		}, [mutualView, renderMutualFriendsList, renderMutualGroupsList, renderMutualGuildsList, showMutualFriendsTab]);

		const renderActiveTabContent = useCallback(() => {
			switch (activeTab) {
				case 'overview':
					return (
						<ProfileContent
							profile={profile}
							user={user}
							userNote={userNote}
							autoFocusNote={autoFocusNote}
							noteRef={noteRef}
						/>
					);
				default:
					return renderMutualTabContent();
			}
		}, [activeTab, autoFocusNote, noteRef, profile, renderMutualTabContent, user, userNote]);

		const reactId = useId();
		const safeId = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
		const maskId = `uid_${safeId}`;

		return (
			<>
				<header>
					<div className={userProfileModalStyles.bannerContainer}>
						<svg className={userProfileModalStyles.bannerMask} viewBox="0 0 600 210" preserveAspectRatio="none">
							<mask id={maskId}>
								<rect fill="white" x="0" y="0" width="600" height="210" />
								<circle fill="black" cx="82" cy="210" r="66" />
							</mask>

							<foreignObject x="0" y="0" width="600" height="210" overflow="visible" mask={`url(#${maskId})`}>
								<div
									className={userProfileModalStyles.bannerImage}
									style={{
										backgroundColor: bannerColor,
										...(bannerUrl ? {backgroundImage: `url(${bannerUrl})`} : {}),
									}}
								/>
							</foreignObject>
						</svg>
					</div>

					<div className={userProfileModalStyles.headerContainer}>
						<div className={userProfileModalStyles.avatarContainer}>
							<StatusAwareAvatar size={120} user={user} avatarUrl={avatarUrl} hoverAvatarUrl={hoverAvatarUrl} />
						</div>

						<div className={userProfileModalStyles.actionButtonsContainer}>{renderActionButtons()}</div>
					</div>
				</header>

				<div className={userProfileModalStyles.contentContainer}>
					<UserInfo
						user={user}
						profile={profile}
						guildId={profile.guildId ?? undefined}
						showProfileDataWarning={showProfileDataWarning}
					/>

					{!isCurrentUser ? (
						<div className={userProfileModalStyles.tabsWrapper}>
							<Tabs
								activeTab={activeTab}
								onTabChange={handleTabChange}
								tabs={tabs}
								renderTabSibling={(tab) =>
									tab === 'mutual' ? (
										<FocusRing offset={-2}>
											<button
												ref={mutualMenuButtonRef}
												type="button"
												className={clsx(
													userProfileModalStyles.mutualMenuButton,
													isMutualMenuOpen && userProfileModalStyles.mutualMenuButtonActive,
												)}
												onClick={(event) => openMutualMenu(event)}
												aria-label={t`Select mutual view`}
											>
												<CaretDownIcon
													weight="bold"
													className={clsx(
														userProfileModalStyles.mutualMenuIcon,
														isMutualMenuOpen && userProfileModalStyles.mutualMenuIconOpen,
													)}
												/>
											</button>
										</FocusRing>
									) : null
								}
							/>
						</div>
					) : (
						<div className={userProfileModalStyles.separator} />
					)}

					<div className={userProfileModalStyles.profileContentWrapper}>
						<Scroller className={userProfileModalStyles.scrollerFullHeight} key="user-profile-modal-content-scroller">
							{renderActiveTabContent()}
						</Scroller>
					</div>
				</div>
			</>
		);
	},
);

const MutualFriendItem = ({
	user,
	profile,
	onClick,
	onContextMenu,
	isContextMenuOpen,
}: {
	user: UserRecord;
	profile: ProfileRecord | null;
	onClick: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	isContextMenuOpen: (target: EventTarget | null) => boolean;
}) => {
	const itemRef = useRef<HTMLDivElement>(null);
	const isActive = isContextMenuOpen(itemRef.current);

	return (
		<div
			ref={itemRef}
			className={clsx(userProfileModalStyles.mutualFriendItem, isActive && userProfileModalStyles.active)}
			onClick={onClick}
			onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
			onContextMenu={onContextMenu}
			role="button"
			tabIndex={0}
		>
			<StatusAwareAvatar size={40} user={user} />
			<div className={userProfileModalStyles.mutualFriendInfo}>
				<span className={userProfileModalStyles.mutualFriendName}>
					{NicknameUtils.getNickname(user, profile?.guildId ?? undefined)}
				</span>
				<span className={userProfileModalStyles.mutualFriendUsername}>{user.tag}</span>
			</div>
		</div>
	);
};

const MutualGuildItem = ({
	guild,
	nick,
	onClick,
	onContextMenu,
	isContextMenuOpen,
}: {
	guild: GuildRecord;
	nick: string | null;
	onClick: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	isContextMenuOpen: (target: EventTarget | null) => boolean;
}) => {
	const itemRef = useRef<HTMLDivElement>(null);
	const isActive = isContextMenuOpen(itemRef.current);

	return (
		<div
			ref={itemRef}
			className={clsx(userProfileModalStyles.mutualFriendItem, isActive && userProfileModalStyles.active)}
			onClick={onClick}
			onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
			onContextMenu={onContextMenu}
			role="button"
			tabIndex={0}
		>
			<GuildIcon
				id={guild.id}
				name={guild.name}
				icon={guild.icon}
				className={userProfileModalStyles.mutualGuildIcon}
				sizePx={40}
			/>
			<div className={userProfileModalStyles.mutualFriendInfo}>
				<span className={userProfileModalStyles.mutualFriendName}>{guild.name}</span>
				{nick && <span className={userProfileModalStyles.mutualFriendUsername}>{nick}</span>}
			</div>
		</div>
	);
};

const MutualGroupItem = ({
	group,
	onClick,
	onContextMenu,
	isContextMenuOpen,
}: {
	group: ChannelRecord;
	onClick: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	isContextMenuOpen: (target: EventTarget | null) => boolean;
}) => {
	const {t} = useLingui();
	const itemRef = useRef<HTMLDivElement>(null);
	const isActive = isContextMenuOpen(itemRef.current);
	const memberCount = group.recipientIds.length + 1;
	const memberLabel = memberCount === 1 ? t`${memberCount} Member` : t`${memberCount} Members`;

	return (
		<div
			ref={itemRef}
			className={clsx(userProfileModalStyles.mutualFriendItem, isActive && userProfileModalStyles.active)}
			onClick={onClick}
			onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
			onContextMenu={onContextMenu}
			role="button"
			tabIndex={0}
		>
			<GroupDMAvatar channel={group} size={40} />
			<div className={userProfileModalStyles.mutualFriendInfo}>
				<span className={userProfileModalStyles.mutualFriendName}>{ChannelUtils.getDMDisplayName(group)}</span>
				<span className={userProfileModalStyles.mutualFriendUsername}>{memberLabel}</span>
			</div>
		</div>
	);
};

export const UserProfileModal: UserProfileModalComponent = observer(
	({userId, guildId, autoFocusNote, disableEditProfile, previewOverrides, previewUser}) => {
		const {t, i18n} = useLingui();

		const storeUser = UserStore.getUser(userId);
		const user = previewUser ?? storeUser;

		const fallbackUser = useMemo(
			() =>
				new UserRecord({
					id: userId,
					username: userId,
					discriminator: '0000',
					global_name: null,
					avatar: null,
					avatar_color: null,
					flags: 0,
				}),
			[userId],
		);

		const displayUser = user ?? fallbackUser;

		const fallbackProfile = useMemo(() => createMockProfile(fallbackUser), [fallbackUser]);
		const mockProfile = useMemo(() => (user ? createMockProfile(user) : null), [user]);
		const initialProfile = useMemo(() => UserProfileStore.getProfile(userId, guildId), [userId, guildId]);
		const [profile, setProfile] = useState<ProfileRecord | null>(initialProfile);
		const [profileLoadError, setProfileLoadError] = useState(false);
		const [showGlobalProfile, setShowGlobalProfile] = useState(false);
		const [isProfileLoading, setIsProfileLoading] = useState(() => !previewUser && !initialProfile);
		const userNote = UserNoteStore.getUserNote(userId);
		const isCurrentUser = user?.id === AuthenticationStore.currentUserId;
		const relationship = RelationshipStore.getRelationship(userId);
		const relationshipType = relationship?.type;
		const isBlocked = relationshipType === RelationshipTypes.BLOCKED;
		const isUserBot = user?.bot ?? false;
		const isFriendlyBot =
			isUserBot && (displayUser.flags & PublicUserFlags.FRIENDLY_BOT) === PublicUserFlags.FRIENDLY_BOT;
		const noteRef = useRef<HTMLTextAreaElement | null>(null);
		const moreOptionsButtonRef = useRef<HTMLButtonElement>(null);
		const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

		useEffect(() => {
			setProfile(initialProfile);
			setIsProfileLoading(!previewUser && !initialProfile);
		}, [initialProfile, previewUser]);

		useEffect(() => {
			if (previewUser || profile) {
				setIsProfileLoading(false);
				setProfileLoadError(false);
				return;
			}

			let cancelled = false;
			setIsProfileLoading(true);
			setProfileLoadError(false);

			UserProfileActionCreators.fetch(userId, guildId)
				.then(() => {
					if (cancelled) return;
					const fetchedProfile = UserProfileStore.getProfile(userId, guildId);
					if (fetchedProfile) {
						setProfile(fetchedProfile);
					}
					setProfileLoadError(false);
				})
				.catch((error) => {
					if (cancelled) return;
					logger.error('Failed to fetch user profile:', error);
					setProfileLoadError(true);
				})
				.finally(() => {
					if (cancelled) return;
					setIsProfileLoading(false);
				});

			return () => {
				cancelled = true;
			};
		}, [userId, guildId, previewUser, profile]);

		useEffect(() => {
			const handleContextMenuChange = () => {
				const contextMenu = ContextMenuStore.contextMenu;
				const isOpen =
					!!contextMenu && !!moreOptionsButtonRef.current && contextMenu.target.target === moreOptionsButtonRef.current;

				setIsMoreMenuOpen(isOpen);
			};

			const disposer = autorun(handleContextMenuChange);
			return () => disposer();
		}, []);

		useEffect(() => {
			if (!guildId || !userId || previewUser) {
				return;
			}

			const hasMember = GuildMemberStore.getMember(guildId, userId);
			if (!hasMember) {
				MemberPresenceSubscriptionStore.touchMember(guildId, userId);
				GuildMemberStore.fetchMembers(guildId, {userIds: [userId]}).catch((error) => {
					logger.error('Failed to fetch guild member:', error);
				});
			} else {
				MemberPresenceSubscriptionStore.touchMember(guildId, userId);
			}

			return () => {
				MemberPresenceSubscriptionStore.unsubscribe(guildId, userId);
			};
		}, [guildId, userId, previewUser]);

		const hasGuildProfile = !!(profile?.guildId && profile?.guildMemberProfile);
		const shouldShowProfileDataWarning = profileLoadError || DeveloperOptionsStore.forceProfileDataWarning;

		const displayProfile = useMemo((): ProfileRecord | null => {
			if (!profile) return null;
			if (showGlobalProfile && hasGuildProfile) {
				return profile.withUpdates({guild_member_profile: null}).withGuildId(null);
			}
			return profile;
		}, [profile, showGlobalProfile, hasGuildProfile]);

		const screenReaderLabel = useMemo(() => {
			if (!displayUser) return t`User Profile`;
			const tag = displayUser.tag;
			return t`User Profile: ${tag}`;
		}, [displayUser, t]);

		const shouldShowSpinner = isProfileLoading || !user;
		const effectiveProfile: ProfileRecord | null = displayProfile ?? profile ?? mockProfile;
		const resolvedProfile: ProfileRecord = effectiveProfile ?? fallbackProfile;

		const handleEditProfile = () => {
			ModalActionCreators.pop();
			ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="my_profile" />));
		};

		const handleMessage = async () => {
			try {
				ModalActionCreators.pop();
				await PrivateChannelActionCreators.openDMChannel(userId);
			} catch (error) {
				logger.error('Failed to open DM channel:', error);
			}
		};

		const handleOpenBlockedDm = () => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Open DM`}
						description={t`You blocked ${displayUser.username}. You won't be able to send messages unless you unblock them.`}
						primaryText={t`Open DM`}
						primaryVariant="primary"
						onPrimary={handleMessage}
					/>
				)),
			);
		};

		const handleSendFriendRequest = () => {
			RelationshipActionUtils.sendFriendRequest(i18n, userId);
		};

		const handleAcceptFriendRequest = () => {
			RelationshipActionUtils.acceptFriendRequest(i18n, userId);
		};

		const handleRemoveFriend = () => {
			RelationshipActionUtils.showRemoveFriendConfirmation(i18n, displayUser);
		};

		const handleBlockUser = () => {
			RelationshipActionUtils.showBlockUserConfirmation(i18n, displayUser);
		};

		const handleUnblockUser = () => {
			RelationshipActionUtils.showUnblockUserConfirmation(i18n, displayUser);
		};

		const handleCancelFriendRequest = () => {
			RelationshipActionUtils.cancelFriendRequest(i18n, userId);
		};

		const handleStartVoiceCall = async (event?: PressEvent) => {
			try {
				const channelId = await PrivateChannelActionCreators.ensureDMChannel(userId);
				await CallUtils.checkAndStartCall(channelId, event?.shiftKey ?? false);
			} catch (error) {
				logger.error('Failed to start voice call:', error);
			}
		};

		const handleStartVideoCall = async (event?: PressEvent) => {
			try {
				const channelId = await PrivateChannelActionCreators.ensureDMChannel(userId);
				await CallUtils.checkAndStartCall(channelId, event?.shiftKey ?? false);
			} catch (error) {
				logger.error('Failed to start video call:', error);
			}
		};

		const handleReportUser = () => {
			const context: IARContext = {
				type: 'user',
				user: displayUser,
				guildId,
			};
			ModalActionCreators.push(modal(() => <IARModal context={context} />));
		};

		const handleCopyFluxerTag = () => {
			TextCopyActionCreators.copy(i18n, `${displayUser.username}#${displayUser.discriminator}`, true);
		};

		const handleCopyUserId = () => {
			TextCopyActionCreators.copy(i18n, displayUser.id, true);
		};

		const handleMoreOptionsPointerDown = (event: React.PointerEvent) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === moreOptionsButtonRef.current;

			if (isOpen) {
				event.stopPropagation();
				event.preventDefault();
				ContextMenuActionCreators.close();
			}
		};

		const renderBlockMenuItem = (onClose: () => void) => {
			switch (relationshipType) {
				case RelationshipTypes.BLOCKED:
					return (
						<MenuItem
							icon={<ProhibitIcon />}
							onClick={() => {
								handleUnblockUser();
								onClose();
							}}
						>
							{t`Unblock`}
						</MenuItem>
					);
				default:
					return (
						<MenuItem
							icon={<ProhibitIcon />}
							onClick={() => {
								handleBlockUser();
								onClose();
							}}
							danger
						>
							{t`Block`}
						</MenuItem>
					);
			}
		};

		const openMoreOptionsMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
			const contextMenu = ContextMenuStore.contextMenu;
			const isOpen = !!contextMenu && contextMenu.target.target === event.currentTarget;

			if (isOpen) {
				return;
			}

			ContextMenuActionCreators.openFromEvent(event, (props) => (
				<>
					{hasGuildProfile && (
						<MenuGroup>
							<MenuItem
								icon={<GlobeIcon />}
								onClick={() => {
									setShowGlobalProfile(!showGlobalProfile);
									props.onClose();
								}}
							>
								{showGlobalProfile ? t`View Community Profile` : t`View Global Profile`}
							</MenuItem>
						</MenuGroup>
					)}
					{!isCurrentUser && !isUserBot && relationshipType === RelationshipTypes.FRIEND && (
						<MenuGroup>
							<MenuItem
								icon={<VideoCameraIcon />}
								onClick={(pressEvent: PressEvent) => {
									handleStartVoiceCall(pressEvent);
									props.onClose();
								}}
							>
								{t`Start Voice Call`}
							</MenuItem>
							<MenuItem
								icon={<VideoCameraIcon />}
								onClick={(pressEvent: PressEvent) => {
									handleStartVideoCall(pressEvent);
									props.onClose();
								}}
							>
								{t`Start Video Call`}
							</MenuItem>
						</MenuGroup>
					)}
					<MenuGroup>
						<MenuItem
							icon={<CopyIcon />}
							onClick={() => {
								handleCopyFluxerTag();
								props.onClose();
							}}
						>
							{t`Copy FluxerTag`}
						</MenuItem>
						<MenuItem
							icon={<IdentificationCardIcon />}
							onClick={() => {
								handleCopyUserId();
								props.onClose();
							}}
						>
							{t`Copy User ID`}
						</MenuItem>
					</MenuGroup>
					{!isCurrentUser && relationshipType === RelationshipTypes.FRIEND && (
						<MenuGroup>
							<MenuItem
								icon={<UserMinusIcon className={userProfileModalStyles.menuIcon} weight="fill" />}
								onClick={() => {
									handleRemoveFriend();
									props.onClose();
								}}
								danger
							>
								{t`Remove Friend`}
							</MenuItem>
						</MenuGroup>
					)}
					{!isCurrentUser && (
						<MenuGroup>
							<MenuItem
								icon={<FlagIcon />}
								onClick={() => {
									handleReportUser();
									props.onClose();
								}}
								danger
							>
								{t`Report User`}
							</MenuItem>
							{renderBlockMenuItem(props.onClose)}
						</MenuGroup>
					)}
				</>
			));
		};

		const renderActionButtons = () => {
			const currentUserUnclaimed = !(UserStore.currentUser?.isClaimed() ?? true);
			if (isCurrentUser && disableEditProfile) {
				return (
					<div className={userProfileModalStyles.actionButtons}>
						<Tooltip text={t`You can't befriend yourself`} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									leftIcon={<UserPlusIcon className={userProfileModalStyles.buttonIcon} />}
									disabled={true}
								>
									<Trans>Add Friend</Trans>
								</Button>
							</div>
						</Tooltip>
						<Tooltip text={t`You can't message yourself`} maxWidth="xl">
							<div>
								<Button
									small={true}
									leftIcon={<ChatTeardropIcon className={userProfileModalStyles.buttonIcon} />}
									disabled={true}
								>
									<Trans>Message</Trans>
								</Button>
							</div>
						</Tooltip>
					</div>
				);
			}

			if (isCurrentUser && !disableEditProfile) {
				return (
					<div className={userProfileModalStyles.actionButtons}>
						<Button
							small={true}
							leftIcon={<PencilIcon className={userProfileModalStyles.buttonIcon} />}
							onClick={handleEditProfile}
						>
							<Trans>Edit Profile</Trans>
						</Button>
						<Button
							ref={moreOptionsButtonRef}
							small={true}
							square={true}
							variant="secondary"
							icon={<DotsThreeIcon className={userProfileModalStyles.buttonIcon} weight="bold" />}
							onPointerDownCapture={handleMoreOptionsPointerDown}
							onClick={openMoreOptionsMenu}
							className={isMoreMenuOpen ? userProfileModalStyles.moreMenuButtonActive : undefined}
						/>
					</div>
				);
			}

			const renderPrimaryActionButton = () => {
				if (isUserBot && !isFriendlyBot) {
					return null;
				}

				if (relationshipType === RelationshipTypes.FRIEND) {
					return (
						<Tooltip text={t`Remove Friend`} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									square={true}
									icon={<UserMinusIcon className={userProfileModalStyles.buttonIcon} />}
									onClick={handleRemoveFriend}
								/>
							</div>
						</Tooltip>
					);
				}
				if (relationshipType === RelationshipTypes.BLOCKED) {
					return (
						<Tooltip text={t`Unblock User`} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									square={true}
									icon={<ProhibitIcon className={userProfileModalStyles.buttonIcon} />}
									onClick={handleUnblockUser}
								/>
							</div>
						</Tooltip>
					);
				}
				if (relationshipType === RelationshipTypes.INCOMING_REQUEST) {
					return (
						<Tooltip text={t`Accept Friend Request`} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									square={true}
									icon={<CheckCircleIcon className={userProfileModalStyles.buttonIcon} />}
									onClick={handleAcceptFriendRequest}
								/>
							</div>
						</Tooltip>
					);
				}
				if (relationshipType === RelationshipTypes.OUTGOING_REQUEST) {
					return (
						<Tooltip text={t`Cancel Friend Request`} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									square={true}
									icon={<ClockCounterClockwiseIcon className={userProfileModalStyles.buttonIcon} />}
									onClick={handleCancelFriendRequest}
								/>
							</div>
						</Tooltip>
					);
				}
				if (relationshipType === undefined && (!isUserBot || isFriendlyBot)) {
					const tooltipText = currentUserUnclaimed
						? t`Claim your account to send friend requests.`
						: t`Send Friend Request`;
					return (
						<Tooltip text={tooltipText} maxWidth="xl">
							<div>
								<Button
									variant="secondary"
									small={true}
									square={true}
									icon={<UserPlusIcon className={userProfileModalStyles.buttonIcon} />}
									onClick={handleSendFriendRequest}
									disabled={currentUserUnclaimed}
								/>
							</div>
						</Tooltip>
					);
				}
				return null;
			};

			return (
				<div className={userProfileModalStyles.actionButtons}>
					<Button
						small={true}
						leftIcon={<ChatTeardropIcon className={userProfileModalStyles.buttonIcon} />}
						onClick={isBlocked ? handleOpenBlockedDm : handleMessage}
					>
						{isBlocked ? <Trans>Open DM</Trans> : <Trans>Message</Trans>}
					</Button>
					{renderPrimaryActionButton()}
					<Button
						ref={moreOptionsButtonRef}
						small={true}
						square={true}
						variant="secondary"
						icon={<DotsThreeIcon className={userProfileModalStyles.buttonIcon} weight="bold" />}
						onPointerDownCapture={handleMoreOptionsPointerDown}
						onClick={openMoreOptionsMenu}
						className={isMoreMenuOpen ? userProfileModalStyles.moreMenuButtonActive : undefined}
					/>
				</div>
			);
		};

		const borderProfile = displayProfile?.getEffectiveProfile() ?? null;
		const borderColor = getUserAccentColor(displayUser, borderProfile?.accent_color);

		return (
			<Modal.Root
				size="medium"
				initialFocusRef={autoFocusNote ? noteRef : undefined}
				className={userProfileModalStyles.modalRoot}
			>
				<Modal.ScreenReaderLabel text={screenReaderLabel} />
				<div className={userProfileModalStyles.modalContainer} style={{borderColor}}>
					{shouldShowSpinner ? (
						<div className={userProfileModalStyles.loadingScreen}>
							<Spinner size="large" />
						</div>
					) : (
						<ProfileModalContent
							key={displayUser.id}
							profile={resolvedProfile}
							user={displayUser}
							userNote={userNote}
							autoFocusNote={autoFocusNote}
							noteRef={noteRef}
							renderActionButtons={renderActionButtons}
							showProfileDataWarning={shouldShowProfileDataWarning}
							previewOverrides={previewOverrides}
						/>
					)}
				</div>
			</Modal.Root>
		);
	},
);
