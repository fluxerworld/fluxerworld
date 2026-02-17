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

import {ExpressionPickerPopout} from '@app/components/popouts/ExpressionPickerPopout';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export const EmojiPickerPopout = observer(
	({
		channelId,
		handleSelect,
		onClose,
	}: {
		channelId: string | null;
		handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
		onClose?: () => void;
	}) => {
		const handleEmojiSelect = useCallback(
			(emoji: FlatEmoji, shiftKey?: boolean) => {
				handleSelect(emoji, shiftKey);
				if (!shiftKey && onClose) {
					onClose();
				}
			},
			[handleSelect, onClose],
		);

		return (
			<ExpressionPickerPopout
				channelId={channelId ?? undefined}
				onEmojiSelect={handleEmojiSelect}
				onClose={onClose}
				visibleTabs={['emojis']}
			/>
		);
	},
);
