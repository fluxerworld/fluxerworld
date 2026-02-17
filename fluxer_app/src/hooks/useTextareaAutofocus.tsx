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

import {useInputFocusManagement} from '@app/hooks/useInputFocusManagement';
import {useEffect} from 'react';

export function useTextareaAutofocus(
	textareaRef: React.RefObject<HTMLTextAreaElement | null>,
	isMobile: boolean,
	enabled: boolean = true,
) {
	const {safeFocusTextarea, canFocus} = useInputFocusManagement(textareaRef);

	useEffect(() => {
		if (!enabled || isMobile || !textareaRef.current) {
			return;
		}

		const timer = setTimeout(() => {
			safeFocusTextarea();
		}, 100);

		return () => clearTimeout(timer);
	}, [enabled, isMobile, safeFocusTextarea]);

	return {
		shouldAutoFocus: enabled && !isMobile,
		canFocusTextarea: canFocus,
		manualFocus: safeFocusTextarea,
	};
}
