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

import styles from '@app/components/channel/ChannelWelcomeSection.module.css';
import {DMWelcomeSection} from '@app/components/channel/direct_message/DMWelcomeSection';
import {GroupDMWelcomeSection} from '@app/components/channel/direct_message/GroupDMWelcomeSection';
import {PersonalNotesWelcomeSection} from '@app/components/channel/direct_message/PersonalNotesWelcomeSection';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import UserStore from '@app/stores/UserStore';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {Trans} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

interface ChannelWelcomeSectionProps {
	channel: ChannelRecord;
}

export const ChannelWelcomeSection = observer(({channel}: ChannelWelcomeSectionProps) => {
	const recipient = UserStore.getUser(channel.recipientIds[0]);

	if (channel.type === ChannelTypes.DM && recipient) {
		return <DMWelcomeSection userId={recipient.id} channel={channel} />;
	}

	if (channel.type === ChannelTypes.DM_PERSONAL_NOTES && recipient) {
		return <PersonalNotesWelcomeSection userId={recipient.id} />;
	}

	if (channel.type === ChannelTypes.GROUP_DM) {
		return <GroupDMWelcomeSection channel={channel} />;
	}

	return (
		<div className={styles.container}>
			<div className={clsx('pointer-events-none', styles.channelIcon)}>
				{ChannelUtils.getIcon(channel, {className: styles.iconSize})}
			</div>
			<h1 className={styles.heading}>
				<Trans>Welcome to #{channel.name ?? ''}</Trans>
			</h1>
			<p className={styles.description}>
				<Trans>In the beginning, there was nothing. Then, there was #{channel.name ?? ''}. And it was good.</Trans>
			</p>
		</div>
	);
});
