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
import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as RelationshipActionCreators from '@app/actions/RelationshipActionCreators';
import {ActionButton} from '@app/components/channel/friends/ActionButton';
import styles from '@app/components/channel/friends/FriendListItem.module.css';
import {CustomStatusDisplay} from '@app/components/common/custom_status_display/CustomStatusDisplay';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {StartVideoCallMenuItem, StartVoiceCallMenuItem} from '@app/components/uikit/context_menu/items/CallMenuItems';
import {RemoveFriendMenuItem} from '@app/components/uikit/context_menu/items/RelationshipMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {UserContextMenu} from '@app/components/uikit/context_menu/UserContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {usePresenceCustomStatus} from '@app/hooks/usePresenceCustomStatus';
import {Logger} from '@app/lib/Logger';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import PresenceStore from '@app/stores/PresenceStore';
import UserStore from '@app/stores/UserStore';
import {stopPropagationOnEnterSpace} from '@app/utils/KeyboardUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {isOfflineStatus} from '@fluxer/constants/src/StatusConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {ChatTeardropIcon, CheckIcon, DotsThreeVerticalIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

const logger = new Logger('FriendListItem');

interface FriendAction {
	icon: React.ReactNode;
	tooltip: string;
	onClick: (e: React.MouseEvent) => void;
	className?: string;
	danger?: boolean;
}

interface FriendListItemProps {
	userId: string;
	relationshipType: number;
	openProfile: (userId: string) => void;
}

const statusLabels = {
	[RelationshipTypes.INCOMING_REQUEST]: <Trans>Incoming friend request</Trans>,
	[RelationshipTypes.OUTGOING_REQUEST]: <Trans>Friend request sent</Trans>,
};

export const FriendListItem: React.FC<FriendListItemProps> = observer((props) => {
	const {t} = useLingui();
	const {userId, relationshipType, openProfile} = props;

	const itemRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState(() => PresenceStore.getStatus(userId));
	const [contextMenuOpen, setContextMenuOpen] = useState(false);

	useEffect(() => {
		const handlePresenceUpdate = (_userId: string, newStatus: StatusType) => {
			setStatus(newStatus);
		};

		const unsubscribe = PresenceStore.subscribeToUserStatus(userId, handlePresenceUpdate);
		return () => {
			unsubscribe();
		};
	}, [userId]);

	useEffect(() => {
		const disposer = autorun(() => {
			const contextMenu = ContextMenuStore.contextMenu;
			const targetElement = contextMenu?.target.target;
			const isNodeTarget = typeof Node !== 'undefined' && targetElement instanceof Node;
			const isOpen = Boolean(contextMenu && isNodeTarget && itemRef.current?.contains(targetElement));
			setContextMenuOpen(isOpen);
		});

		return () => {
			disposer();
		};
	}, []);

	const getStatusText = useCallback(() => {
		switch (relationshipType) {
			case RelationshipTypes.INCOMING_REQUEST:
				return statusLabels[RelationshipTypes.INCOMING_REQUEST];
			case RelationshipTypes.OUTGOING_REQUEST:
				return statusLabels[RelationshipTypes.OUTGOING_REQUEST];
			default:
				return null;
		}
	}, [relationshipType]);

	const getStatusClassName = useCallback(() => {
		const isOffline = isOfflineStatus(status);

		if (relationshipType === RelationshipTypes.FRIEND) {
			return isOffline ? styles.friendStatusOffline : styles.friendStatusOnline;
		}
		return styles.friendStatusOffline;
	}, [relationshipType, status]);

	const createDMChannel = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation();
			try {
				await PrivateChannelActionCreators.openDMChannel(userId);
			} catch (error) {
				logger.error('Failed to open DM channel:', error);
			}
		},
		[userId],
	);

	const ignoreIncomingFriendRequest = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const user = UserStore.getUser(userId);
			if (!user) return;

			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Ignore Friend Request`}
						description={t`Are you sure you want to ignore the friend request from ${user.displayName}?`}
						primaryText={t`Ignore`}
						primaryVariant="danger-primary"
						onPrimary={() => RelationshipActionCreators.removeRelationship(userId)}
					/>
				)),
			);
		},
		[userId],
	);

	const cancelOutgoingFriendRequest = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const user = UserStore.getUser(userId);
			if (!user) return;

			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Cancel Friend Request`}
						description={t`Are you sure you want to cancel your friend request to ${user.displayName}?`}
						primaryText={t`Cancel Friend Request`}
						primaryVariant="danger-primary"
						onPrimary={() => RelationshipActionCreators.removeRelationship(userId)}
					/>
				)),
			);
		},
		[userId],
	);

	const acceptFriendRequest = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			RelationshipActionCreators.acceptFriendRequest(userId);
		},
		[userId],
	);

	const handleContextMenuClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const user = UserStore.getUser(userId);
			if (!user) return;

			ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
				<>
					<MenuGroup>
						<StartVoiceCallMenuItem user={user} onClose={onClose} />
						<StartVideoCallMenuItem user={user} onClose={onClose} />
					</MenuGroup>
					<MenuGroup>
						<RemoveFriendMenuItem user={user} onClose={onClose} />
					</MenuGroup>
				</>
			));
		},
		[userId],
	);

	const handleUserContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const user = UserStore.getUser(userId);
			if (!user) return;

			ContextMenuActionCreators.openFromEvent(e, ({onClose}) => <UserContextMenu user={user} onClose={onClose} />);
		},
		[userId],
	);

	const getFriendActions = useCallback((): Array<FriendAction> => {
		switch (relationshipType) {
			case RelationshipTypes.FRIEND:
				return [
					{
						icon: <ChatTeardropIcon weight="fill" className={styles.iconSize} />,
						tooltip: t`Send Message`,
						onClick: createDMChannel,
						className: styles.actionButtonMessage,
					},
					{
						icon: <DotsThreeVerticalIcon weight="bold" className={styles.iconSize} />,
						tooltip: t`More`,
						onClick: handleContextMenuClick,
						className: styles.actionButtonMore,
					},
				];
			case RelationshipTypes.INCOMING_REQUEST:
				return [
					{
						icon: <CheckIcon weight="bold" size={20} />,
						tooltip: t`Accept`,
						onClick: acceptFriendRequest,
						className: styles.actionButtonAccept,
					},
					{
						icon: <XIcon weight="bold" size={20} />,
						tooltip: t`Ignore`,
						onClick: ignoreIncomingFriendRequest,
						className: styles.actionButtonIgnore,
					},
				];
			case RelationshipTypes.OUTGOING_REQUEST:
				return [
					{
						icon: <XIcon weight="bold" size={20} />,
						tooltip: t`Cancel`,
						onClick: cancelOutgoingFriendRequest,
						className: styles.actionButtonCancel,
					},
				];
			default:
				return [];
		}
	}, [
		relationshipType,
		createDMChannel,
		handleContextMenuClick,
		acceptFriendRequest,
		ignoreIncomingFriendRequest,
		cancelOutgoingFriendRequest,
	]);

	const user = UserStore.getUser(userId);
	const customStatus = usePresenceCustomStatus({
		userId,
		enabled: relationshipType === RelationshipTypes.FRIEND,
	});
	if (!user) return null;

	const actions = getFriendActions();
	const hasCustomStatus = customStatus !== null;

	return (
		<FocusRing>
			<div
				ref={itemRef}
				className={clsx(styles.friendListItem, contextMenuOpen && styles.contextMenuActive)}
				onClick={() => openProfile(userId)}
				onContextMenu={handleUserContextMenu}
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						openProfile(userId);
					}
				}}
			>
				<div className={styles.friendInfo}>
					<StatusAwareAvatar user={user} size={36} />
					<div className={styles.friendDetails}>
						<div className={styles.friendNameRow}>
							<span className={styles.friendName}>{NicknameUtils.getNickname(user)}</span>
							<span className={styles.friendTag}>{user.tag}</span>
						</div>
						{hasCustomStatus ? (
							<CustomStatusDisplay
								customStatus={customStatus}
								className={styles.friendSubtext}
								showTooltip
								constrained
								animateOnParentHover
							/>
						) : (
							<span className={clsx(styles.friendSubtext, getStatusClassName())}>
								{getStatusText() || <StatusLabel status={status} />}
							</span>
						)}
					</div>
				</div>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: Actions container needs click handler to prevent event bubbling */}
				<div
					className={styles.friendActions}
					onClick={(e) => e.stopPropagation()}
					onKeyDown={stopPropagationOnEnterSpace}
				>
					{actions.map((action, index) => (
						<ActionButton
							key={index}
							tooltip={action.tooltip}
							onClick={action.onClick}
							className={action.className}
							danger={action.danger}
						>
							{action.icon}
						</ActionButton>
					))}
				</div>
			</div>
		</FocusRing>
	);
});

const StatusLabel = observer(function StatusLabel({status}: {status: string}) {
	const {i18n} = useLingui();
	return <>{getStatusTypeLabel(i18n, status)}</>;
});
