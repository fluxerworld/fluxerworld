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

import {EmojiAttributionSubtext, getEmojiAttribution} from '@app/components/emojis/EmojiAttributionSubtext';
import styles from '@app/components/emojis/EmojiInfoContent.module.css';
import GuildStore from '@app/stores/GuildStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {observer} from 'mobx-react-lite';

interface EmojiInfoContentProps {
	emoji: FlatEmoji;
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
