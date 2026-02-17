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

import {getAlertClasses} from '@fluxer/ui/src/utils/ColorVariants';
import type {FC, PropsWithChildren} from 'hono/jsx';

export type AlertVariant = 'error' | 'warning' | 'success' | 'info';

export interface AlertProps {
	variant: AlertVariant;
	title?: string;
}

export const Alert: FC<PropsWithChildren<AlertProps>> = ({variant, title, children}) => {
	const classes = ['rounded-lg border px-4 py-3 text-sm', getAlertClasses(variant)].filter(Boolean).join(' ');

	return (
		<div class={classes}>
			{title && <p class="mb-1 font-semibold">{title}</p>}
			{children && <div>{children}</div>}
		</div>
	);
};
