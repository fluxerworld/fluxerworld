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

import type {Child, FC} from 'hono/jsx';

interface NavLinkProps {
	href: string;
	children: Child;
	class?: string;
}

export const NavLink: FC<NavLinkProps> = ({href, children, class: className = ''}) => {
	const baseClass = `label rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-700 transition-colors hover:bg-neutral-50 ${className}`;

	return (
		<a href={href} class={baseClass}>
			{children}
		</a>
	);
};
