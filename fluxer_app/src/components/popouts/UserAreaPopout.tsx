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

import {getStatusTypeLabel} from '@app/AppConstants';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PopoutActionCreators from '@app/actions/PopoutActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import {getAccountAvatarUrl} from '@app/components/accounts/AccountListItem';
import AccountSwitcherModal from '@app/components/accounts/AccountSwitcherModal';
import {CustomStatusDisplay} from '@app/components/common/custom_status_display/CustomStatusDisplay';
import {CustomStatusModal} from '@app/components/modals/CustomStatusModal';
import {UserProfileModal} from '@app/components/modals/UserProfileModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import styles from '@app/components/popouts/UserAreaPopout.module.css';
import {UserProfileBadges} from '@app/components/popouts/UserProfileBadges';
import userProfilePopoutStyles from '@app/components/popouts/UserProfilePopout.module.css';
import {UserProfilePreviewBio} from '@app/components/popouts/UserProfileShared';
import {ProfileCardBanner} from '@app/components/profile/profile_card/ProfileCardBanner';
import {ProfileCardContent} from '@app/components/profile/profile_card/ProfileCardContent';
import {ProfileCardFooter} from '@app/components/profile/profile_card/ProfileCardFooter';
import {ProfileCardLayout} from '@app/components/profile/profile_card/ProfileCardLayout';
import {ProfileCardUserInfo} from '@app/components/profile/profile_card/ProfileCardUserInfo';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import FocusRingScope from '@app/components/uikit/focus_ring/FocusRingScope';
import {MockAvatar} from '@app/components/uikit/MockAvatar';
import {Popout} from '@app/components/uikit/popout/Popout';
import {StatusIndicator} from '@app/components/uikit/StatusIndicator';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {
	getFiniteTimeWindowPresets,
	minutesToMs,
	TIME_WINDOW_FOR_LABEL_MESSAGES,
	type TimeWindowKey,
	type TimeWindowPreset,
} from '@app/constants/TimeWindowPresets';
import {useAutoplayExpandedProfileAnimations} from '@app/hooks/useAutoplayExpandedProfileAnimations';
import {normalizeCustomStatus} from '@app/lib/CustomStatus';
import type {Account} from '@app/lib/SessionManager';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import PresenceStore from '@app/stores/PresenceStore';
import StatusExpiryStore from '@app/stores/StatusExpiryStore';
import UserProfileStore from '@app/stores/UserProfileStore';
import UserStore from '@app/stores/UserStore';
import {getUserAccentColor} from '@app/utils/AccentColorUtils';
import {useAccountSwitcherLogic} from '@app/utils/accounts/AccountSwitcherModalUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import * as ProfileDisplayUtils from '@app/utils/ProfileDisplayUtils';
import {createMockProfile} from '@app/utils/ProfileUtils';
import {MEDIA_PROXY_PROFILE_BANNER_SIZE_POPOUT} from '@fluxer/constants/src/MediaProxyAssetSizes';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import type {MessageDescriptor} from '@lingui/core';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	CaretRightIcon,
	CheckIcon,
	CopyIcon,
	GearIcon,
	IdentificationBadgeIcon,
	PencilIcon,
	SmileyIcon,
	UsersThreeIcon,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useMemo, useRef} from 'react';

const STATUS_ORDER = [StatusTypes.ONLINE, StatusTypes.IDLE, StatusTypes.DND, StatusTypes.INVISIBLE];

interface UserStatusExpiryOption {
	id: TimeWindowKey;
	key: TimeWindowKey;
	label: MessageDescriptor;
	durationMs: number | null;
}

const STATUS_DESCRIPTIONS: Record<(typeof STATUS_ORDER)[number], React.ReactNode | null> = {
	[StatusTypes.ONLINE]: null,
	[StatusTypes.IDLE]: null,
	[StatusTypes.DND]: <Trans>You won&apos;t receive notifications on desktop</Trans>,
	[StatusTypes.INVISIBLE]: <Trans>You&apos;ll appear offline</Trans>,
};

interface StatusMenuProps {
	onSelectStatus: (status: (typeof STATUS_ORDER)[number], durationMs: number | null) => void;
	onClose: () => void;
}

const StatusMenu = observer(({onSelectStatus, onClose}: StatusMenuProps) => {
	const {i18n} = useLingui();
	const isDeveloper = DeveloperModeStore.isDeveloper;
	const statusExpiryOptions = useMemo<ReadonlyArray<UserStatusExpiryOption>>(
		() =>
			getFiniteTimeWindowPresets({includeDeveloperOptions: isDeveloper}).map((preset: TimeWindowPreset) => ({
				id: preset.key,
				key: preset.key,
				label: TIME_WINDOW_FOR_LABEL_MESSAGES[preset.key as Exclude<TimeWindowKey, 'never'>],
				durationMs: minutesToMs(preset.minutes),
			})),
		[isDeveloper],
	);

	const handleSelect = (status: (typeof STATUS_ORDER)[number], durationMs: number | null) => {
		onSelectStatus(status, durationMs);
		onClose();
		PopoutActionCreators.close();
	};

	return (
		<div className={styles.statusMenu}>
			{STATUS_ORDER.map((status) => {
				const hasExpiryOptions = status !== StatusTypes.ONLINE;
				const description = STATUS_DESCRIPTIONS[status];

				const rowContent = (
					<FocusRing offset={-2}>
						<button type="button" className={styles.statusMenuItem} onClick={() => handleSelect(status, null)}>
							<div className={styles.statusMenuIcon}>
								<StatusIndicator status={status} size={14} monochromeColor="var(--brand-primary-fill)" />
							</div>
							<div className={styles.statusMenuText}>
								<span className={styles.statusMenuLabel}>{getStatusTypeLabel(i18n, status)}</span>
								{description && <span className={styles.statusMenuDescription}>{description}</span>}
							</div>
							{hasExpiryOptions && <CaretRightIcon size={14} weight="bold" className={styles.statusMenuChevron} />}
						</button>
					</FocusRing>
				);

				if (!hasExpiryOptions) {
					return (
						<div key={status} className={styles.statusMenuRow}>
							{rowContent}
						</div>
					);
				}

				return (
					<Popout
						key={status}
						hoverDelay={200}
						position="right-start"
						preventInvert
						offsetMainAxis={8}
						animationType="none"
						render={({onClose: closeExpiry}) => (
							<div className={styles.expiryPopup}>
								{statusExpiryOptions.map((option: UserStatusExpiryOption) => (
									<FocusRing key={option.id} offset={-2}>
										<button
											type="button"
											className={styles.expiryItem}
											onClick={() => {
												handleSelect(status, option.durationMs);
												closeExpiry();
											}}
										>
											<span className={styles.expiryLabel}>{i18n._(option.label)}</span>
										</button>
									</FocusRing>
								))}
							</div>
						)}
					>
						{rowContent}
					</Popout>
				);
			})}
		</div>
	);
});

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	icon: React.ReactNode;
	label: React.ReactNode;
	hint?: React.ReactNode;
	chevron?: boolean;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
	({icon, label, hint, chevron = false, onClick, className, disabled, ...rest}, ref) => (
		<FocusRing offset={-2}>
			<button
				type="button"
				ref={ref}
				disabled={disabled}
				onClick={onClick}
				className={clsx(styles.actionButton, className, disabled && styles.actionButtonDisabled)}
				{...rest}
			>
				<div className={styles.actionIcon} aria-hidden="true">
					{icon}
				</div>
				<div className={styles.actionContent}>
					<span className={styles.actionLabel}>{label}</span>
					{hint && <span className={styles.actionHint}>{hint}</span>}
				</div>
				{chevron && <CaretRightIcon size={14} weight="bold" className={styles.actionChevron} aria-hidden="true" />}
			</button>
		</FocusRing>
	),
);

ActionButton.displayName = 'ActionButton';

interface SwitchAccountsMenuProps {
	accounts: Array<Account>;
	currentAccountId: string | null;
	onSelect: (userId: string) => void;
	onManage: () => void;
	onClose: () => void;
}

const SwitchAccountsMenu = observer(
	({accounts, currentAccountId, onSelect, onManage, onClose}: SwitchAccountsMenuProps) => {
		return (
			<div className={styles.switchMenu}>
				<div className={styles.switchMenuList}>
					{accounts.map((account) => {
						const isCurrent = account.userId === currentAccountId;
						const avatarUrl = getAccountAvatarUrl(account);
						const username = account.userData?.username ?? account.userId;
						const discriminator = account.userData?.discriminator ?? '0000';

						return (
							<FocusRing key={account.userId} offset={-2}>
								<button
									type="button"
									className={styles.accountMenuItem}
									onClick={() => {
										if (!isCurrent) {
											onSelect(account.userId);
										}
										onClose();
										PopoutActionCreators.close();
									}}
								>
									<div className={styles.accountMenuAvatar}>
										<MockAvatar size={24} avatarUrl={avatarUrl} userTag={username} />
									</div>
									<div className={styles.accountMenuInfo}>
										<span className={styles.accountMenuTag}>
											{username}
											<span className={styles.accountMenuDiscriminator}>#{discriminator}</span>
										</span>
										{isCurrent && (
											<span className={styles.accountMenuMeta}>
												<Trans>Active account</Trans>
											</span>
										)}
									</div>
									{isCurrent && (
										<div className={styles.accountMenuCheck}>
											<CheckIcon size={10} weight="bold" />
										</div>
									)}
								</button>
							</FocusRing>
						);
					})}
				</div>
				<div className={styles.switchMenuFooter}>
					<FocusRing offset={-2}>
						<button
							type="button"
							className={styles.manageAccountsButton}
							onClick={() => {
								onClose();
								onManage();
							}}
						>
							<GearIcon size={16} weight="bold" />
							<Trans>Manage Accounts</Trans>
						</button>
					</FocusRing>
				</div>
			</div>
		);
	},
);

export const UserAreaPopout = observer(() => {
	const {t, i18n} = useLingui();
	const accountLogic = useAccountSwitcherLogic();
	const currentUser = UserStore.getCurrentUser();
	const currentUserId = currentUser?.id ?? null;
	const status = currentUserId ? PresenceStore.getStatus(currentUserId) : StatusTypes.ONLINE;

	const openEditProfile = useCallback(() => {
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="my_profile" />));
		PopoutActionCreators.close();
	}, []);

	const openUserProfile = useCallback(() => {
		if (!currentUserId) {
			return;
		}
		ModalActionCreators.push(modal(() => <UserProfileModal userId={currentUserId} />));
		PopoutActionCreators.close();
	}, [currentUserId]);

	const openCustomStatus = useCallback(() => {
		ModalActionCreators.push(modal(() => <CustomStatusModal />));
		PopoutActionCreators.close();
	}, []);

	const handleStatusChange = useCallback((statusType: (typeof STATUS_ORDER)[number], durationMs: number | null) => {
		StatusExpiryStore.setActiveStatusExpiry({
			status: statusType,
			durationMs,
		});
	}, []);

	const handleCopyUserId = useCallback(() => {
		if (!currentUserId) {
			return;
		}
		TextCopyActionCreators.copy(i18n, currentUserId);
	}, [currentUserId, i18n]);

	const handleCopyUserTag = useCallback(() => {
		if (!currentUser) {
			return;
		}
		TextCopyActionCreators.copy(i18n, currentUser.tag);
	}, [currentUser, i18n]);

	const openManageAccounts = useCallback(() => {
		ModalActionCreators.push(modal(() => <AccountSwitcherModal />));
		PopoutActionCreators.close();
	}, []);

	const profile = useMemo(() => {
		if (!currentUser) {
			return null;
		}
		return UserProfileStore.getProfile(currentUser.id) ?? createMockProfile(currentUser);
	}, [currentUserId, currentUser]);

	const profileData = useMemo(() => profile?.getEffectiveProfile() ?? null, [profile]);

	const profileContext = useMemo<ProfileDisplayUtils.ProfileDisplayContext | null>(() => {
		if (!currentUser || !profile) {
			return null;
		}
		return {
			user: currentUser,
			profile,
			guildId: undefined,
			guildMember: undefined,
			guildMemberProfile: undefined,
		};
	}, [currentUser, profile]);

	const {avatarUrl, hoverAvatarUrl} = useMemo(() => {
		if (!profileContext) {
			return {avatarUrl: null, hoverAvatarUrl: null};
		}
		return ProfileDisplayUtils.getProfileAvatarUrls(profileContext);
	}, [profileContext]);

	const shouldAutoplayProfileAnimations = useAutoplayExpandedProfileAnimations();
	const bannerUrl = useMemo(() => {
		if (!profileContext) {
			return null;
		}
		return ProfileDisplayUtils.getProfileBannerUrl(
			profileContext,
			undefined,
			shouldAutoplayProfileAnimations,
			MEDIA_PROXY_PROFILE_BANNER_SIZE_POPOUT,
		) as string | null;
	}, [profileContext, shouldAutoplayProfileAnimations]);

	const accentColor = getUserAccentColor(currentUser, profileData?.accent_color);
	const borderColor = accentColor;
	const bannerColor = accentColor;

	const displayName = currentUser ? NicknameUtils.getNickname(currentUser) : '';
	const customStatus = currentUserId ? PresenceStore.getCustomStatus(currentUserId) : null;
	const hasCustomStatus = Boolean(normalizeCustomStatus(customStatus));

	const popoutContainerRef = useRef<HTMLDivElement | null>(null);

	if (!currentUser || !profile) {
		return null;
	}

	return (
		<FocusRingScope containerRef={popoutContainerRef}>
			<div ref={popoutContainerRef} className={styles.container}>
				<ProfileCardLayout borderColor={borderColor}>
					<ProfileCardBanner
						bannerUrl={bannerUrl}
						bannerColor={bannerColor}
						user={currentUser}
						avatarUrl={avatarUrl}
						hoverAvatarUrl={hoverAvatarUrl}
						disablePresence={false}
						isClickable={true}
						onAvatarClick={openUserProfile}
					/>

					<UserProfileBadges user={currentUser} profile={profile} />

					<ProfileCardContent isWebhook={false}>
						<ProfileCardUserInfo
							displayName={displayName}
							user={currentUser}
							pronouns={profileData?.pronouns}
							showUsername={true}
							isClickable={false}
							isWebhook={false}
							usernameActions={
								<Tooltip text={t`Copy Username`} position="top">
									<FocusRing offset={-2}>
										<button
											type="button"
											className={styles.copyUsernameButton}
											onClick={handleCopyUserTag}
											aria-label={t`Copy Username`}
										>
											<CopyIcon size={14} weight="fill" />
										</button>
									</FocusRing>
								</Tooltip>
							}
						/>

						<div className={styles.customStatusRow}>
							{hasCustomStatus ? (
								<CustomStatusDisplay
									customStatus={customStatus}
									className={userProfilePopoutStyles.profileCustomStatusText}
									allowJumboEmoji
									maxLines={0}
									isEditable={true}
									onEdit={openCustomStatus}
									alwaysAnimate={shouldAutoplayProfileAnimations}
								/>
							) : (
								<FocusRing offset={-2}>
									<button type="button" className={styles.customStatusPlaceholder} onClick={openCustomStatus}>
										<SmileyIcon size={14} weight="regular" className={styles.customStatusPlaceholderIcon} />
										<span className={styles.customStatusPlaceholderText}>
											<Trans>Set a custom status</Trans>
										</span>
									</button>
								</FocusRing>
							)}
						</div>

						<UserProfilePreviewBio profile={profile} profileData={profileData} onShowMore={openUserProfile} />
					</ProfileCardContent>

					<ProfileCardFooter>
						<div className={styles.footer}>
							<div className={styles.actionGroup}>
								<Popout
									hoverDelay={0}
									hoverCloseDelay={120}
									position="right-start"
									preventInvert
									toggleClose={false}
									offsetMainAxis={8}
									animationType="none"
									render={({onClose}) => <StatusMenu onSelectStatus={handleStatusChange} onClose={onClose} />}
								>
									<ActionButton
										icon={<StatusIndicator status={status} size={14} />}
										label={getStatusTypeLabel(i18n, status)}
										chevron
									/>
								</Popout>

								<div className={styles.actionDivider} />

								<Popout
									hoverDelay={0}
									hoverCloseDelay={120}
									position="right-start"
									preventInvert
									toggleClose={false}
									offsetMainAxis={8}
									animationType="none"
									render={({onClose}) => (
										<SwitchAccountsMenu
											accounts={accountLogic.accounts}
											currentAccountId={accountLogic.currentAccount?.userId ?? null}
											onSelect={(userId) => {
												accountLogic.handleSwitchAccount(userId);
												PopoutActionCreators.close();
											}}
											onManage={openManageAccounts}
											onClose={onClose}
										/>
									)}
								>
									<ActionButton
										icon={<UsersThreeIcon size={16} weight="bold" />}
										label={<Trans>Switch Accounts</Trans>}
										onClick={openManageAccounts}
										chevron
									/>
								</Popout>

								<div className={styles.actionDivider} />

								<ActionButton
									icon={<IdentificationBadgeIcon size={16} weight="bold" />}
									label={<Trans>Copy User ID</Trans>}
									onClick={handleCopyUserId}
								/>
							</div>

							<Button
								variant="primary"
								fitContainer={true}
								leftIcon={<PencilIcon size={16} weight="bold" />}
								onClick={openEditProfile}
								className={styles.editProfileButton}
							>
								<Trans>Edit Profile</Trans>
							</Button>
						</div>
					</ProfileCardFooter>
				</ProfileCardLayout>
			</div>
		</FocusRingScope>
	);
});
