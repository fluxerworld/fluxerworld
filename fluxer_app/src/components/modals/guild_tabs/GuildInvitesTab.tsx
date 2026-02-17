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

import * as GuildActionCreators from '@app/actions/GuildActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {InvitesLoadFailedModal} from '@app/components/alerts/InvitesLoadFailedModal';
import {DisableInvitesButton} from '@app/components/invites/DisableInvitesButton';
import {InviteDateToggle} from '@app/components/invites/InviteDateToggle';
import {InviteListHeader, InviteListItem} from '@app/components/invites/InviteListItem';
import styles from '@app/components/modals/guild_tabs/GuildInvitesTab.module.css';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import {Spinner} from '@app/components/uikit/Spinner';
import {useInviteRevoke} from '@app/hooks/useInviteRevoke';
import InviteStore from '@app/stores/InviteStore';
import PermissionStore from '@app/stores/PermissionStore';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {Trans} from '@lingui/react/macro';
import {UserPlusIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useState} from 'react';

const GuildInvitesTab: React.FC<{guildId: string}> = observer(({guildId}) => {
	const invites = InviteStore.guildInvites.get(guildId) ?? null;
	const fetchStatus = InviteStore.guildInvitesFetchStatus.get(guildId) ?? 'idle';
	const handleRevoke = useInviteRevoke();
	const [showCreatedDate, setShowCreatedDate] = useState(false);

	const fetchInvites = useCallback(async () => {
		try {
			await GuildActionCreators.fetchGuildInvites(guildId);
		} catch (_error) {
			ModalActionCreators.push(modal(() => <InvitesLoadFailedModal />));
		}
	}, [guildId]);

	const canManageGuild = PermissionStore.can(Permissions.MANAGE_GUILD, {
		guildId,
	});

	useEffect(() => {
		if (fetchStatus === 'idle') {
			void fetchInvites();
		}
	}, [fetchStatus, fetchInvites]);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h2 className={styles.title}>
					<Trans>Invite Links</Trans>
				</h2>
				<p className={styles.subtitle}>
					<Trans>
						View all invites for this community. To create a new invite, go to a channel and use the invite button.
					</Trans>
				</p>
			</div>

			{canManageGuild && <DisableInvitesButton guildId={guildId} />}

			{fetchStatus === 'pending' && (
				<div className={styles.spinnerContainer}>
					<Spinner />
				</div>
			)}

			{fetchStatus === 'success' && invites && invites.length > 0 && (
				<div className={styles.invitesContainer}>
					<InviteDateToggle showCreatedDate={showCreatedDate} onToggle={setShowCreatedDate} />
					<div className={styles.inviteList}>
						<InviteListHeader showChannel={true} showCreatedDate={showCreatedDate} />
						<div className={styles.inviteItems}>
							{invites.map((invite) => (
								<InviteListItem
									key={invite.code}
									invite={invite}
									onRevoke={handleRevoke}
									showChannel={true}
									showCreatedDate={showCreatedDate}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			{fetchStatus === 'success' && invites && invites.length === 0 && (
				<StatusSlate
					Icon={UserPlusIcon}
					title={<Trans>No Invite Links</Trans>}
					description={
						<Trans>
							This community doesn't have any invite links yet. Go to a channel and create an invite to invite people.
						</Trans>
					}
					fullHeight={true}
				/>
			)}

			{fetchStatus === 'error' && (
				<StatusSlate
					Icon={WarningCircleIcon}
					title={<Trans>Failed to Load Invites</Trans>}
					description={<Trans>There was an error loading the invites. Please try again.</Trans>}
					actions={[
						{
							text: <Trans>Retry</Trans>,
							onClick: fetchInvites,
							variant: 'primary',
						},
					]}
					fullHeight={true}
				/>
			)}
		</div>
	);
});

export default GuildInvitesTab;
