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

export interface HeadingEntry {
	id: string;
	title: string;
	level: number;
}

export interface ContentTocProps {
	title: string;
	headings: ReadonlyArray<HeadingEntry>;
}

export function ContentToc(props: ContentTocProps): JSX.Element | null {
	if (props.headings.length === 0) return null;

	return (
		<nav class="space-y-3 text-sm">
			<p class="font-semibold text-foreground">{props.title}</p>
			<ul class="space-y-2 border-border border-l pl-4">
				{props.headings.map((heading) => (
					<li>
						<a href={`#${heading.id}`} data-toc-link={heading.id} class={tocClassName(heading.level)}>
							{heading.title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

function tocClassName(level: number): string {
	if (level <= 2) {
		return 'block text-muted-foreground hover:text-foreground transition';
	}
	if (level === 3) {
		return 'block text-muted-foreground hover:text-foreground transition ml-3';
	}
	return 'block text-muted-foreground hover:text-foreground transition ml-5';
}
