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

import {Card} from '@fluxer/ui/src/components/Card';
import type {FC} from 'hono/jsx';

interface BackButtonProps {
	href: string;
	label: string;
}

export function BackButton({href, label}: BackButtonProps) {
	return (
		<a
			href={href}
			class="inline-flex items-center gap-2 text-neutral-900 text-sm underline decoration-neutral-300 hover:text-neutral-600 hover:decoration-neutral-500"
		>
			&larr; {label}
		</a>
	);
}

export const NotFoundView: FC<{resourceName: string; backUrl: string; backLabel: string}> = ({
	resourceName,
	backUrl,
	backLabel,
}) => (
	<div class="mx-auto max-w-2xl">
		<Card padding="lg">
			<div class="space-y-4 text-center">
				<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
					<span class="font-semibold text-2xl text-neutral-400">?</span>
				</div>
				<h2 class="font-semibold text-lg text-neutral-900">{resourceName} Not Found</h2>
				<p class="text-neutral-600">
					The {resourceName} you're looking for doesn't exist or you don't have permission to view it.
				</p>
				<div class="pt-4">
					<BackButton href={backUrl} label={backLabel} />
				</div>
			</div>
		</Card>
	</div>
);
