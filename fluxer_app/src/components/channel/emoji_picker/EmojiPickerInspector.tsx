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

import styles from '@app/components/channel/EmojiPicker.module.css';
import {EMOJI_SPRITE_SIZE, getSpriteSheetBackground} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {EMOJI_SPRITES} from '@app/lib/UnicodeEmojis';
import EmojiStore from '@app/stores/EmojiStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {observer} from 'mobx-react-lite';

interface EmojiPickerInspectorProps {
	hoveredEmoji: FlatEmoji | null;
}

export const EmojiPickerInspector = observer(({hoveredEmoji}: EmojiPickerInspectorProps) => {
	const skinTone = EmojiStore.skinTone;

	const getEmojiForDisplay = (
		emoji: FlatEmoji | null,
	): {useImg: boolean; useNative: boolean; url?: string; style?: React.CSSProperties} | null => {
		if (!emoji) return null;

		if (emoji.guildId || emoji.id) {
			return {url: emoji.url, useImg: true, useNative: false};
		}

		if (shouldUseNativeEmoji && emoji.surrogates) {
			return {useImg: false, useNative: true};
		}

		if (!emoji.useSpriteSheet) {
			return {url: emoji.url, useImg: true, useNative: false};
		}

		const hasDiversity = emoji.hasDiversity && skinTone;
		const index = hasDiversity ? emoji.diversityIndex : emoji.index;
		if (index === undefined) return {url: emoji.url, useImg: true, useNative: false};

		const perRow = hasDiversity ? EMOJI_SPRITES.DiversityPerRow : EMOJI_SPRITES.NonDiversityPerRow;
		const x = -(index % perRow) * EMOJI_SPRITE_SIZE;
		const y = -Math.floor(index / perRow) * EMOJI_SPRITE_SIZE;

		return {
			style: {
				backgroundImage: getSpriteSheetBackground(hasDiversity ? skinTone : ''),
				backgroundPosition: `${x}px ${y}px`,
				backgroundSize: hasDiversity
					? `${EMOJI_SPRITE_SIZE * EMOJI_SPRITES.DiversityPerRow}px`
					: `${EMOJI_SPRITE_SIZE * EMOJI_SPRITES.NonDiversityPerRow}px`,
			},
			useImg: false,
			useNative: false,
		};
	};

	const emojiDisplay = getEmojiForDisplay(hoveredEmoji);

	const renderEmoji = () => {
		if (!emojiDisplay || !hoveredEmoji) return null;
		if (emojiDisplay.useNative) {
			const hasDiversity = hoveredEmoji.hasDiversity && skinTone;
			const displayEmoji = hasDiversity ? hoveredEmoji.surrogates + skinTone : hoveredEmoji.surrogates;
			return <span className={styles.inspectorNativeEmoji}>{displayEmoji}</span>;
		}
		if (emojiDisplay.useImg) {
			return <img src={hoveredEmoji.url ?? ''} alt={hoveredEmoji.name} className={styles.inspectorEmoji} />;
		}
		return <div className={styles.inspectorEmojiSprite} style={emojiDisplay.style} />;
	};

	return (
		<div className={styles.inspector}>
			{hoveredEmoji && (
				<>
					{renderEmoji()}
					<span className={styles.inspectorText}>{hoveredEmoji.allNamesString}</span>
				</>
			)}
		</div>
	);
});
