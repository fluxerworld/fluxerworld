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
import {E2EEGroupFingerprintModal} from '@app/components/modals/E2EEGroupFingerprintModal';
import ChannelStore from '@app/stores/ChannelStore';
import E2EEStore from '@app/stores/E2EEStore';
import UserStore from '@app/stores/UserStore';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {useLingui} from '@lingui/react/macro';
import {LockKeyIcon, ShieldCheckIcon, ShieldIcon, ShieldWarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo} from 'react';

interface E2EEStatusIndicatorProps {
	channelId: string;
}

// E2EE is always-on for DM + Group DM — there is no toggle. This renders a
// permanent lock indicator plus a verification shield; clicking either opens
// the fingerprint-comparison modal.
export const E2EEStatusIndicator: React.FC<E2EEStatusIndicatorProps> = observer(({channelId}) => {
	const {t} = useLingui();
	const ready = E2EEStore.isReady;

	// All other recipients in the channel — for 1:1 this is one user, for
	// a group DM it can be up to several. The verification shield aggregates
	// over the set.
	const otherRecipientIds = useMemo(() => {
		const channel = ChannelStore.getChannel(channelId);
		if (!channel) return [] as ReadonlyArray<string>;
		const ownId = E2EEStore.currentUserId;
		return channel.recipientIds.filter((id) => id !== ownId);
	}, [channelId]);

	const isGroup = otherRecipientIds.length > 1;
	const primaryRecipientId = otherRecipientIds[0] ?? null;

	useEffect(() => {
		if (!ready) return;
		for (const id of otherRecipientIds) {
			void E2EEStore.ensureVerificationsForUser(id);
			// Bound the refresh — the channel header re-mounts whenever the
			// user navigates between channels, and we don't need to spam the
			// device-list endpoint each hop.
			void E2EEStore.refreshPeerDevices(id, {minIntervalMs: 60_000});
		}
	}, [ready, otherRecipientIds]);

	// Worst-case aggregate across all peers: any unverified pulls the
	// whole thing down to grey; any partial pulls a verified group down
	// to yellow. Matches what users expect from "is this conversation
	// trusted end-to-end?"
	const verificationStatus = useMemo(() => {
		if (otherRecipientIds.length === 0) return 'unverified';
		let sawPartial = false;
		let sawVerified = false;
		for (const id of otherRecipientIds) {
			const s = E2EEStore.getPeerVerificationStatus(id);
			if (s === 'unverified') return 'unverified';
			if (s === 'partial') sawPartial = true;
			if (s === 'verified') sawVerified = true;
		}
		if (sawPartial) return 'partial';
		if (sawVerified) return 'verified';
		return 'unverified';
	}, [otherRecipientIds]);

	const handleVerify = useCallback(() => {
		// For 1:1 the existing single-peer modal opens directly. For group
		// DMs we route through a picker that lists every member with their
		// verification status; clicking a row opens the same single-peer
		// modal scoped to that member.
		if (isGroup) {
			ModalActionCreators.push(modal(() => <E2EEGroupFingerprintModal channelId={channelId} />));
			return;
		}
		if (!primaryRecipientId) return;
		const recipient = UserStore.getUser(primaryRecipientId);
		const recipientName = recipient
			? NicknameUtils.getNickname(recipient, undefined, channelId) || recipient.username
			: t`this user`;
		ModalActionCreators.push(
			modal(() => <E2EEFingerprintModal recipientUserId={primaryRecipientId} recipientName={recipientName} />),
		);
	}, [channelId, primaryRecipientId, isGroup, t]);

	return (
		<>
			<ChannelHeaderIcon
				icon={LockKeyIcon}
				isSelected
				label={
					isGroup
						? t`This group DM is end-to-end encrypted — click to verify members`
						: t`This DM is end-to-end encrypted — click to verify`
				}
				onClick={handleVerify}
			/>
			{ready && (
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
							? isGroup
								? t`All members verified — click to review fingerprints`
								: t`Peer's identity verified — click to review fingerprints`
							: verificationStatus === 'partial'
								? isGroup
									? t`Some members aren't fully verified — click to review`
									: t`Some of this peer's devices aren't verified yet — click to review`
								: isGroup
									? t`No members verified yet — click to compare fingerprints`
									: t`Peer not yet verified — click to compare fingerprints`
					}
					onClick={handleVerify}
				/>
			)}
		</>
	);
});
