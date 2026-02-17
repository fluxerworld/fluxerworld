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

import {getSudoModeService} from '@fluxer/api/src/auth/services/SudoModeService';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {getSudoCookie} from '@fluxer/api/src/utils/SudoCookieUtils';
import {createMiddleware} from 'hono/factory';

export const SUDO_MODE_HEADER = 'X-Fluxer-Sudo-Mode-JWT';
export const SudoModeMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');

	ctx.set('sudoModeValid', false);
	ctx.set('sudoModeToken', null);

	if (!user) {
		await next();
		return;
	}

	if (user.isBot) {
		ctx.set('sudoModeValid', true);
		await next();
		return;
	}

	const sudoToken = ctx.req.header(SUDO_MODE_HEADER);

	let tokenToVerify: string | undefined = sudoToken;

	if (!tokenToVerify) {
		tokenToVerify = getSudoCookie(ctx, user.id.toString());
	}

	if (!tokenToVerify) {
		await next();
		return;
	}

	const sudoModeService = getSudoModeService();
	const isValid = await sudoModeService.verifySudoToken(tokenToVerify, user.id);

	if (isValid) {
		ctx.set('sudoModeValid', true);
		ctx.set('sudoModeToken', tokenToVerify);
	}

	await next();
});
