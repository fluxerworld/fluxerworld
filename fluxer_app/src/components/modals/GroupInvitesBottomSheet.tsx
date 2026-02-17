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
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/GroupInvitesBottomSheet.module.css';
import {Avatar} from '@app/components/uikit/Avatar';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {Scroller} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {Logger} from '@app/lib/Logger';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import UserStore from '@app/stores/UserStore';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {ArrowLeftIcon, TrashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useState} from 'react';

const logger = new Logger('GroupInvitesBottomSheet');

interface GroupInvitesBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channelId: string;
}

export const GroupInvitesBottomSheet: React.FC<GroupInvitesBottomSheetProps> = observer(
	({isOpen, onClose, channelId}) => {
		const {t} = useLingui();
		const [invites, setInvites] = useState<Array<Invite> | null>(null);
		const [isLoading, setIsLoading] = useState(true);

		const loadInvites = useCallback(async () => {
			try {
				setIsLoading(true);
				const data = await InviteActionCreators.list(channelId);
				setInvites(data);
			} catch (error) {
				logger.error('Failed to load invites:', error);
				ModalActionCreators.push(modal(() => <InvitesLoadFailedModal />));
			} finally {
				setIsLoading(false);
			}
		}, [channelId]);

		useEffect(() => {
			if (isOpen) {
				loadInvites();
			}
		}, [isOpen, loadInvites]);

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

		const formatExpiresAt = (expiresAt: string | null) => {
			if (!expiresAt) return t`Never`;
			const date = new Date(expiresAt);
			const now = new Date();
			const diff = date.getTime() - now.getTime();
			if (diff < 0) return t`Expired`;
			const hours = Math.floor(diff / (1000 * 60 * 60));
			const days = Math.floor(hours / 24);
			if (days > 0) return t`${days} days`;
			return t`${hours} hours`;
		};

		return (
			<BottomSheet
				isOpen={isOpen}
				onClose={onClose}
				snapPoints={[0, 1]}
				initialSnap={1}
				disablePadding={true}
				surface="primary"
				leadingAction={
					<button type="button" onClick={onClose} className={styles.backButton}>
						<ArrowLeftIcon className={styles.backIcon} weight="bold" />
					</button>
				}
				title={t`Group Invites`}
			>
				<div className={styles.container}>
					<Scroller className={styles.scroller} key="group-invites-bottom-sheet-scroller">
						<div className={styles.content}>
							{isLoading ? (
								<div className={styles.loadingContainer}>
									<p className={styles.loadingText}>
										<Trans>Loading invites...</Trans>
									</p>
								</div>
							) : invites && invites.length === 0 ? (
								<div className={styles.emptyContainer}>
									<p className={styles.emptyText}>
										<Trans>No invites created</Trans>
									</p>
								</div>
							) : (
								<div className={styles.inviteList}>
									{invites?.map((invite) => {
										const inviter = invite.inviter ? UserStore.getUser(invite.inviter.id) : null;
										return (
											<div key={invite.code} className={styles.inviteItem}>
												{inviter && <Avatar user={inviter} size={32} />}
												<div className={styles.inviteDetails}>
													<div className={styles.inviteUrl}>
														{RuntimeConfigStore.inviteEndpoint}/{invite.code}
													</div>
													<div className={styles.inviteInfo}>
														<Trans>
															Created by {inviter?.username}. Expires in {formatExpiresAt(invite.expires_at)}.
														</Trans>
													</div>
												</div>
												<Tooltip text={t`Revoke invite`}>
													<button
														type="button"
														onClick={() => handleRevoke(invite.code)}
														className={styles.revokeButton}
														aria-label={t`Revoke invite`}
													>
														<TrashIcon className={styles.revokeIcon} />
													</button>
												</Tooltip>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</Scroller>
				</div>
			</BottomSheet>
		);
	},
);
