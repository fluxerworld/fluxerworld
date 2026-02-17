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

import {canFocusTextarea, safeFocus} from '@app/lib/InputFocusManager';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildEmojiRecord} from '@app/records/GuildEmojiRecord';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiStore from '@app/stores/EmojiStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import {detectPastedSegments, type LookupFunctions} from '@app/utils/PasteSegmentUtils';
import type {MentionSegment, TextareaSegmentManager} from '@app/utils/TextareaSegmentManager';
import {useCallback, useEffect} from 'react';

interface UseTextareaPasteParams {
	channel?: ChannelRecord | null;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	segmentManagerRef: React.MutableRefObject<TextareaSegmentManager>;
	setValue: React.Dispatch<React.SetStateAction<string>>;
	previousValueRef: React.MutableRefObject<string>;
	maxMessageLength?: number;
	onPasteExceedsLimit?: (pastedText: string) => void;
}

export function useTextareaPaste({
	channel,
	textareaRef,
	segmentManagerRef,
	setValue,
	previousValueRef,
	maxMessageLength,
	onPasteExceedsLimit,
}: UseTextareaPasteParams) {
	const applyPastedText = useCallback(
		(pastedText: string, opts: {forceHandlePlainText: boolean}): boolean => {
			const textarea = textareaRef.current;
			if (!textarea) return false;

			const currentValue = textarea.value;
			const rawSelectionStart = textarea.selectionStart ?? 0;
			const rawSelectionEnd = textarea.selectionEnd ?? 0;
			const selectionStart = Math.min(rawSelectionStart, rawSelectionEnd);
			const selectionEnd = Math.max(rawSelectionStart, rawSelectionEnd);

			const beforeSelection = currentValue.slice(0, selectionStart);
			const afterSelection = currentValue.slice(selectionEnd);
			const maxLength = maxMessageLength ?? null;
			const handleExceedsLimit = onPasteExceedsLimit ?? null;

			const guildId = channel?.guildId;

			const lookups: LookupFunctions = {
				userById: (id: string) => {
					const user = UserStore.getUser(id);
					return user ? {id: user.id, tag: user.tag} : null;
				},
				channelById: (id: string) => {
					const foundChannel = ChannelStore.getChannel(id);
					return foundChannel?.name ? {id: foundChannel.id, name: foundChannel.name} : null;
				},
				roleById: (id: string) => {
					if (!guildId) return null;
					const roles = GuildStore.getGuildRoles(guildId);
					const role = roles.find((r) => r.id === id);
					return role ? {id: role.id, name: role.name} : null;
				},
				emojiById: (id: string) => {
					if (guildId) {
						const guildEmojis = EmojiStore.getGuildEmoji(guildId);
						const emoji = guildEmojis.find((e: GuildEmojiRecord) => e.id === id);
						if (emoji) return {id: emoji.id, name: emoji.name, uniqueName: emoji.uniqueName};
					}

					const guilds = GuildStore.getGuilds();
					for (const guild of guilds) {
						const emojis = EmojiStore.getGuildEmoji(guild.id);
						const emoji = emojis.find((e: GuildEmojiRecord) => e.id === id);
						if (emoji) return {id: emoji.id, name: emoji.name, uniqueName: emoji.uniqueName};
					}

					return null;
				},
			};

			const pasteSegments = detectPastedSegments(pastedText, 0, lookups);
			if (pasteSegments.length === 0) {
				if (!opts.forceHandlePlainText) {
					return false;
				}

				const newText = beforeSelection + pastedText + afterSelection;
				const previousSegments = segmentManagerRef.current.getSegments();
				segmentManagerRef.current.updateSegmentsForTextChange(selectionStart, selectionEnd, pastedText.length);

				if (maxLength != null && handleExceedsLimit) {
					const candidateActualText = segmentManagerRef.current.displayToActual(newText);
					if (candidateActualText.length > maxLength) {
						segmentManagerRef.current.setSegments(previousSegments);
						handleExceedsLimit(pastedText);
						return true;
					}
				}

				setValue(newText);
				previousValueRef.current = newText;

				const newCursorPosition = selectionStart + pastedText.length;
				setTimeout(() => {
					const t = textareaRef.current;
					if (t) {
						t.setSelectionRange(newCursorPosition, newCursorPosition);
					}
				}, 0);

				return true;
			}

			// Convert markdown segments (e.g. <:name:id>) into display segments (e.g. :name:),
			// then add segment mappings for the pasted range.
			let displayPastedText = pastedText;
			let offset = 0;
			const newSegments: Array<{
				start: number;
				displayText: string;
				actualText: string;
				type: MentionSegment['type'];
				id: string;
			}> = [];

			for (const seg of pasteSegments) {
				const originalLength = seg.end - seg.start;
				const adjustedStart = seg.start + offset;

				displayPastedText =
					displayPastedText.slice(0, adjustedStart) +
					seg.displayText +
					displayPastedText.slice(adjustedStart + originalLength);

				newSegments.push({
					start: selectionStart + adjustedStart,
					displayText: seg.displayText,
					actualText: seg.actualText,
					type: seg.type,
					id: seg.id,
				});

				offset += seg.displayText.length - originalLength;
			}

			const newText = beforeSelection + displayPastedText + afterSelection;
			const previousSegments = segmentManagerRef.current.getSegments();
			segmentManagerRef.current.updateSegmentsForTextChange(selectionStart, selectionEnd, displayPastedText.length);

			const updatedSegments = segmentManagerRef.current.getSegments();
			const mappedSegments = newSegments.map((seg) => ({
				...seg,
				end: seg.start + seg.displayText.length,
			}));
			segmentManagerRef.current.setSegments([...updatedSegments, ...mappedSegments]);

			if (maxLength != null && handleExceedsLimit) {
				const candidateActualText = segmentManagerRef.current.displayToActual(newText);
				if (candidateActualText.length > maxLength) {
					segmentManagerRef.current.setSegments(previousSegments);
					handleExceedsLimit(pastedText);
					return true;
				}
			}

			setValue(newText);
			previousValueRef.current = newText;

			const newCursorPosition = selectionStart + displayPastedText.length;
			setTimeout(() => {
				const t = textareaRef.current;
				if (t) {
					t.setSelectionRange(newCursorPosition, newCursorPosition);
				}
			}, 0);

			return true;
		},
		[channel, textareaRef, segmentManagerRef, setValue, previousValueRef, maxMessageLength, onPasteExceedsLimit],
	);

	const handleCopy = useCallback(
		(event: ClipboardEvent) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const selectionStart = textarea.selectionStart ?? 0;
			const selectionEnd = textarea.selectionEnd ?? 0;

			if (selectionStart === selectionEnd) {
				return;
			}

			const actualText = segmentManagerRef.current.displayToActualSubstring(
				textarea.value,
				selectionStart,
				selectionEnd,
			);

			event.preventDefault();
			event.clipboardData?.setData('text/plain', actualText);
		},
		[textareaRef, segmentManagerRef],
	);

	const handleCut = useCallback(
		(event: ClipboardEvent) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const selectionStart = textarea.selectionStart ?? 0;
			const selectionEnd = textarea.selectionEnd ?? 0;

			if (selectionStart === selectionEnd) {
				return;
			}

			const actualText = segmentManagerRef.current.displayToActualSubstring(
				textarea.value,
				selectionStart,
				selectionEnd,
			);

			event.preventDefault();
			event.clipboardData?.setData('text/plain', actualText);

			const currentValue = textarea.value;
			const newValue = currentValue.slice(0, selectionStart) + currentValue.slice(selectionEnd);

			segmentManagerRef.current.updateSegmentsForTextChange(selectionStart, selectionEnd, 0);

			setValue(newValue);
			previousValueRef.current = newValue;

			setTimeout(() => {
				const t = textareaRef.current;
				if (t) {
					t.setSelectionRange(selectionStart, selectionStart);
				}
			}, 0);
		},
		[textareaRef, segmentManagerRef, setValue, previousValueRef],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent) => {
			const rawPastedText = event.clipboardData?.getData('text/plain');
			if (!rawPastedText) return;

			const pastedText = rawPastedText.replace(/\t/g, '    ');
			const hadTabs = pastedText !== rawPastedText;

			if (maxMessageLength != null && onPasteExceedsLimit) {
				const textarea = textareaRef.current;
				if (textarea) {
					const currentValue = textarea.value;
					const selectionStart = textarea.selectionStart ?? 0;
					const selectionEnd = textarea.selectionEnd ?? 0;

					const currentActualText = segmentManagerRef.current.displayToActual(currentValue);
					const selectedActualText = segmentManagerRef.current.displayToActualSubstring(
						currentValue,
						Math.min(selectionStart, selectionEnd),
						Math.max(selectionStart, selectionEnd),
					);
					const resultLength = currentActualText.length - selectedActualText.length + pastedText.length;

					if (resultLength > maxMessageLength) {
						event.preventDefault();
						onPasteExceedsLimit(pastedText);
						return;
					}
				}
			}

			const handled = applyPastedText(pastedText, {forceHandlePlainText: hadTabs});

			if (handled) {
				event.preventDefault();
			}
		},
		[applyPastedText, maxMessageLength, onPasteExceedsLimit, textareaRef, segmentManagerRef],
	);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.addEventListener('copy', handleCopy);
		textarea.addEventListener('paste', handlePaste);
		textarea.addEventListener('cut', handleCut);

		return () => {
			textarea.removeEventListener('copy', handleCopy);
			textarea.removeEventListener('paste', handlePaste);
			textarea.removeEventListener('cut', handleCut);
		};
	}, [handleCopy, handlePaste, handleCut, textareaRef]);

	useEffect(() => {
		const handleWindowPaste = (event: ClipboardEvent) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			if (document.activeElement === textarea) {
				return;
			}

			const rawPastedText = event.clipboardData?.getData('text/plain');
			if (!rawPastedText) return;

			const pastedText = rawPastedText.replace(/\t/g, '    ');

			if (!canFocusTextarea(textarea)) {
				return;
			}

			if (maxMessageLength != null && onPasteExceedsLimit) {
				const currentValue = textarea.value;
				const currentActualText = segmentManagerRef.current.displayToActual(currentValue);
				const resultLength = currentActualText.length + pastedText.length;

				if (resultLength > maxMessageLength) {
					event.preventDefault();
					onPasteExceedsLimit(pastedText);
					return;
				}
			}

			event.preventDefault();
			safeFocus(textarea, true);

			applyPastedText(pastedText, {forceHandlePlainText: true});
		};

		window.addEventListener('paste', handleWindowPaste);
		return () => {
			window.removeEventListener('paste', handleWindowPaste);
		};
	}, [textareaRef, applyPastedText, maxMessageLength, onPasteExceedsLimit, segmentManagerRef]);
}
