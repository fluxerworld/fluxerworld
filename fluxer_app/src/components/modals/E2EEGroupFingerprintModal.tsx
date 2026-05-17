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

import {modal, push as pushModal} from '@app/actions/ModalActionCreators';
import {E2EEFingerprintModal} from '@app/components/modals/E2EEFingerprintModal';
import * as Modal from '@app/components/modals/Modal';
import ChannelStore from '@app/stores/ChannelStore';
import E2EEStore from '@app/stores/E2EEStore';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {ShieldCheckIcon, ShieldIcon, ShieldWarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo} from 'react';

interface Props {
	channelId: string;
}

// Picker for verifying every peer in a group DM. Lists members + their
// current verification status; clicking a row opens the existing single-
// peer fingerprint modal scoped to that member. Keeps the per-peer
// modal as the authoritative verification UI — this just routes traffic.
export const E2EEGroupFingerprintModal: React.FC<Props> = observer(({channelId}) => {
	const {t} = useLingui();

	const otherRecipientIds = useMemo(() => {
		const channel = ChannelStore.getChannel(channelId);
		if (!channel) return [] as ReadonlyArray<string>;
		const ownId = E2EEStore.currentUserId;
		return channel.recipientIds.filter((id) => id !== ownId);
	}, [channelId]);

	useEffect(() => {
		for (const id of otherRecipientIds) {
			void E2EEStore.ensureVerificationsForUser(id);
			void E2EEStore.refreshPeerDevices(id, {minIntervalMs: 60_000});
		}
	}, [otherRecipientIds]);

	const openPeer = useCallback(
		(peerId: string) => {
			const recipient = UserStore.getUser(peerId);
			const recipientName = recipient
				? NicknameUtils.getNickname(recipient, undefined, channelId) || recipient.username
				: t`this user`;
			pushModal(
				modal(() => <E2EEFingerprintModal recipientUserId={peerId} recipientName={recipientName} />),
			);
		},
		[channelId, t],
	);

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Verify group encryption`} />
			<Modal.Content>
				<Modal.ContentLayout>
					<p style={{color: 'var(--text-secondary)'}}>
						<Trans>
							Pick a member to compare fingerprints out of band (in person, on a call, etc.). The shield in the
							header turns green only when every member is verified.
						</Trans>
					</p>
					<div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem'}}>
						{otherRecipientIds.map((peerId) => {
							const user = UserStore.getUser(peerId);
							const name = user
								? NicknameUtils.getNickname(user, undefined, channelId) || user.username
								: peerId;
							const status = E2EEStore.getPeerVerificationStatus(peerId);
							const Icon =
								status === 'verified'
									? ShieldCheckIcon
									: status === 'partial'
										? ShieldWarningIcon
										: ShieldIcon;
							const color =
								status === 'verified'
									? 'var(--status-positive)'
									: status === 'partial'
										? 'var(--status-warning)'
										: 'var(--text-tertiary)';
							const label =
								status === 'verified'
									? t`Verified`
									: status === 'partial'
										? t`Partially verified`
										: t`Not verified`;
							return (
								<button
									key={peerId}
									type="button"
									onClick={() => openPeer(peerId)}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: '0.75rem',
										padding: '0.625rem 0.75rem',
										background: 'var(--bg-overlay)',
										border: '1px solid var(--bg-border)',
										borderRadius: '6px',
										cursor: 'pointer',
										textAlign: 'left',
									}}
								>
									<Icon size={20} weight="bold" style={{color, flexShrink: 0}} />
									<div style={{flex: 1, minWidth: 0}}>
										<div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{name}</div>
										<div style={{fontSize: '0.85em', color}}>{label}</div>
									</div>
									<span style={{color: 'var(--text-tertiary)', fontSize: '0.85em'}}>
										<Trans>Review</Trans>
									</span>
								</button>
							);
						})}
					</div>
				</Modal.ContentLayout>
			</Modal.Content>
		</Modal.Root>
	);
});
