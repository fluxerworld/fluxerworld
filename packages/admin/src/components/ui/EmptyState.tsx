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

interface EmptyStateProps {
	variant?: 'empty' | 'loading' | 'error';
	children: Child;
	class?: string;
}

export function EmptyState({variant = 'empty', children, class: className}: EmptyStateProps) {
	const variantStyles = {
		empty: 'text-neutral-500 text-center py-8',
		loading: 'text-neutral-500 text-center py-8',
		error: 'text-red-600 text-center py-8',
	};

	return <div class={cn(variantStyles[variant], className)}>{children}</div>;
}
