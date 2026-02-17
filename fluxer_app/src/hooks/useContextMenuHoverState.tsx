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

import ContextMenuStore, {isContextMenuNodeTarget} from '@app/stores/ContextMenuStore';
import {autorun} from 'mobx';
import {type RefObject, useEffect, useState} from 'react';

export function useContextMenuHoverState(elementRef: RefObject<HTMLElement | null>, enabled: boolean = true): boolean {
	const [contextMenuOpen, setContextMenuOpen] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setContextMenuOpen(false);
			return;
		}

		const disposer = autorun(() => {
			const contextMenu = ContextMenuStore.contextMenu;
			const target = contextMenu?.target?.target ?? null;
			const element = elementRef.current;
			const isOpen = Boolean(contextMenu) && isContextMenuNodeTarget(target) && Boolean(element?.contains(target));

			setContextMenuOpen(isOpen);
		});

		return () => disposer();
	}, [elementRef, enabled]);

	return contextMenuOpen;
}
