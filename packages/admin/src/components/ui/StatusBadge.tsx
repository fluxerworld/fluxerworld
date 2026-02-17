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

import type {BadgeProps} from '@fluxer/admin/src/components/ui/Badge';
import {Badge} from '@fluxer/admin/src/components/ui/Badge';

export interface StatusBadgeProps {
	status: 'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'banned';
	size?: BadgeProps['size'];
}

const statusVariantMap: Record<StatusBadgeProps['status'], BadgeProps['variant']> = {
	active: 'success',
	inactive: 'neutral',
	pending: 'warning',
	approved: 'success',
	rejected: 'danger',
	banned: 'danger',
};

const statusLabelMap: Record<StatusBadgeProps['status'], string> = {
	active: 'Active',
	inactive: 'Inactive',
	pending: 'Pending',
	approved: 'Approved',
	rejected: 'Rejected',
	banned: 'Banned',
};

export function StatusBadge({status, size}: StatusBadgeProps) {
	const variant = statusVariantMap[status];
	const label = statusLabelMap[status];

	return (
		<Badge variant={variant} size={size}>
			{label}
		</Badge>
	);
}
