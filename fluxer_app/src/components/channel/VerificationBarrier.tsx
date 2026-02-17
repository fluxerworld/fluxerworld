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

import {
	AccountTooNewBarrier,
	DefaultBarrier,
	NoPhoneNumberBarrier,
	NotMemberLongEnoughBarrier,
	SendMessageDisabledBarrier,
	TimeoutBarrier,
	UnclaimedAccountBarrier,
	UnverifiedEmailBarrier,
} from '@app/components/channel/barriers/BarrierComponents';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import GuildVerificationStore, {VerificationFailureReason} from '@app/stores/GuildVerificationStore';
import {observer} from 'mobx-react-lite';

interface Props {
	channel: ChannelRecord;
}

export const VerificationBarrier = observer(({channel}: Props) => {
	const guildId = channel.guildId || '';
	const verificationStatus = GuildVerificationStore.getVerificationStatus(guildId);

	if (!verificationStatus || verificationStatus.canAccess) {
		return null;
	}

	switch (verificationStatus.reason) {
		case VerificationFailureReason.UNCLAIMED_ACCOUNT:
			return <UnclaimedAccountBarrier />;

		case VerificationFailureReason.UNVERIFIED_EMAIL:
			return <UnverifiedEmailBarrier />;

		case VerificationFailureReason.ACCOUNT_TOO_NEW:
			return <AccountTooNewBarrier initialTimeRemaining={verificationStatus.timeRemaining || 0} />;

		case VerificationFailureReason.NOT_MEMBER_LONG_ENOUGH:
			return <NotMemberLongEnoughBarrier initialTimeRemaining={verificationStatus.timeRemaining || 0} />;

		case VerificationFailureReason.NO_PHONE_NUMBER:
			return <NoPhoneNumberBarrier />;

		case VerificationFailureReason.SEND_MESSAGE_DISABLED:
			return <SendMessageDisabledBarrier />;

		case VerificationFailureReason.TIMED_OUT:
			return <TimeoutBarrier initialTimeRemaining={verificationStatus.timeRemaining || 0} />;

		default:
			return <DefaultBarrier />;
	}
});
