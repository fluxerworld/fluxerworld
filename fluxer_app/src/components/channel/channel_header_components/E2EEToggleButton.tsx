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
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import {E2EEFingerprintModal} from '@app/components/modals/E2EEFingerprintModal';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import E2EEStore from '@app/stores/E2EEStore';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {useLingui} from '@lingui/react/macro';
import {LockKeyIcon, LockKeyOpenIcon, ShieldCheckIcon, ShieldIcon, ShieldWarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo} from 'react';

interface E2EEToggleButtonProps {
	channelId: string;
}

export const E2EEToggleButton: React.FC<E2EEToggleButtonProps> = observer(({channelId}) => {
	const {t} = useLingui();
	const enabled = E2EEStore.isChannelEncrypted(channelId);
	const ready = E2EEStore.isReady;

	const recipientId = useMemo(() => {
		const channel = ChannelStore.getChannel(channelId);
		if (!channel) return null;
		const ownId = E2EEStore.currentUserId;
		return channel.recipientIds.find((id) => id !== ownId) ?? null;
	}, [channelId]);

	useEffect(() => {
		if (!enabled || !recipientId) return;
		void E2EEStore.ensureVerificationsForUser(recipientId);
		// Bound the refresh — the channel header re-mounts whenever the
		// user navigates between channels, and we don't need to spam the
		// device-list endpoint each hop.
		void E2EEStore.refreshPeerDevices(recipientId, {minIntervalMs: 60_000});
	}, [enabled, recipientId]);

	const verificationStatus = recipientId
		? E2EEStore.getPeerVerificationStatus(recipientId)
		: 'unverified';

	const handleToggle = useCallback(async () => {
		// Make sure this device has Olm keys before flipping the DM into
		// encrypted mode — otherwise the peer would see the channel switch
		// on but our outgoing messages would silently fall back to
		// plaintext. Safe to call when already bootstrapped; bootstrap is
		// idempotent.
		if (!E2EEStore.isReady) {
			const userId = AuthenticationStore.currentUserId;
			if (userId) {
				try {
					await E2EEStore.bootstrap(userId);
				} catch {
					// Surface failures via the channel state regardless —
					// the server-side flip and CHANNEL_UPDATE still need to
					// happen so the peer doesn't get stuck in a half-state.
				}
			}
		}
		void E2EEStore.setChannelEncrypted(channelId, !enabled);
	}, [channelId, enabled]);

	const handleVerify = useCallback(() => {
		if (!recipientId) return;
		const recipient = UserStore.getUser(recipientId);
		const recipientName = recipient
			? NicknameUtils.getNickname(recipient, undefined, channelId) || recipient.username
			: t`this user`;
		ModalActionCreators.push(
			modal(() => <E2EEFingerprintModal recipientUserId={recipientId} recipientName={recipientName} />),
		);
	}, [channelId, recipientId, t]);

	return (
		<>
			<ChannelHeaderIcon
				icon={enabled ? LockKeyIcon : LockKeyOpenIcon}
				isSelected={enabled}
				label={
					enabled
						? t`End-to-end encryption is on (click to disable for this DM)`
						: ready
							? t`Enable end-to-end encryption for this DM`
							: t`Enable end-to-end encryption for this DM (sets up keys on first use)`
				}
				onClick={handleToggle}
			/>
			{enabled && ready && (
				<ChannelHeaderIcon
					icon={
						verificationStatus === 'verified'
							? ShieldCheckIcon
							: verificationStatus === 'partial'
								? ShieldWarningIcon
								: ShieldIcon
					}
					isSelected={verificationStatus === 'verified'}
					label={
						verificationStatus === 'verified'
							? t`Peer's identity verified — click to review fingerprints`
							: verificationStatus === 'partial'
								? t`Some of this peer's devices aren't verified yet — click to review`
								: t`Peer not yet verified — click to compare fingerprints`
					}
					onClick={handleVerify}
				/>
			)}
		</>
	);
});
