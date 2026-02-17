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

import {cn} from '@fluxer/admin/src/utils/ClassNames';
import type {Child} from 'hono/jsx';

interface AlertProps {
	variant?: 'success' | 'warning' | 'error' | 'info';
	title?: string;
	children: Child;
	class?: string;
}

export function Alert({variant = 'info', title, children, class: className}: AlertProps) {
	const variantStyles = {
		success: 'bg-green-50 border-green-200 text-green-700',
		warning: 'bg-neutral-50 border-neutral-200 text-neutral-700',
		error: 'bg-red-50 border-red-200 text-red-700',
		info: 'bg-blue-50 border-blue-200 text-blue-700',
	};

	return (
		<div class={cn('rounded-lg border p-4', variantStyles[variant], className)}>
			{title && <div class="mb-2 font-bold">{title}</div>}
			<div>{children}</div>
		</div>
	);
}
