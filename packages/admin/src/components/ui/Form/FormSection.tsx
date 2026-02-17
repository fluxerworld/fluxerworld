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
import type {PropsWithChildren} from 'hono/jsx';

export interface FormSectionProps {
	title: string;
	description?: string;
	class?: string;
}

export function FormSection(props: PropsWithChildren<FormSectionProps>) {
	const {title, description, children, class: className} = props;

	return (
		<div class={cn('space-y-4', className)}>
			<div class="flex flex-col gap-1 border-gray-200 border-b pb-3">
				<h3 class="font-semibold text-gray-900 text-lg">{title}</h3>
				{description && <p class="text-gray-600 text-sm">{description}</p>}
			</div>
			<div class="space-y-4">{children}</div>
		</div>
	);
}
