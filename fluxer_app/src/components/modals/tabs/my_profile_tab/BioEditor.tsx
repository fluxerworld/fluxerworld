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

import {Autocomplete, type AutocompleteOption, type AutocompleteType} from '@app/components/channel/Autocomplete';
import {Textarea} from '@app/components/form/Input';
import styles from '@app/components/modals/tabs/my_profile_tab/BioEditor.module.css';
import {ExpressionPickerPopout} from '@app/components/popouts/ExpressionPickerPopout';
import {CharacterCounter} from '@app/components/uikit/character_counter/CharacterCounter';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {useMarkdownKeybinds} from '@app/hooks/useMarkdownKeybinds';
import {useTextareaAutocompleteKeyboard} from '@app/hooks/useTextareaAutocompleteKeyboard';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {Trans, useLingui} from '@lingui/react/macro';
import {SmileyIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

interface BioEditorProps {
	value: string;
	onChange: (value: string) => void;
	onEmojiSelect: (emoji: FlatEmoji, shiftKey?: boolean) => boolean;
	placeholder?: string;
	displayMaxLength: number;
	actualLength: number;
	actualMaxLength: number;
	disabled?: boolean;
	isMobile: boolean;
	errorMessage?: string;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	emojiPickerOpen: boolean;
	onEmojiPickerOpenChange: (open: boolean) => void;
	containerRef: React.RefObject<HTMLDivElement | null>;
	autocompleteQuery?: string;
	autocompleteOptions?: Array<AutocompleteOption>;
	autocompleteType?: AutocompleteType;
	selectedIndex?: number;
	isAutocompleteAttached?: boolean;
	setSelectedIndex?: React.Dispatch<React.SetStateAction<number>>;
	onCursorMove?: () => void;
	handleSelect?: (option: AutocompleteOption) => void;
	autocompleteZIndex?: number;
}

export const BioEditor = observer(
	({
		value,
		onChange,
		onEmojiSelect,
		placeholder,
		displayMaxLength,
		actualLength,
		actualMaxLength,
		disabled,
		isMobile,
		errorMessage,
		textareaRef,
		emojiPickerOpen,
		onEmojiPickerOpenChange,
		containerRef,
		autocompleteQuery,
		autocompleteOptions,
		autocompleteType,
		selectedIndex,
		isAutocompleteAttached,
		setSelectedIndex,
		onCursorMove,
		handleSelect,
		autocompleteZIndex,
	}: BioEditorProps) => {
		const {t} = useLingui();
		const [isFocused, setIsFocused] = useState(false);

		useMarkdownKeybinds(isFocused);
		const handleBioEmojiSelect = useCallback(
			(emoji: FlatEmoji, shiftKey?: boolean) => {
				const didInsert = onEmojiSelect(emoji, shiftKey);
				if (didInsert && !shiftKey) {
					onEmojiPickerOpenChange(false);
				}
				return didInsert;
			},
			[onEmojiSelect, onEmojiPickerOpenChange],
		);

		const {handleKeyDown} = useTextareaAutocompleteKeyboard({
			isAutocompleteAttached: isAutocompleteAttached || false,
			autocompleteOptions: autocompleteOptions || [],
			selectedIndex: selectedIndex || 0,
			setSelectedIndex: setSelectedIndex || (() => {}),
			handleSelect: handleSelect || (() => {}),
		});

		return (
			<div>
				{isAutocompleteAttached && handleSelect && setSelectedIndex && (
					<Autocomplete
						type={autocompleteType || 'emoji'}
						onSelect={handleSelect}
						selectedIndex={selectedIndex || 0}
						options={autocompleteOptions || []}
						setSelectedIndex={setSelectedIndex}
						referenceElement={containerRef.current}
						query={autocompleteQuery || ''}
						zIndex={autocompleteZIndex}
					/>
				)}

				<div ref={containerRef}>
					<Textarea
						ref={textareaRef}
						label={t`About Me`}
						placeholder={placeholder}
						maxLength={displayMaxLength}
						minRows={4}
						maxRows={4}
						showCharacterCount={true}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						onKeyDown={handleKeyDown}
						onKeyUp={onCursorMove}
						onClick={onCursorMove}
						error={errorMessage}
						disabled={disabled}
						characterCountTooltip={() => (
							<CharacterCounter
								currentLength={actualLength}
								maxLength={actualMaxLength}
								canUpgrade={false}
								premiumMaxLength={actualMaxLength}
								onUpgradeClick={() => undefined}
							/>
						)}
						innerActionButton={
							isMobile ? (
								<FocusRing offset={-2} enabled={!disabled}>
									<button
										type="button"
										onClick={() => onEmojiPickerOpenChange(true)}
										className={clsx(styles.emojiButton, emojiPickerOpen && styles.emojiButtonActive)}
										disabled={disabled}
									>
										<SmileyIcon size={20} weight="fill" />
									</button>
								</FocusRing>
							) : (
								<Popout
									position="bottom-end"
									animationType="none"
									offsetMainAxis={8}
									offsetCrossAxis={0}
									onOpen={() => onEmojiPickerOpenChange(true)}
									onClose={() => onEmojiPickerOpenChange(false)}
									returnFocusRef={textareaRef}
									render={({onClose}) => (
										<ExpressionPickerPopout
											onEmojiSelect={(emoji, shiftKey) => {
												const didInsert = handleBioEmojiSelect(emoji, shiftKey);
												if (didInsert && !shiftKey) {
													onClose();
												}
											}}
											onClose={onClose}
											visibleTabs={['emojis']}
										/>
									)}
								>
									<FocusRing offset={-2} enabled={!disabled}>
										<button
											type="button"
											className={clsx(styles.emojiButton, emojiPickerOpen && styles.emojiButtonActive)}
											disabled={disabled}
										>
											<SmileyIcon size={20} weight="fill" />
										</button>
									</FocusRing>
								</Popout>
							)
						}
					/>
				</div>
				<div className={styles.description}>
					<Trans>You can use links, emoji, and Markdown.</Trans>
				</div>
			</div>
		);
	},
);
