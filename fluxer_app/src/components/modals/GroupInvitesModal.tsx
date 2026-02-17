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

import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {InviteRevokeFailedModal} from '@app/components/alerts/InviteRevokeFailedModal';
import {InvitesLoadFailedModal} from '@app/components/alerts/InvitesLoadFailedModal';
import {InviteDateToggle} from '@app/components/invites/InviteDateToggle';
import {InviteListHeader, InviteListItem} from '@app/components/invites/InviteListItem';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/GroupInvitesModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Scroller} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {Logger} from '@app/lib/Logger';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useState} from 'react';

const logger = new Logger('GroupInvitesModal');

export const GroupInvitesModal = observer(({channelId}: {channelId: string}) => {
	const {t} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const isOwner = channel?.ownerId === AuthenticationStore.currentUserId;

	const [invites, setInvites] = useState<Array<Invite>>([]);
	const [fetchStatus, setFetchStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
	const [showCreatedDate, setShowCreatedDate] = useState(false);

	const loadInvites = useCallback(async () => {
		if (!isOwner) return;
		try {
			setFetchStatus('pending');
			const data = await InviteActionCreators.list(channelId);
			setInvites(data);
			setFetchStatus('success');
		} catch (error) {
			logger.error('Failed to load invites:', error);
			setFetchStatus('error');
			ModalActionCreators.push(modal(() => <InvitesLoadFailedModal />));
		}
	}, [channelId, isOwner]);

	useEffect(() => {
		if (isOwner && fetchStatus === 'idle') {
			loadInvites();
		}
	}, [fetchStatus, loadInvites, isOwner]);

	const handleRevoke = useCallback(
		(code: string) => {
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Revoke Invite`}
						description={t`Are you sure you want to revoke this invite? This action cannot be undone.`}
						primaryText={t`Revoke`}
						onPrimary={async () => {
							try {
								await InviteActionCreators.remove(code);
								ToastActionCreators.createToast({
									type: 'success',
									children: <Trans>Invite revoked</Trans>,
								});
								await loadInvites();
							} catch (error) {
								logger.error('Failed to revoke invite:', error);
								window.setTimeout(() => {
									ModalActionCreators.push(modal(() => <InviteRevokeFailedModal />));
								}, 0);
							}
						}}
					/>
				)),
			);
		},
		[loadInvites],
	);

	if (!isOwner) {
		return (
			<Modal.Root className={styles.modalRoot}>
				<Modal.Header title={t`Group Invites`} />
				<Modal.Content>
					<div className={styles.container}>
						<div className={styles.errorBox}>
							<p className={styles.errorText}>
								<Trans>Only the group owner can manage invites.</Trans>
							</p>
						</div>
					</div>
				</Modal.Content>
			</Modal.Root>
		);
	}

	return (
		<Modal.Root className={styles.modalRoot}>
			<Modal.Header title={t`Group Invites`} />
			<Modal.Content>
				<div className={styles.container}>
					{fetchStatus === 'pending' && (
						<div className={styles.spinnerContainer}>
							<Spinner />
						</div>
					)}

					{fetchStatus === 'error' && (
						<div className={styles.errorBox}>
							<p className={styles.errorText}>
								<Trans>Failed to load invites. Please try again.</Trans>
							</p>
						</div>
					)}

					{fetchStatus === 'success' && invites.length === 0 && (
						<div className={styles.stateBox}>
							<p className={styles.stateText}>
								<Trans>No invites created</Trans>
							</p>
						</div>
					)}

					{fetchStatus === 'success' && invites.length > 0 && (
						<div className={styles.invitesWrapper}>
							<InviteDateToggle showCreatedDate={showCreatedDate} onToggle={setShowCreatedDate} />
							<div className={styles.invitesList}>
								<Scroller className={styles.scroller} key="group-invites-scroller">
									<InviteListHeader showCreatedDate={showCreatedDate} />
									<div className={styles.inviteItems}>
										{invites.map((invite) => (
											<InviteListItem
												key={invite.code}
												invite={invite}
												onRevoke={handleRevoke}
												showCreatedDate={showCreatedDate}
											/>
										))}
									</div>
								</Scroller>
							</div>
						</div>
					)}
				</div>
			</Modal.Content>
		</Modal.Root>
	);
});
