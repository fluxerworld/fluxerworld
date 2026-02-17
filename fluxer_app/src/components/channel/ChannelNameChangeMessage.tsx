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

import {SystemMessage} from '@app/components/channel/SystemMessage';
import {SystemMessageUsername} from '@app/components/channel/SystemMessageUsername';
import {useSystemMessageData} from '@app/hooks/useSystemMessageData';
import type {MessageRecord} from '@app/records/MessageRecord';
import styles from '@app/styles/Message.module.css';
import {Trans} from '@lingui/react/macro';
import {PencilSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

interface ChannelNameChangeMessageProps {
	message: MessageRecord;
}

export const ChannelNameChangeMessage = observer(({message}: ChannelNameChangeMessageProps) => {
	const {author, channel, guild} = useSystemMessageData(message);

	if (!channel) {
		return null;
	}

	const newName = message.content;
	const nameComponent = channel.isGroupDM() ? (
		<span className={styles.systemMessageLink} style={{cursor: 'text', textDecoration: 'none'}}>
			{newName}
		</span>
	) : (
		<span className={styles.systemMessageLink}>{newName}</span>
	);

	const messageContent = newName ? (
		<Trans>
			<SystemMessageUsername key={author.id} author={author} guild={guild} message={message} /> changed the channel name
			to {nameComponent}.
		</Trans>
	) : (
		<Trans>
			<SystemMessageUsername key={author.id} author={author} guild={guild} message={message} /> changed the channel
			name.
		</Trans>
	);

	return <SystemMessage icon={PencilSimpleIcon} iconWeight="bold" message={message} messageContent={messageContent} />;
});
