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

export function PaperclipIcon({color}: {color: string}) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={`inline-block h-3 w-3 ${color}`}>
			<rect width="256" height="256" fill="none" />
			<path
				d="M108.71,197.23l-5.11,5.11a46.63,46.63,0,0,1-66-.05h0a46.63,46.63,0,0,1,.06-65.89L72.4,101.66a46.62,46.62,0,0,1,65.94,0h0A46.34,46.34,0,0,1,150.78,124"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
			<path
				d="M147.29,58.77l5.11-5.11a46.62,46.62,0,0,1,65.94,0h0a46.62,46.62,0,0,1,0,65.94L193.94,144,183.6,154.34a46.63,46.63,0,0,1-66-.05h0A46.46,46.46,0,0,1,105.22,132"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
		</svg>
	);
}

export function CheckmarkIcon({color}: {color: string}) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={`inline-block h-4 w-4 ${color}`}>
			<rect width="256" height="256" fill="none" />
			<polyline
				points="40 144 96 200 224 72"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
		</svg>
	);
}

export function XIcon({color}: {color: string}) {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" class={`inline-block h-4 w-4 ${color}`}>
			<rect width="256" height="256" fill="none" />
			<line
				x1="200"
				y1="56"
				x2="56"
				y2="200"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
			<line
				x1="200"
				y1="200"
				x2="56"
				y2="56"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="24"
			/>
		</svg>
	);
}
