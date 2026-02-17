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

import {Card, type CardPadding, type CardVariant} from '@fluxer/admin/src/components/ui/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {PropsWithChildren} from 'hono/jsx';

export interface FormCardProps {
	action: string;
	method?: 'get' | 'post';
	csrfToken: string;
	padding?: CardPadding;
	variant?: CardVariant;
	className?: string;
}

export function FormCard(props: PropsWithChildren<FormCardProps>) {
	const {action, method = 'post', csrfToken, padding = 'md', variant = 'default', className, children} = props;

	return (
		<Card padding={padding} variant={variant} className={className}>
			<form method={method} action={action}>
				<CsrfInput token={csrfToken} />
				{children}
			</form>
		</Card>
	);
}
