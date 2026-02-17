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

import type {AutocompleteOption} from '@app/components/channel/Autocomplete';
import wrapperStyles from '@app/components/channel/textarea/InputWrapper.module.css';
import styles from '@app/components/channel/textarea/MobileTextareaLayout.module.css';
import textareaStyles from '@app/components/channel/textarea/TextareaInput.module.css';
import {TextareaInputField} from '@app/components/channel/textarea/TextareaInputField';
import VoiceMessageRecorder from '@app/components/channel/VoiceMessageRecorder';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {FADE_MOTION, getReducedMotionProps} from '@app/utils/ReducedMotionAnimation';
import {useLingui} from '@lingui/react/macro';
import {ArrowUpIcon, PlusIcon, SmileyIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import type React from 'react';
import {type Dispatch, type SetStateAction, useRef} from 'react';

interface MobileTextareaLayoutProps {
	disabled: boolean;
	canAttachFiles: boolean;
	value: string;
	placeholderText: string;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	scrollerRef: React.RefObject<ScrollerHandle | null>;
	isFocused: boolean;
	isAutocompleteAttached: boolean;
	autocompleteOptions: Array<AutocompleteOption>;
	selectedIndex: number;
	channelId: string;
	isSlowmodeActive: boolean;
	isOverCharacterLimit: boolean;
	hasContent: boolean;
	hasAttachments: boolean;
	hasPendingSticker?: boolean;
	isEditingScheduledMessage: boolean;
	onFocus: () => void;
	onBlur: () => void;
	onChange: (value: string) => void;
	onHeightChange: (height: number) => void;
	onCursorMove: () => void;
	onArrowUp: (event: React.KeyboardEvent) => void;
	onSubmit: () => void;
	onAutocompleteSelect: (option: AutocompleteOption) => void;
	setSelectedIndex: Dispatch<SetStateAction<number>>;
	onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onPlusClick: () => void;
	onEmojiClick: () => void;
}

export function MobileTextareaLayout({
	disabled,
	canAttachFiles,
	value,
	placeholderText,
	textareaRef,
	scrollerRef,
	isFocused,
	isAutocompleteAttached,
	autocompleteOptions,
	selectedIndex,
	channelId,
	isSlowmodeActive,
	isOverCharacterLimit,
	hasContent,
	hasAttachments,
	hasPendingSticker,
	isEditingScheduledMessage,
	onFocus,
	onBlur,
	onChange,
	onHeightChange,
	onCursorMove,
	onArrowUp,
	onSubmit,
	onAutocompleteSelect,
	setSelectedIndex,
	onKeyDown,
	onPlusClick,
	onEmojiClick,
}: MobileTextareaLayoutProps) {
	const {t} = useLingui();

	const fadeMotion = getReducedMotionProps(FADE_MOTION, AccessibilityStore.useReducedMotion);
	const baseSendDisabled = isSlowmodeActive || isOverCharacterLimit || isEditingScheduledMessage;
	const sendButtonDisabled = baseSendDisabled || (!hasContent && !hasAttachments && !hasPendingSticker);
	const shouldShowVoiceButton = canAttachFiles && !hasContent && !hasAttachments && !hasPendingSticker;
	const voiceButtonDisabled = baseSendDisabled || disabled;
	const voiceTooltipAnchorRef = useRef<HTMLDivElement | null>(null);

	return (
		<div className={clsx(styles.mobileTextareaWrapper, disabled && wrapperStyles.disabled)}>
			{!disabled && canAttachFiles && (
				<div className={styles.mobilePlusButtonContainer}>
					<button type="button" className={styles.mobilePlusButton} onClick={onPlusClick} aria-label={t`Open menu`}>
						<PlusIcon className={styles.mobilePlusButtonIcon} weight="bold" />
					</button>
				</div>
			)}

			<div className={styles.mobileContentWrapper}>
				<div className={styles.mobileInputContainer} ref={voiceTooltipAnchorRef}>
					<div className={styles.mobileInputContent}>
						<Scroller ref={scrollerRef} fade={true} className={textareaStyles.scroller} key="mobile-textarea-scroller">
							<div className={textareaStyles.flexColumn}>
								<TextareaInputField
									channelId={channelId}
									disabled={disabled}
									isMobile={true}
									value={value}
									placeholder={placeholderText}
									textareaRef={textareaRef}
									isFocused={isFocused}
									isAutocompleteAttached={isAutocompleteAttached}
									autocompleteOptions={autocompleteOptions}
									selectedIndex={selectedIndex}
									className={textareaStyles.textareaMobile}
									onFocus={onFocus}
									onBlur={onBlur}
									onChange={onChange}
									onHeightChange={onHeightChange}
									onCursorMove={onCursorMove}
									onArrowUp={onArrowUp}
									onEnter={onSubmit}
									onAutocompleteSelect={onAutocompleteSelect}
									setSelectedIndex={setSelectedIndex}
									onKeyDown={onKeyDown}
								/>
							</div>
						</Scroller>
					</div>

					{!disabled && (
						<div className={styles.mobileEmojiButtonContainer}>
							<button type="button" className={styles.mobileEmojiButton} onClick={onEmojiClick} aria-label={t`Emojis`}>
								<SmileyIcon className={styles.mobileEmojiButtonIcon} weight="fill" />
							</button>
						</div>
					)}
				</div>

				<div className={styles.mobileRightButtonContainer}>
					<AnimatePresence mode="wait" initial={false}>
						{shouldShowVoiceButton ? (
							<motion.div key="voice-button" {...fadeMotion}>
								<VoiceMessageRecorder
									channelId={channelId}
									disabled={voiceButtonDisabled}
									tooltipAnchorRef={voiceTooltipAnchorRef}
								/>
							</motion.div>
						) : (
							<motion.button
								key="send-button"
								type="button"
								className={styles.mobileSendButton}
								onClick={onSubmit}
								aria-label={t`Send Message`}
								disabled={sendButtonDisabled}
								{...fadeMotion}
							>
								<ArrowUpIcon className={styles.mobileRightButtonIcon} weight="bold" />
							</motion.button>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}

MobileTextareaLayout.displayName = 'MobileTextareaLayout';
