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

import type React from 'react';
import {useCallback, useRef, useState} from 'react';

type HoverHook = [React.RefCallback<HTMLElement>, boolean];

export const useHover = (delay = 0): HoverHook => {
	const [hovering, setHovering] = useState(false);
	const previousNode = useRef<HTMLElement | null>(null);
	const timeoutId = useRef<NodeJS.Timeout | null>(null);

	const handleMouseEnter = useCallback(() => {
		if (timeoutId.current) {
			clearTimeout(timeoutId.current);
		}
		timeoutId.current = setTimeout(() => {
			setHovering(true);
		}, delay);
	}, [delay]);

	const handleMouseLeave = useCallback(() => {
		if (timeoutId.current) {
			clearTimeout(timeoutId.current);
		}
		setHovering(false);
	}, []);

	const customRef = useCallback(
		(node: HTMLElement | null) => {
			if (previousNode.current) {
				previousNode.current.removeEventListener('mouseenter', handleMouseEnter);
				previousNode.current.removeEventListener('mouseleave', handleMouseLeave);
			}

			if (node) {
				node.addEventListener('mouseenter', handleMouseEnter);
				node.addEventListener('mouseleave', handleMouseLeave);
			}

			previousNode.current = node;
		},
		[handleMouseEnter, handleMouseLeave],
	);

	return [customRef, hovering];
};
