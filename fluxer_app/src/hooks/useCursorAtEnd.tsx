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

import {useCallback, useRef} from 'react';

export function useCursorAtEnd<T extends HTMLInputElement | HTMLTextAreaElement>(): React.RefCallback<T> {
	const cleanupRef = useRef<(() => void) | null>(null);

	return useCallback((node: T | null) => {
		cleanupRef.current?.();
		cleanupRef.current = null;

		if (!node) {
			return;
		}
		const element = node;

		let isActive = true;
		let frameId: number | null = null;

		function placeCursorAtEnd(): void {
			if (!isActive || document.activeElement !== element) {
				return;
			}
			const length = element.value.length;
			element.setSelectionRange(length, length);
		}

		function scheduleCursorPlacement(): void {
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
			}
			frameId = requestAnimationFrame(() => {
				frameId = null;
				placeCursorAtEnd();
			});
		}

		element.addEventListener('focus', scheduleCursorPlacement);
		scheduleCursorPlacement();

		cleanupRef.current = () => {
			isActive = false;
			element.removeEventListener('focus', scheduleCursorPlacement);
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
				frameId = null;
			}
		};
	}, []);
}
