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

export interface HeroConfig {
	icon: JSX.Element;
	title: string;
	description: string;
	extraContent: JSX.Element;
	customPadding: string;
}

export function defaultHeroPadding(): string {
	return 'px-6 sm:px-8 md:px-12 lg:px-16 xl:px-20 pt-48 md:pt-60 pb-16 md:pb-20 lg:pb-24 text-white';
}

export function HeroBase(config: HeroConfig): JSX.Element {
	return (
		<section class={config.customPadding}>
			<div class="mx-auto max-w-5xl text-center">
				<div class="mb-8 flex justify-center">
					<div class="inline-flex h-28 w-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm md:h-36 md:w-36">
						{config.icon}
					</div>
				</div>
				<h1 class="hero mb-8 font-bold text-5xl md:mb-10 md:text-6xl lg:text-7xl">{config.title}</h1>
				<p class="lead mx-auto max-w-4xl text-white/90 text-xl md:text-2xl">{config.description}</p>
				{config.extraContent}
			</div>
		</section>
	);
}
