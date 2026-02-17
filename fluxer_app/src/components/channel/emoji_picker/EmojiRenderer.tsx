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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as EmojiPickerActionCreators from '@app/actions/EmojiPickerActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import styles from '@app/components/channel/EmojiPicker.module.css';
import {
	EMOJI_PICKER_CUSTOM_EMOJI_SIZE,
	EMOJI_SPRITE_SIZE,
	getSpriteSheetBackground,
} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {EMOJI_SPRITES} from '@app/lib/UnicodeEmojis';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {checkEmojiAvailability} from '@app/utils/ExpressionPermissionUtils';
import {setUrlQueryParams} from '@app/utils/UrlUtils';
import {useLingui} from '@lingui/react/macro';
import {ClipboardIcon, StarIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import React, {useEffect, useImperativeHandle, useRef} from 'react';

interface EmojiRendererProps {
	emoji: FlatEmoji;
	handleHover: (emoji: FlatEmoji | null) => void;
	handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	skinTone: string;
	spriteSheetSizes: {nonDiversitySize: string; diversitySize: string};
	channel: ChannelRecord | null;
	shouldAnimate: boolean;
	isHighlighted?: boolean;
	shouldScrollIntoView?: boolean;
}

export const EmojiRenderer = React.forwardRef<HTMLButtonElement, EmojiRendererProps>(
	(
		{
			emoji,
			handleHover,
			handleSelect,
			skinTone,
			spriteSheetSizes,
			channel,
			shouldAnimate,
			isHighlighted = false,
			shouldScrollIntoView = false,
			...props
		},
		forwardedRef,
	) => {
		const emojiRef = useRef<HTMLButtonElement | null>(null);
		const {t, i18n} = useLingui();
		const isFavorite = EmojiPickerStore.isFavorite(emoji);

		useImperativeHandle(forwardedRef, () => emojiRef.current!);

		useEffect(() => {
			if (shouldScrollIntoView && emojiRef.current) {
				emojiRef.current.scrollIntoView({block: 'nearest', inline: 'nearest'});
			}
		}, [shouldScrollIntoView]);

		const availability = checkEmojiAvailability(i18n, emoji, channel);
		const customEmojiUrl = emoji.id
			? setUrlQueryParams(AvatarUtils.getEmojiURL({id: emoji.id, animated: Boolean(emoji.animated) && shouldAnimate}), {
					size: EMOJI_PICKER_CUSTOM_EMOJI_SIZE,
				})
			: (emoji.url ?? '');

		const handleClick = (e: React.MouseEvent) => {
			if (!availability.canUse) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			if (e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				EmojiPickerActionCreators.toggleFavorite(emoji);
				return;
			}

			handleSelect(emoji, e.shiftKey);
		};

		const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();

			ContextMenuActionCreators.openFromEvent(e, (props) => (
				<>
					<MenuGroup>
						<MenuItem
							icon={<StarIcon className={styles.iconSmall} weight={isFavorite ? 'fill' : 'bold'} />}
							onClick={() => {
								EmojiPickerActionCreators.toggleFavorite(emoji);
							}}
						>
							{isFavorite ? t`Unfavorite Emoji` : t`Favorite Emoji`}
						</MenuItem>
						{emoji.id && (
							<MenuItem
								icon={<ClipboardIcon className={styles.iconSmall} />}
								onClick={() => {
									TextCopyActionCreators.copy(i18n, emoji.id!);
									props.onClose();
								}}
							>
								{t`Copy Emoji ID`}
							</MenuItem>
						)}
					</MenuGroup>
				</>
			));
		};

		const renderButton = (children: React.ReactNode) => {
			const isDisabled = !availability.canUse;
			const className = clsx(
				styles.emojiRenderer,
				isHighlighted && styles.selectedEmojiRenderer,
				isDisabled && 'cursor-not-allowed',
			);

			return (
				<FocusRing offset={-2}>
					<button
						type="button"
						tabIndex={-1}
						ref={emojiRef}
						onMouseEnter={() => handleHover(emoji)}
						onMouseLeave={() => handleHover(null)}
						onClick={handleClick}
						onContextMenu={handleContextMenu}
						className={className}
						aria-disabled={isDisabled}
						aria-selected={isHighlighted}
						role="option"
						{...props}
					>
						{children}
					</button>
				</FocusRing>
			);
		};

		if (emoji.guildId || emoji.id) {
			const content = <img src={customEmojiUrl} alt={emoji.name} className={styles.emojiImage} loading="lazy" />;

			return renderButton(content);
		}

		if (shouldUseNativeEmoji && emoji.surrogates) {
			const hasDiversity = emoji.hasDiversity && skinTone;
			const displayEmoji = hasDiversity ? emoji.surrogates + skinTone : emoji.surrogates;
			return renderButton(<span className={styles.nativeEmoji}>{displayEmoji}</span>);
		}

		if (!emoji.useSpriteSheet) {
			return renderButton(<img src={emoji.url ?? ''} alt={emoji.name} className={styles.emojiImage} loading="lazy" />);
		}

		const hasDiversity = emoji.hasDiversity && skinTone;
		const index = hasDiversity ? emoji.diversityIndex : emoji.index;

		if (index === undefined) {
			return renderButton(<img src={emoji.url ?? ''} alt={emoji.name} className={styles.emojiImage} loading="lazy" />);
		}

		const perRow = hasDiversity ? EMOJI_SPRITES.DiversityPerRow : EMOJI_SPRITES.NonDiversityPerRow;
		const x = -(index % perRow) * EMOJI_SPRITE_SIZE;
		const y = -Math.floor(index / perRow) * EMOJI_SPRITE_SIZE;

		const spriteStyle = {
			backgroundImage: getSpriteSheetBackground(hasDiversity ? skinTone : ''),
			backgroundPosition: `${x}px ${y}px`,
			backgroundSize: hasDiversity ? spriteSheetSizes.diversitySize : spriteSheetSizes.nonDiversitySize,
		};

		return renderButton(<div className={styles.spriteEmoji} style={spriteStyle} />);
	},
);

EmojiRenderer.displayName = 'EmojiRenderer';
