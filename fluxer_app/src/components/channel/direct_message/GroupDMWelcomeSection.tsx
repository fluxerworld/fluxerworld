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
import styles from '@app/components/channel/direct_message/GroupDMWelcomeSection.module.css';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {AddFriendsToGroupModal} from '@app/components/modals/AddFriendsToGroupModal';
import {EditGroupModal} from '@app/components/modals/EditGroupModal';
import {Button} from '@app/components/uikit/button/Button';
import {GroupDMContextMenu} from '@app/components/uikit/context_menu/GroupDMContextMenu';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {isGroupDmFull} from '@app/utils/GroupDmUtils';
import {Trans} from '@lingui/react/macro';
import {NotePencilIcon, UserPlusIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface GroupDMWelcomeSectionProps {
	channel: ChannelRecord;
}

export const GroupDMWelcomeSection: React.FC<GroupDMWelcomeSectionProps> = observer(({channel}) => {
	const displayName = ChannelUtils.getDMDisplayName(channel);
	const isGroupDMFull = isGroupDmFull(channel);

	const handleOpenEditGroup = useCallback(() => {
		ModalActionCreators.push(modal(() => <EditGroupModal channelId={channel.id} />));
	}, [channel.id]);

	const handleAddFriends = useCallback(() => {
		ModalActionCreators.push(modal(() => <AddFriendsToGroupModal channelId={channel.id} />));
	}, [channel.id]);

	const handleGroupContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<GroupDMContextMenu channel={channel} onClose={onClose} />
			));
		},
		[channel],
	);

	return (
		<div className={styles.welcomeSection}>
			<button
				type="button"
				className={styles.profileSection}
				onContextMenu={handleGroupContextMenu}
				aria-haspopup="menu"
			>
				<GroupDMAvatar channel={channel} size={80} />

				<span className={styles.groupName}>{displayName}</span>
			</button>

			<p className={styles.welcomeText}>
				<Trans>
					This is the beginning of <strong>{displayName}</strong>. Add friends to start a conversation!
				</Trans>
			</p>

			<div className={styles.actions}>
				<Button
					variant="secondary"
					leftIcon={<NotePencilIcon size={18} weight="bold" />}
					onClick={handleOpenEditGroup}
					fitContainer={false}
					fitContent
				>
					<Trans>Edit Group</Trans>
				</Button>

				{!isGroupDMFull && (
					<Button
						variant="primary"
						leftIcon={<UserPlusIcon size={18} weight="bold" />}
						onClick={handleAddFriends}
						fitContainer={false}
						fitContent
					>
						<Trans>Add Friends to Group</Trans>
					</Button>
				)}
			</div>
		</div>
	);
});
