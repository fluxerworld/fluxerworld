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

import {AdminACLs} from '@fluxer/constants/src/AdminACLs';

export function hasPermission(adminAcls: Array<string>, requiredAcl: string): boolean {
	return adminAcls.includes(requiredAcl) || adminAcls.includes(AdminACLs.WILDCARD);
}

export function hasAnyPermission(adminAcls: Array<string>, requiredAcls: Array<string>): boolean {
	if (requiredAcls.length === 0) return true;
	return requiredAcls.some((acl) => hasPermission(adminAcls, acl));
}
