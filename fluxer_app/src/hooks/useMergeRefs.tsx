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

import {type LegacyRef, type MutableRefObject, type RefCallback, useCallback, useRef} from 'react';

export function useMergeRefs<T>(
	refs: Array<MutableRefObject<T | null> | LegacyRef<T> | undefined | null>,
): RefCallback<T> {
	const latestRefs = useRef(refs);
	latestRefs.current = refs;

	return useCallback((value: T | null) => {
		for (const ref of latestRefs.current) {
			if (typeof ref === 'function') {
				ref(value);
			} else if (ref != null) {
				(ref as MutableRefObject<T | null>).current = value;
			}
		}
	}, []);
}
