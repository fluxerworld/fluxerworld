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

import type {PropsWithChildren, ReactNode} from 'hono/jsx';

export type FormSectionPadding = 'none' | 'small' | 'medium' | 'large';

export interface FormSectionProps {
	title?: string;
	bordered?: boolean;
	padding?: FormSectionPadding;
	children: ReactNode;
	class?: string;
}

const paddingClasses: Record<FormSectionPadding, string> = {
	none: '',
	small: 'p-3',
	medium: 'p-4',
	large: 'p-6',
};

export function FormSection({
	title,
	bordered = false,
	padding = 'medium',
	children,
	class: className,
}: PropsWithChildren<FormSectionProps>) {
	const containerClass = bordered
		? `border border-neutral-200 rounded-lg bg-white ${paddingClasses[padding]}`
		: paddingClasses[padding];

	const content = <div class={`space-y-4 ${containerClass} ${className ?? ''}`}>{children}</div>;

	if (title) {
		return (
			<div class={className ?? ''}>
				<h3 class="mb-3 font-semibold text-lg text-neutral-900">{title}</h3>
				{bordered ? content : <div class={containerClass}>{children}</div>}
			</div>
		);
	}

	return content;
}
