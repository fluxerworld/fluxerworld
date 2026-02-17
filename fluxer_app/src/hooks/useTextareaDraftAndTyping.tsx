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

import * as DraftActionCreators from '@app/actions/DraftActionCreators';
import * as ReplaceCommandUtils from '@app/utils/ReplaceCommandUtils';
import {TypingUtils} from '@app/utils/TypingUtils';
import {useEffect, useLayoutEffect, useRef} from 'react';

interface UseTextareaDraftAndTypingOptions {
	channelId: string;
	value: string;
	setValue: React.Dispatch<React.SetStateAction<string>>;
	draft: string | null;
	previousValueRef: React.MutableRefObject<string>;
	isAutocompleteAttached: boolean;
	enabled: boolean;
}

export const useTextareaDraftAndTyping = ({
	channelId,
	value,
	setValue,
	draft,
	previousValueRef,
	isAutocompleteAttached,
	enabled,
}: UseTextareaDraftAndTypingOptions) => {
	const isRestoringDraftRef = useRef(false);

	useEffect(() => {
		if (!enabled) {
			TypingUtils.clear(channelId);
		}
	}, [channelId, enabled]);

	useLayoutEffect(() => {
		if (draft && previousValueRef.current !== undefined) {
			isRestoringDraftRef.current = true;
			setValue(draft);
			if (previousValueRef.current !== null) {
				previousValueRef.current = draft;
			}
			setTimeout(() => {
				isRestoringDraftRef.current = false;
			}, 0);
		}
	}, [draft, previousValueRef, setValue]);

	useEffect(() => {
		if (value) {
			DraftActionCreators.createDraft(channelId, value);
		} else {
			DraftActionCreators.deleteDraft(channelId);
		}
	}, [channelId, value]);

	useEffect(() => {
		if (isRestoringDraftRef.current) {
			return;
		}
		if (!enabled) {
			return;
		}

		const content = value.trim();
		const isInReplaceMode = ReplaceCommandUtils.isReplaceCommand(content);
		const isSlashCommand = content.startsWith('/');
		if (content && !isAutocompleteAttached && !isInReplaceMode && !isSlashCommand) {
			TypingUtils.typing(channelId);
		} else {
			TypingUtils.clear(channelId);
		}
	}, [channelId, value, isAutocompleteAttached]);
};
