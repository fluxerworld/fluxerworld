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

interface TextProps {
	text: string;
}

export function HeadingPage({text}: TextProps) {
	return <h1 class="font-bold text-lg text-neutral-900">{text}</h1>;
}

export function HeadingSection({text}: TextProps) {
	return <h2 class="font-bold text-base text-neutral-900">{text}</h2>;
}

export function HeadingCard({text}: TextProps) {
	return <h3 class="font-semibold text-base text-neutral-900">{text}</h3>;
}

export function HeadingCardWithMargin({text}: TextProps) {
	return (
		<div class="mb-4">
			<HeadingCard text={text} />
		</div>
	);
}

export function TextMuted({text}: TextProps) {
	return <p class="text-neutral-600 text-sm">{text}</p>;
}

export function TextSmallMuted({text}: TextProps) {
	return <p class="text-neutral-500 text-xs">{text}</p>;
}
