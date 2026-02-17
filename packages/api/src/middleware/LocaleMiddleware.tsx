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

import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {Locales} from '@fluxer/constants/src/Locales';
import {parseAcceptLanguage} from '@fluxer/locale/src/LocaleService';
import {createMiddleware} from 'hono/factory';

export const LocaleMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const acceptLanguage = ctx.req.header('accept-language');
	const headerLocale = parseAcceptLanguage(acceptLanguage);
	const user = ctx.get('user');
	const locale = user?.locale ?? headerLocale ?? Locales.EN_US;
	ctx.set('requestLocale', locale);
	return next();
});
