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

import {cn} from '@fluxer/admin/src/utils/ClassNames';
import type {Child} from 'hono/jsx';

interface CodeBlockProps {
	children: Child;
	copiable?: boolean;
	class?: string;
}

const COPY_CODE_SCRIPT = `
function copyCode(button) {
	var code = button.previousElementSibling.textContent;
	navigator.clipboard.writeText(code).then(function () {
		var original = button.textContent;
		button.textContent = 'Copied!';
		setTimeout(function () { button.textContent = original; }, 2000);
	});
}
`;

export function CodeBlock({children, copiable = false, class: className}: CodeBlockProps) {
	return (
		<div class={cn('relative', className)}>
			<pre class="overflow-x-auto rounded border border-neutral-200 bg-neutral-100 p-3 font-mono text-sm">
				<code>{children}</code>
			</pre>
			{copiable && (
				<>
					<button
						type="button"
						onclick="copyCode(this)"
						class="absolute top-2 right-2 rounded border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
					>
						Copy
					</button>
					<script dangerouslySetInnerHTML={{__html: COPY_CODE_SCRIPT}} />
				</>
			)}
		</div>
	);
}
