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

import * as ExpressionPickerActionCreators from '@app/actions/ExpressionPickerActionCreators';
import * as PopoutActionCreators from '@app/actions/PopoutActionCreators';
import EmojiStore from '@app/stores/EmojiStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import type {TextareaSegmentManager} from '@app/utils/TextareaSegmentManager';
import {useCallback} from 'react';

interface UseTextareaEmojiPickerReturn {
	handleEmojiSelect: (emoji: FlatEmoji, shiftKey?: boolean) => boolean;
}

interface UseTextareaEmojiPickerParams {
	setValue: React.Dispatch<React.SetStateAction<string>>;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	segmentManagerRef: React.MutableRefObject<TextareaSegmentManager>;
	previousValueRef: React.MutableRefObject<string>;
	channelId?: string;
	maxActualLength?: number;
	onExceedMaxLength?: () => void;
}

export function useTextareaEmojiPicker({
	setValue,
	textareaRef,
	segmentManagerRef,
	previousValueRef,
	channelId,
	maxActualLength,
	onExceedMaxLength,
}: UseTextareaEmojiPickerParams): UseTextareaEmojiPickerReturn {
	const handleEmojiSelect = useCallback(
		(emoji: FlatEmoji, shiftKey?: boolean) => {
			const actualText = EmojiStore.getEmojiMarkdown(emoji);
			const displayText = `:${emoji.name}:`;

			const textarea = textareaRef.current;
			const rawSelectionStart = textarea?.selectionStart ?? null;
			const rawSelectionEnd = textarea?.selectionEnd ?? null;
			let nextCursorPosition: number | null = null;
			let didInsert = false;
			let didRejectForMaxLength = false;

			setValue((prevValue) => {
				const rawStart = rawSelectionStart ?? prevValue.length;
				const rawEnd = rawSelectionEnd ?? rawStart;
				const clampedStart = Math.min(prevValue.length, Math.max(0, Math.min(rawStart, rawEnd)));
				const clampedEnd = Math.min(prevValue.length, Math.max(0, Math.max(rawStart, rawEnd)));

				const beforeSelection = prevValue.slice(0, clampedStart);
				const afterSelection = prevValue.slice(clampedEnd);

				const needsSpaceBefore = beforeSelection.length > 0 && !/\s$/.test(beforeSelection);
				const needsSpaceAfter = afterSelection.length === 0 || !/^\s/.test(afterSelection);

				const prefix = needsSpaceBefore ? ' ' : '';
				const suffix = needsSpaceAfter ? ' ' : '';

				const displayInsertText = `${prefix}${displayText}${suffix}`;
				const actualInsertText = `${prefix}${actualText}${suffix}`;

				const segmentsBefore = maxActualLength != null ? segmentManagerRef.current.getSegments() : null;

				// Replace any current selection and keep segments aligned.
				segmentManagerRef.current.updateSegmentsForTextChange(clampedStart, clampedEnd, 0);
				const withoutSelection = beforeSelection + afterSelection;

				const {newText} = segmentManagerRef.current.insertSegment(
					withoutSelection,
					clampedStart,
					displayInsertText,
					actualInsertText,
					'emoji',
					emoji.id ?? emoji.uniqueName,
				);

				if (maxActualLength != null) {
					const candidateActualText = segmentManagerRef.current.displayToActual(newText);
					if (candidateActualText.length > maxActualLength) {
						didRejectForMaxLength = true;
						if (segmentsBefore) {
							segmentManagerRef.current.setSegments(segmentsBefore);
						}
						return prevValue;
					}
				}

				previousValueRef.current = newText;
				nextCursorPosition = clampedStart + displayInsertText.length;
				didInsert = true;
				return newText;
			});

			if (didRejectForMaxLength) {
				onExceedMaxLength?.();
				return false;
			}

			setTimeout(() => {
				const t = textareaRef.current;
				if (!t) return;
				t.focus();
				if (nextCursorPosition !== null) {
					t.setSelectionRange(nextCursorPosition, nextCursorPosition);
				}
			}, 0);

			if (didInsert && !shiftKey && channelId) {
				ExpressionPickerActionCreators.close();
				PopoutActionCreators.close(`expression-picker-${channelId}`);
			}

			return didInsert;
		},
		[segmentManagerRef, setValue, textareaRef, previousValueRef, channelId, maxActualLength, onExceedMaxLength],
	);

	return {
		handleEmojiSelect,
	};
}
