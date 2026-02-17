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

import {CardEmpty} from '@fluxer/ui/src/components/Card';
import {TextMuted, TextSmallMuted} from '@fluxer/ui/src/components/Typography';
import type {Child, FC} from 'hono/jsx';

export interface EmptyStateProps {
	title?: string;
	message?: string;
	icon?: Child;
	action?: Child;
}

export const EmptyState: FC<EmptyStateProps> = ({title, message, icon, action}) => {
	return (
		<CardEmpty>
			<div class="flex flex-col items-center gap-4">
				{icon && <div class="text-neutral-400">{icon}</div>}
				{title && <TextMuted text={title} />}
				{message && <TextSmallMuted text={message} />}
				{action && <div>{action}</div>}
			</div>
		</CardEmpty>
	);
};
