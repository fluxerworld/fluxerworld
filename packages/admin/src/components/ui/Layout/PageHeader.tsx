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
import type {Child, PropsWithChildren} from 'hono/jsx';

export interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: Child;
}

export function PageHeader({title, description, actions, children}: PropsWithChildren<PageHeaderProps>) {
	return (
		<div>
			<div class={cn('flex items-start justify-between', description ? 'mb-2' : 'mb-0')}>
				<div class="flex min-w-0 flex-1 flex-col gap-2">
					<h1 class="font-bold text-3xl text-gray-900">{title}</h1>
					{description && <p class="text-base text-gray-600">{description}</p>}
				</div>
				{actions && <div class="ml-4 flex-shrink-0">{actions}</div>}
			</div>
			{children}
		</div>
	);
}
