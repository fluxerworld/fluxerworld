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

interface SwishIconProps {
	size?: number;
	class?: string;
}

export function SwishIcon(props: SwishIconProps) {
	const size = props.size ?? 40;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			xmlnsXlink="http://www.w3.org/1999/xlink"
			viewBox="0 0 420 420"
			fill-rule="evenodd"
			width={size}
			height={size}
			style={{width: `${size}px`, height: `${size}px`, flexShrink: 0}}
			class={props.class}
		>
			<defs>
				<linearGradient
					id="swish-grad-1"
					x1="-746"
					y1="822.6"
					x2="-746.2"
					y2="823.1"
					gradientTransform="translate(224261.6 305063) scale(300.3 -370.5)"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stop-color="#ef2131" />
					<stop offset="1" stop-color="#fecf2c" />
				</linearGradient>
				<linearGradient
					id="swish-grad-2"
					x1="-745.4"
					y1="823"
					x2="-745.9"
					y2="822.1"
					gradientTransform="translate(204470.4 247194.2) scale(273.8 -300.2)"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stop-color="#fbc52c" />
					<stop offset=".3" stop-color="#f87130" />
					<stop offset=".6" stop-color="#ef52e2" />
					<stop offset="1" stop-color="#661eec" />
				</linearGradient>
				<linearGradient
					id="swish-grad-3"
					x1="-746"
					y1="823"
					x2="-745.8"
					y2="822.5"
					gradientTransform="translate(224142 305014) scale(300.3 -370.5)"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stop-color="#78f6d8" />
					<stop offset=".3" stop-color="#77d1f6" />
					<stop offset=".6" stop-color="#70a4f3" />
					<stop offset="1" stop-color="#661eec" />
				</linearGradient>
				<linearGradient
					id="swish-grad-4"
					x1="-746.1"
					y1="822.3"
					x2="-745.6"
					y2="823.2"
					gradientTransform="translate(204377.3 247074.5) scale(273.8 -300.2)"
					gradientUnits="userSpaceOnUse"
				>
					<stop offset="0" stop-color="#536eed" />
					<stop offset=".2" stop-color="#54c3ec" />
					<stop offset=".6" stop-color="#64d769" />
					<stop offset="1" stop-color="#fecf2c" />
				</linearGradient>
			</defs>
			<g>
				<path
					fill="url(#swish-grad-1)"
					d="M119.3,399.2c84.3,40.3,188.3,20.4,251.2-54.5,74.5-88.8,62.9-221.1-25.8-295.5l-59,70.3c69.3,58.2,78.4,161.5,20.2,230.9-46.4,55.3-122.8,73.7-186.5,48.9"
				/>
				<path
					fill="url(#swish-grad-2)"
					d="M119.3,399.2c84.3,40.3,188.3,20.4,251.2-54.5,7.7-9.2,14.5-18.8,20.3-28.8,9.9-61.7-11.9-126.9-63.2-169.9-13-10.9-27.2-19.8-41.9-26.5,69.3,58.2,78.4,161.5,20.2,230.9-46.4,55.3-122.8,73.7-186.5,48.9"
				/>
				<path
					fill="url(#swish-grad-3)"
					d="M300.3,20.4C216-19.9,111.9,0,49.1,74.9c-74.5,88.8-62.9,221.1,25.8,295.5l59-70.3c-69.3-58.2-78.4-161.5-20.2-230.9C160.2,14,236.6-4.5,300.3,20.4"
				/>
				<path
					fill="url(#swish-grad-4)"
					d="M300.3,20.4C216-19.9,111.9,0,49.1,74.9c-7.7,9.2-14.5,18.8-20.3,28.8-9.9,61.7,11.9,126.9,63.2,169.9,13,10.9,27.2,19.8,41.9,26.5-69.3-58.2-78.4-161.5-20.2-230.9C160.2,14,236.6-4.5,300.3,20.4"
				/>
			</g>
		</svg>
	);
}
