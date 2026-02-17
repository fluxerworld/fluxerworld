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

import HoldToRecordButton from '@app/components/channel/textarea/HoldToRecordButton';
import {TextareaButton} from '@app/components/channel/textarea/TextareaButton';
import textareaButtonsStyles from '@app/components/channel/textarea/TextareaButtons.module.css';
import styles from '@app/components/channel/textarea/TextareaInput.module.css';
import type {ExpressionPickerTabType} from '@app/components/popouts/ExpressionPickerPopout';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {getReducedMotionProps} from '@app/utils/ReducedMotionAnimation';
import {useLingui} from '@lingui/react/macro';
import {
	GifIcon,
	ImageSquareIcon,
	MicrophoneIcon,
	PaperPlaneRightIcon,
	SmileyIcon,
	StickerIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import React from 'react';

interface TextareaButtonsProps {
	disabled: boolean;
	showAllButtons: boolean;
	showGifButton: boolean;
	showMemesButton: boolean;
	showStickersButton: boolean;
	showEmojiButton: boolean;
	showMessageSendButton: boolean;
	showVoiceMessageButton?: boolean;
	onVoiceMessageClick?: () => void;
	channelId: string;
	expressionPickerOpen: boolean;
	selectedTab: ExpressionPickerTabType;
	isMobile: boolean;
	isSlowmodeActive: boolean;
	isOverLimit: boolean;
	hasContent: boolean;
	hasAttachments: boolean;
	expressionPickerTriggerRef: React.RefObject<HTMLButtonElement | null>;
	invisibleExpressionPickerTriggerRef: React.RefObject<HTMLDivElement | null>;
	onExpressionPickerToggle: (tab: ExpressionPickerTabType) => void;
	onSubmit: () => void;
	disableSendButton?: boolean;
}

export const TextareaButtons = React.forwardRef<HTMLDivElement, TextareaButtonsProps>(
	(
		{
			disabled,
			showAllButtons,
			showGifButton,
			showMemesButton,
			showStickersButton,
			showEmojiButton,
			showMessageSendButton,
			showVoiceMessageButton,
			onVoiceMessageClick,
			channelId,
			expressionPickerOpen,
			selectedTab,
			isMobile,
			isSlowmodeActive,
			isOverLimit,
			hasContent,
			hasAttachments,
			expressionPickerTriggerRef,
			invisibleExpressionPickerTriggerRef,
			onExpressionPickerToggle,
			onSubmit,
			disableSendButton,
		},
		ref,
	) => {
		const {t} = useLingui();

		if (disabled) {
			return null;
		}

		const buttonSwapMotion = getReducedMotionProps(
			{
				initial: {scale: 0.8, opacity: 0},
				animate: {scale: 1, opacity: 1},
				exit: {scale: 0.8, opacity: 0},
				transition: {duration: 0.15, ease: 'easeOut'},
			},
			AccessibilityStore.useReducedMotion,
		);
		const shouldShowDesktopSendButton = showMessageSendButton;
		const baseSendDisabled = isSlowmodeActive || isOverLimit || disableSendButton;
		const sendButtonDisabled = baseSendDisabled || (!hasContent && !hasAttachments);
		const shouldShowHoldToRecord = isMobile && showVoiceMessageButton && !hasContent && !hasAttachments;

		return (
			<div className={clsx(styles.buttonContainerDense, styles.sideButtonPadding)} ref={ref}>
				{!isMobile && showAllButtons && (
					<>
						{showGifButton && (
							<TextareaButton
								icon={GifIcon}
								label={t`GIFs`}
								isSelected={expressionPickerOpen && selectedTab === 'gifs'}
								onClick={() => onExpressionPickerToggle('gifs')}
								data-expression-picker-tab="gifs"
								keybindAction="toggle_gif_picker"
							/>
						)}

						{showMemesButton && (
							<TextareaButton
								icon={ImageSquareIcon}
								label={t`Media`}
								isSelected={expressionPickerOpen && selectedTab === 'memes'}
								onClick={() => onExpressionPickerToggle('memes')}
								data-expression-picker-tab="memes"
								keybindAction="toggle_memes_picker"
							/>
						)}

						{showStickersButton && (
							<TextareaButton
								icon={StickerIcon}
								label={t`Stickers`}
								isSelected={expressionPickerOpen && selectedTab === 'stickers'}
								onClick={() => onExpressionPickerToggle('stickers')}
								data-expression-picker-tab="stickers"
								keybindAction="toggle_sticker_picker"
							/>
						)}
					</>
				)}

				{showEmojiButton && (
					<TextareaButton
						ref={isMobile ? undefined : expressionPickerTriggerRef}
						icon={SmileyIcon}
						iconProps={{weight: 'fill'}}
						label={t`Emojis`}
						isSelected={expressionPickerOpen && selectedTab === 'emojis'}
						onClick={() => onExpressionPickerToggle('emojis')}
						data-expression-picker-tab="emojis"
						keybindAction="toggle_emoji_picker"
					/>
				)}

				<div ref={invisibleExpressionPickerTriggerRef} className={textareaButtonsStyles.invisibleTrigger} />

				{isMobile && showVoiceMessageButton && onVoiceMessageClick && !shouldShowHoldToRecord && (
					<TextareaButton icon={MicrophoneIcon} label={t`Voice message`} onClick={onVoiceMessageClick} />
				)}
				{isMobile && (
					<AnimatePresence mode="wait" initial={false}>
						{shouldShowHoldToRecord ? (
							<motion.div key="hold-to-record" {...buttonSwapMotion}>
								<HoldToRecordButton
									channelId={channelId}
									disabled={baseSendDisabled}
									onFallback={onVoiceMessageClick}
								/>
							</motion.div>
						) : (
							<motion.div key="send-button" {...buttonSwapMotion}>
								<TextareaButton
									disabled={sendButtonDisabled}
									icon={PaperPlaneRightIcon}
									label={t`Send Message`}
									onClick={onSubmit}
									keybindCombo={{key: 'Enter'}}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				)}

				{!isMobile && shouldShowDesktopSendButton && (
					<>
						<div className={styles.divider} />
						<TextareaButton
							disabled={isSlowmodeActive || isOverLimit || (!hasContent && !hasAttachments) || disableSendButton}
							icon={PaperPlaneRightIcon}
							label={t`Send Message`}
							onClick={onSubmit}
							keybindCombo={{key: 'Enter'}}
						/>
					</>
				)}
			</div>
		);
	},
);

TextareaButtons.displayName = 'TextareaButtons';
