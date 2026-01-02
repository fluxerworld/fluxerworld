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

import {observer} from 'mobx-react-lite';
import {EmojiAttributionSubtext, getEmojiAttribution} from '~/components/emojis/EmojiAttributionSubtext';
import type {Emoji} from '~/stores/EmojiStore';
import GuildStore from '~/stores/GuildStore';
import styles from './EmojiInfoContent.module.css';

interface EmojiInfoContentProps {
	emoji: Emoji;
}

export const EmojiInfoContent = observer(function EmojiInfoContent({emoji}: EmojiInfoContentProps) {
	const guild = emoji.guildId ? GuildStore.getGuild(emoji.guildId) : null;
	const attribution = getEmojiAttribution({
		emojiId: emoji.id,
		guildId: emoji.guildId,
		guild,
		emojiName: emoji.name,
	});

	return (
		<EmojiAttributionSubtext
			attribution={attribution}
			classes={{
				container: styles.container,
				text: styles.text,
				guildRow: styles.guildRow,
				guildIcon: styles.guildIcon,
				guildName: styles.guildName,
				verifiedIcon: styles.verifiedIcon,
			}}
		/>
	);
});
