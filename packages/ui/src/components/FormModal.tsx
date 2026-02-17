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

import type {PropsWithChildren, ReactNode} from 'hono/jsx';

export interface FormModalProps {
	id: string;
	title: string;
	action: string;
	method?: 'post' | 'get';
	children: ReactNode;
	submitText?: string;
	cancelText?: string;
	size?: 'small' | 'medium' | 'large';
	footer?: ReactNode;
}

const sizeClasses = {
	small: 'max-w-md',
	medium: 'max-w-lg',
	large: 'max-w-2xl',
};

export function FormModal({
	id,
	title,
	action,
	method = 'post',
	children,
	submitText = 'Submit',
	cancelText = 'Cancel',
	size = 'medium',
	footer,
}: PropsWithChildren<FormModalProps>) {
	const modalClass = sizeClasses[size];
	const closeScript = `document.getElementById('${id}').classList.add('hidden')`;

	return (
		<div id={id} class="fixed inset-0 z-50 hidden overflow-y-auto">
			<div class="flex min-h-screen items-center justify-center p-4">
				<div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onclick={closeScript} aria-hidden="true" />

				<div class={`relative rounded-lg bg-white shadow-xl ${modalClass} w-full`}>
					<div class="flex items-center justify-between border-neutral-200 border-b p-4">
						<h2 class="font-semibold text-lg text-neutral-900">{title}</h2>
						<button
							type="button"
							class="p-1 text-neutral-400 transition-colors hover:text-neutral-600"
							onclick={closeScript}
							aria-label="Close"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<form action={action} method={method}>
						<div class="p-4">{children}</div>

						<div class="flex items-center justify-end gap-3 rounded-b-lg border-neutral-200 border-t bg-neutral-50 p-4">
							{footer || (
								<>
									<button
										type="button"
										class="rounded border border-neutral-300 bg-white px-4 py-2 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
										onclick={closeScript}
									>
										{cancelText}
									</button>
									<button
										type="submit"
										class="rounded bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-800"
									>
										{submitText}
									</button>
								</>
							)}
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
