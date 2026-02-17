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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import {InvitesLoadFailedModal} from '@app/components/alerts/InvitesLoadFailedModal';
import {DisableInvitesButton} from '@app/components/invites/DisableInvitesButton';
import {InviteDateToggle} from '@app/components/invites/InviteDateToggle';
import {InviteListHeader, InviteListItem} from '@app/components/invites/InviteListItem';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/channel_tabs/ChannelInvitesTab.module.css';
import {InviteModal} from '@app/components/modals/InviteModal';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import {Button} from '@app/components/uikit/button/Button';
import {CopyLinkIcon, CopyTextIcon, DeleteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Spinner} from '@app/components/uikit/Spinner';
import {useInviteRevoke} from '@app/hooks/useInviteRevoke';
import ChannelStore from '@app/stores/ChannelStore';
import InviteStore from '@app/stores/InviteStore';
import PermissionStore from '@app/stores/PermissionStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import * as InviteUtils from '@app/utils/InviteUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {UserPlusIcon, WarningOctagonIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const ChannelInvitesTab: React.FC<{channelId: string}> = observer(({channelId}) => {
	const {i18n, t} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const invites = InviteStore.channelInvites.get(channelId) ?? null;
	const fetchStatus = InviteStore.channelInvitesFetchStatus.get(channelId) ?? 'idle';
	const handleRevoke = useInviteRevoke();
	const [showCreatedDate, setShowCreatedDate] = useState(false);
	const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);

	const canInvite = InviteUtils.canInviteToChannel(channelId, channel?.guildId);

	const canManageGuild = PermissionStore.can(Permissions.MANAGE_GUILD, {
		guildId: channel?.guildId,
	});

	const refreshInvites = useCallback(async () => {
		try {
			await ChannelActionCreators.fetchChannelInvites(channelId);
		} catch (_error) {
			ModalActionCreators.push(modal(() => <InvitesLoadFailedModal />));
		}
	}, [channelId]);

	useEffect(() => {
		if (fetchStatus === 'idle') {
			void refreshInvites();
		}
	}, [channelId, fetchStatus, refreshInvites]);

	const handleCreateInvite = useCallback(() => {
		ModalActionCreators.push(modal(() => <InviteModal channelId={channelId} />));
	}, [channelId]);

	const handleCloseInviteActions = useCallback(() => {
		setSelectedInvite(null);
	}, []);

	const handleInvitePress = useCallback((invite: Invite) => {
		setSelectedInvite(invite);
	}, []);

	const handleCopyInviteCode = useCallback(() => {
		if (!selectedInvite) {
			return;
		}
		void TextCopyActionCreators.copy(i18n, selectedInvite.code);
		handleCloseInviteActions();
	}, [handleCloseInviteActions, i18n, selectedInvite]);

	const handleCopyInviteUrl = useCallback(() => {
		if (!selectedInvite) {
			return;
		}
		void TextCopyActionCreators.copy(i18n, `${RuntimeConfigStore.inviteEndpoint}/${selectedInvite.code}`);
		handleCloseInviteActions();
	}, [handleCloseInviteActions, i18n, selectedInvite]);

	const handleDeleteInvite = useCallback(() => {
		if (!selectedInvite) {
			return;
		}
		const inviteCode = selectedInvite.code;
		handleCloseInviteActions();
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Delete Invite`}
					description={t`Are you sure you want to delete this invite? This action cannot be undone.`}
					primaryText={t`Delete Invite`}
					onPrimary={() => handleRevoke(inviteCode)}
				/>
			)),
		);
	}, [handleCloseInviteActions, handleRevoke, selectedInvite, t]);

	const inviteActionGroups = useMemo<Array<MenuGroupType>>(() => {
		if (!selectedInvite) {
			return [];
		}
		return [
			{
				items: [
					{
						icon: <CopyTextIcon size={20} />,
						label: t`Copy Invite Code`,
						onClick: handleCopyInviteCode,
					},
					{
						icon: <CopyLinkIcon size={20} />,
						label: t`Copy Invite URL`,
						onClick: handleCopyInviteUrl,
					},
				],
			},
			{
				items: [
					{
						icon: <DeleteIcon size={20} />,
						label: t`Delete Invite`,
						onClick: handleDeleteInvite,
						danger: true,
					},
				],
			},
		];
	}, [handleCopyInviteCode, handleCopyInviteUrl, handleDeleteInvite, selectedInvite, t]);

	return (
		<div className={styles.container}>
			<div>
				<h2 className={styles.header}>
					<Trans>Invite Links</Trans>
				</h2>
				<p className={styles.description}>
					<Trans>Manage invites for this channel.</Trans>
				</p>
			</div>

			<div className={styles.buttonGroup}>
				<Button small={true} disabled={!canInvite || fetchStatus === 'pending'} onClick={handleCreateInvite}>
					<Trans>Create Invite</Trans>
				</Button>
				{canManageGuild && channel?.guildId && <DisableInvitesButton guildId={channel.guildId} />}
			</div>

			{fetchStatus === 'pending' && (
				<div className={styles.spinnerContainer}>
					<Spinner />
				</div>
			)}

			{fetchStatus === 'success' && invites && invites.length > 0 && (
				<div className={styles.invitesContainer}>
					<InviteDateToggle showCreatedDate={showCreatedDate} onToggle={setShowCreatedDate} />
					<div className={styles.invitesList}>
						<InviteListHeader showCreatedDate={showCreatedDate} />
						<div className={styles.inviteItems}>
							{invites.map((invite) => (
								<InviteListItem
									key={invite.code}
									invite={invite}
									onRevoke={handleRevoke}
									onMobilePress={handleInvitePress}
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
						<Trans>This channel doesn't have any invite links yet. Create one to invite people to this channel.</Trans>
					}
					actions={
						canInvite
							? [
									{
										text: <Trans>Create Invite</Trans>,
										onClick: handleCreateInvite,
										variant: 'primary',
									},
								]
							: undefined
					}
					fullHeight={true}
				/>
			)}

			{fetchStatus === 'error' && (
				<StatusSlate
					Icon={WarningOctagonIcon}
					title={<Trans>Failed to Load Invites</Trans>}
					description={<Trans>There was an error loading the invite links for this channel. Please try again.</Trans>}
					actions={[
						{
							text: <Trans>Try Again</Trans>,
							onClick: refreshInvites,
							variant: 'primary',
						},
					]}
					fullHeight={true}
				/>
			)}
			<MenuBottomSheet
				isOpen={selectedInvite !== null}
				onClose={handleCloseInviteActions}
				title={selectedInvite ? selectedInvite.code : undefined}
				groups={inviteActionGroups}
			/>
		</div>
	);
});

export default ChannelInvitesTab;
