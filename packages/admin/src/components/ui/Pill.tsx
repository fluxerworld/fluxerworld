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

import clsx from 'clsx';
import type {PropsWithChildren} from 'hono/jsx';

export interface PillProps {
	tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
}

export function Pill({tone = 'neutral', children}: PropsWithChildren<PillProps>) {
	const classes = clsx('inline-block rounded-lg border px-3 py-2 font-medium text-sm shadow-sm', {
		'border-gray-200 bg-neutral-100 text-neutral-700': tone === 'neutral',
		'border-green-200 bg-green-50 text-green-700': tone === 'success',
		'border-red-200 bg-red-50 text-red-700': tone === 'danger',
		'border-neutral-200 bg-neutral-50 text-neutral-700': tone === 'warning',
		'border-blue-200 bg-blue-50 text-blue-700': tone === 'info',
	});

	return <span class={classes}>{children}</span>;
}
