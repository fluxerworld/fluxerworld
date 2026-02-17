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

import * as EmojiActionCreators from '@app/actions/EmojiActionCreators';
import styles from '@app/components/channel/EmojiPicker.module.css';
import {EMOJI_CLAP} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import EmojiStore from '@app/stores/EmojiStore';
import * as EmojiUtils from '@app/utils/EmojiUtils';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {SKIN_TONE_SURROGATES} from '@fluxer/constants/src/EmojiConstants';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';

interface SkinTonePickerProps {
	isOpen: boolean;
	onClose: () => void;
	skinTone: string;
}

const SkinTonePicker = observer(({isOpen, onClose, skinTone}: SkinTonePickerProps) => {
	const prefersReducedMotion = AccessibilityStore.useReducedMotion;
	const handleSelect = (surrogate: string) => {
		EmojiActionCreators.setSkinTone(surrogate);
		ComponentDispatch.dispatch('EMOJI_PICKER_RERENDER');
		onClose();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={prefersReducedMotion ? {opacity: 1, height: 'auto'} : {opacity: 0, height: 0}}
					animate={{opacity: 1, height: 'auto'}}
					exit={prefersReducedMotion ? {opacity: 1, height: 'auto'} : {opacity: 0, height: 0}}
					transition={prefersReducedMotion ? {duration: 0} : undefined}
					className={styles.skinTonePickerOptions}
				>
					{[skinTone, ...['', ...SKIN_TONE_SURROGATES].filter((surrogate) => surrogate !== skinTone)].map(
						(surrogate, index) => {
							const emojiChar = EMOJI_CLAP + surrogate;
							const emojiUrl = EmojiUtils.getEmojiURL(emojiChar);
							return (
								<motion.button
									key={surrogate || 'default'}
									type="button"
									initial={prefersReducedMotion ? {opacity: 1, scale: 1} : {opacity: 0, scale: index === 0 ? 1 : 0}}
									animate={{opacity: 1, scale: 1}}
									exit={prefersReducedMotion ? {opacity: 1, scale: 1} : {opacity: 0, scale: 0}}
									transition={prefersReducedMotion ? {duration: 0} : undefined}
									className={styles.skinTonePickerItem}
									onClick={() => handleSelect(surrogate)}
								>
									{shouldUseNativeEmoji ? (
										<span className={styles.skinToneNativeEmoji}>{emojiChar}</span>
									) : (
										<div
											className={styles.skinTonePickerItemImage}
											style={{backgroundImage: emojiUrl ? `url(${emojiUrl})` : undefined}}
										/>
									)}
								</motion.button>
							);
						},
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
});

interface SkinTonePickerButtonProps {
	onClick: () => void;
	selectedEmojiURL: string | null;
	selectedEmojiChar: string;
}

const SkinTonePickerButton = observer(({onClick, selectedEmojiURL, selectedEmojiChar}: SkinTonePickerButtonProps) => (
	<motion.button
		type="button"
		className={styles.skinTonePickerButton}
		onClick={onClick}
		style={!shouldUseNativeEmoji && selectedEmojiURL ? {backgroundImage: `url(${selectedEmojiURL})`} : undefined}
		initial={{opacity: 1, scale: 1}}
		animate={{opacity: 1, scale: 1}}
		exit={{opacity: 0, scale: 0}}
	>
		{shouldUseNativeEmoji && <span className={styles.skinToneNativeEmoji}>{selectedEmojiChar}</span>}
	</motion.button>
));

export const SkinToneSelector = observer(() => {
	const [isOpen, setIsOpen] = useState(false);
	const skinTone = EmojiStore.skinTone;
	const selectedEmojiChar = EMOJI_CLAP + skinTone;
	const selectedEmojiUrl = EmojiUtils.getEmojiURL(selectedEmojiChar);
	const selectorRef = useRef<HTMLDivElement | null>(null);

	const handleClickOutside = useCallback((event: MouseEvent) => {
		if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
			setIsOpen(false);
		}
	}, []);

	useEffect(() => {
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [handleClickOutside]);

	return (
		<div ref={selectorRef} className={styles.skinToneSelectorContainer}>
			<SkinTonePicker isOpen={isOpen} onClose={() => setIsOpen(false)} skinTone={skinTone} />
			<SkinTonePickerButton
				onClick={() => setIsOpen(true)}
				selectedEmojiURL={selectedEmojiUrl}
				selectedEmojiChar={selectedEmojiChar}
			/>
		</div>
	);
});
