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

interface CodeIconProps {
	class?: string;
}

export function CodeIcon(props: CodeIconProps): JSX.Element {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={props.class}>
			<rect width="256" height="256" fill="none" />
			<polyline
				points="64 88 16 128 64 168"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
			<polyline
				points="192 88 240 128 192 168"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
			<line
				x1="160"
				y1="40"
				x2="96"
				y2="216"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
		</svg>
	);
}
