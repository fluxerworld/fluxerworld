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
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {InviteAcceptModal} from '@app/components/modals/InviteAcceptModal';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import InviteStore from '@app/stores/InviteStore';
import NagbarStore from '@app/stores/NagbarStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {isGuildInvite} from '@app/types/InviteTypes';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

const FLUXER_HQ_INVITE_CODE = 'fluxer-hq';

export const GuildMembershipCtaNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const isSelfHosted = RuntimeConfigStore.isSelfHosted();
	const currentUserId = AuthenticationStore.currentUserId;
	const inviteState = InviteStore.invites.get(FLUXER_HQ_INVITE_CODE);
	const invite = inviteState?.data ?? null;

	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		const fluxerHqGuild = GuildStore.getGuilds().find((guild) => guild.vanityURLCode === FLUXER_HQ_INVITE_CODE);
		if (fluxerHqGuild && GuildMemberStore.getMember(fluxerHqGuild.id, currentUserId ?? '')) {
			NagbarStore.guildMembershipCtaDismissed = true;
		}
	}, [currentUserId]);

	if (isSelfHosted) {
		return null;
	}

	if (!currentUserId) {
		return null;
	}

	if (invite && isGuildInvite(invite)) {
		const guildId = invite.guild.id;
		const isMember = Boolean(GuildMemberStore.getMember(guildId, currentUserId));
		if (isMember) {
			return null;
		}
	}

	const handleJoinGuild = async () => {
		if (isSubmitting) return;

		setIsSubmitting(true);
		try {
			await InviteActionCreators.fetchWithCoalescing(FLUXER_HQ_INVITE_CODE);
		} finally {
			setIsSubmitting(false);
			ModalActionCreators.push(modal(() => <InviteAcceptModal code={FLUXER_HQ_INVITE_CODE} />));
		}
	};

	const handleDismiss = () => {
		NagbarStore.guildMembershipCtaDismissed = true;
	};

	return (
		<Nagbar
			isMobile={isMobile}
			backgroundColor="var(--brand-primary)"
			textColor="var(--text-on-brand-primary)"
			onDismiss={handleDismiss}
			dismissible={true}
		>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleDismiss}
				message={<Trans>Join Fluxer HQ to chat with the team and stay up to date on the latest!</Trans>}
				actions={
					<NagbarButton isMobile={isMobile} onClick={handleJoinGuild} submitting={isSubmitting} disabled={isSubmitting}>
						<Trans>Join Fluxer HQ</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
