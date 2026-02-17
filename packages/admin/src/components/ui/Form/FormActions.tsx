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
import {Button} from '@fluxer/ui/src/components/Button';

export interface FormActionsProps {
	submitText?: string;
	cancelText?: string;
	loading?: boolean;
	cancelHref?: string;
	class?: string;
}

export function FormActions(props: FormActionsProps) {
	const {submitText = 'Submit', cancelText = 'Cancel', loading = false, cancelHref, class: className} = props;

	return (
		<div class={cn('flex items-center justify-end gap-3 border-gray-200 border-t pt-4', className)}>
			{cancelHref && (
				<Button variant="secondary" href={cancelHref} disabled={loading}>
					{cancelText}
				</Button>
			)}
			<Button type="submit" variant="primary" loading={loading}>
				{submitText}
			</Button>
		</div>
	);
}
