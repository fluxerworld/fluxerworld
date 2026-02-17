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

interface PictureProps {
	src: string;
	alt: string;
	class: string;
	sizes: string;
	width1x: number;
	width2x: number;
	priority?: boolean;
}

export function Picture(props: PictureProps): JSX.Element {
	return renderWithPriority(props, false);
}

export function PicturePriority(props: PictureProps): JSX.Element {
	return renderWithPriority(props, true);
}

function renderWithPriority(props: PictureProps, highPriority: boolean): JSX.Element {
	const basePath = getBasePath(props.src);
	const width1x = props.width1x.toString();
	const width2x = props.width2x.toString();

	const srcsetAvif = `${basePath}-1x.avif ${width1x}w, ${basePath}-2x.avif ${width2x}w`;
	const srcsetWebp = `${basePath}-1x.webp ${width1x}w, ${basePath}-2x.webp ${width2x}w`;
	const srcsetPng = `${basePath}-1x.png ${width1x}w, ${basePath}-2x.png ${width2x}w`;

	return (
		<picture>
			<source srcset={srcsetAvif} sizes={props.sizes} type="image/avif" />
			<source srcset={srcsetWebp} sizes={props.sizes} type="image/webp" />
			<img
				srcset={srcsetPng}
				sizes={props.sizes}
				fetchpriority={highPriority ? 'high' : undefined}
				src={`${basePath}-1x.png`}
				alt={props.alt}
				class={props.class}
			/>
		</picture>
	);
}

function getBasePath(src: string): string {
	const parts = src.split('.');
	if (parts.length <= 1) return src;
	return parts.slice(0, -1).join('.');
}
