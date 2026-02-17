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

let activeDrags = 0;
let pendingClear: number | null = null;

const updateAttribute = (isActive: boolean): void => {
	if (!document.body) return;
	if (isActive) {
		document.body.setAttribute('data-scrollbar-dragging', 'true');
	} else {
		document.body.removeAttribute('data-scrollbar-dragging');
	}
};

const clearPendingTimeout = (): void => {
	if (pendingClear == null) return;
	window.clearTimeout(pendingClear);
	pendingClear = null;
};

const decrementDragCount = (): void => {
	if (activeDrags === 0) return;
	activeDrags -= 1;
	if (activeDrags === 0) {
		updateAttribute(false);
	}
};

export function beginScrollbarDrag() {
	clearPendingTimeout();
	activeDrags += 1;
	updateAttribute(true);
}

export function endScrollbarDrag() {
	clearPendingTimeout();
	decrementDragCount();
}

export function endScrollbarDragDeferred() {
	clearPendingTimeout();

	pendingClear = window.setTimeout(() => {
		pendingClear = null;
		decrementDragCount();
	}, 0);
}

export function isScrollbarDragActive() {
	return activeDrags > 0;
}
