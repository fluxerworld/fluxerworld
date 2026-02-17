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

import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import type React from 'react';

interface PurchaseDisabledWrapperProps {
	disabled: boolean;
	tooltipText: React.ReactNode;
	children: React.ReactElement;
}

export const PurchaseDisabledWrapper: React.FC<PurchaseDisabledWrapperProps> = ({disabled, tooltipText, children}) => {
	if (!disabled) return children;

	const tooltipContent = typeof tooltipText === 'function' ? (tooltipText as () => React.ReactNode) : () => tooltipText;

	return (
		<Tooltip text={tooltipContent}>
			<div>{children}</div>
		</Tooltip>
	);
};
