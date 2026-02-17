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

import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Child, FC} from 'hono/jsx';

interface ResourceLinkProps {
	config: Config;
	resourceType: 'user' | 'guild';
	resourceId: string;
	children: Child;
	size?: 'sm' | 'md';
	class?: string;
}

export const ResourceLink: FC<ResourceLinkProps> = ({
	config,
	resourceType,
	resourceId,
	children,
	size = 'sm',
	class: className = '',
}) => {
	const sizeClass = size === 'sm' ? 'text-sm' : '';
	const baseClass = `text-neutral-900 underline decoration-neutral-300 hover:text-neutral-600 hover:decoration-neutral-500 ${sizeClass} ${className}`;
	const href = `${config.basePath}/${resourceType === 'user' ? 'users' : 'guilds'}/${resourceId}`;

	return (
		<a href={href} class={baseClass}>
			{children}
		</a>
	);
};
