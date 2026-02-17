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

import styles from '@app/components/channel/QuickReactionsRow.module.css';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {getEmojiDisplayData} from '@app/utils/SkinToneUtils';
import type React from 'react';

export function renderQuickReactionEmoji(emoji: FlatEmoji): React.ReactNode {
	const isUnicodeEmoji = !emoji.guildId && !emoji.id;
	const useNativeRendering = shouldUseNativeEmoji && isUnicodeEmoji;
	const {surrogates: displaySurrogates, url: displayUrl} = getEmojiDisplayData(emoji);

	if (useNativeRendering) {
		return <span className={styles.emojiNative}>{displaySurrogates}</span>;
	}

	const emojiSrc = emoji.id ? AvatarUtils.getEmojiURL({id: emoji.id, animated: false}) : (displayUrl ?? '');
	return <img src={emojiSrc} alt={emoji.name} className={styles.emojiImg} />;
}
