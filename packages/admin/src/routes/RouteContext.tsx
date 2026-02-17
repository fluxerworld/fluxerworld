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

import {getFlash} from '@fluxer/admin/src/middleware/Auth';
import {getCsrfToken} from '@fluxer/admin/src/middleware/Csrf';
import type {AppContext, Session} from '@fluxer/admin/src/types/App';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

export interface RouteContext {
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	csrfToken: string;
	adminAcls: Array<string>;
}

export function getRouteContext(c: AppContext): RouteContext {
	const currentAdmin = c.get('currentAdmin');
	return {
		session: c.get('session')!,
		currentAdmin,
		flash: getFlash(c),
		csrfToken: getCsrfToken(c),
		adminAcls: currentAdmin?.acls ?? [],
	};
}
