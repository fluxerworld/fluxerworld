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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {PropsWithChildren} from 'hono/jsx';

export interface TwoColumnGridProps {
	gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
	sm: 'gap-2',
	md: 'gap-4',
	lg: 'gap-6',
};

export function TwoColumnGrid({gap = 'md', children}: PropsWithChildren<TwoColumnGridProps>) {
	return <div class={`grid grid-cols-1 md:grid-cols-2 ${gapClasses[gap]}`}>{children}</div>;
}
