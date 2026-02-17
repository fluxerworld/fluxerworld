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

interface TranslateIconProps {
	class?: string;
}

export function TranslateIcon(props: TranslateIconProps): JSX.Element {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 256 256"
			fill="none"
			stroke="currentColor"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="24"
			class={props.class}
		>
			<polyline points="240,216 184,104 128,216" />
			<line x1="144" y1="184" x2="224" y2="184" />
			<line x1="96" y1="32" x2="96" y2="56" />
			<line x1="32" y1="56" x2="160" y2="56" />
			<path d="M128,56a96,96,0,0,1-96,96" />
			<path d="M72.7,96A96,96,0,0,0,160,152" />
		</svg>
	);
}
