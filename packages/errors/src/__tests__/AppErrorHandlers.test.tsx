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

import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {Locales} from '@fluxer/constants/src/Locales';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';
import {AppErrorHandler} from '@fluxer/errors/src/domains/core/ErrorHandlers';
import type {BaseHonoEnv} from '@fluxer/hono_types/src/HonoTypes';
import {Hono} from 'hono';
import {describe, expect, it} from 'vitest';

interface ErrorResponse {
	code: string;
	message: string;
}

function createApp(): Hono<BaseHonoEnv> {
	const app = new Hono<BaseHonoEnv>();
	app.onError(AppErrorHandler);
	return app;
}

describe('AppErrorHandler i18n fallbacks', () => {
	it('localizes unexpected errors from Accept-Language when middleware locale is missing', async () => {
		const app = createApp();

		app.get('/test', () => {
			throw new Error('boom');
		});

		const response = await app.request('/test', {
			headers: {
				'accept-language': 'fr-CA,fr;q=0.9,en;q=0.8',
			},
		});

		expect(response.status).toBe(500);
		const body = (await response.json()) as ErrorResponse;
		expect(body.code).toBe(APIErrorCodes.INTERNAL_SERVER_ERROR);
		expect(body.message).toBe('Erreur interne du serveur.');
	});

	it('localizes FluxerError responses without errorI18nService in context', async () => {
		const app = createApp();

		app.get('/test', () => {
			throw new BadRequestError({code: APIErrorCodes.BAD_REQUEST});
		});

		const response = await app.request('/test', {
			headers: {
				'accept-language': 'fr',
			},
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as ErrorResponse;
		expect(body.code).toBe(APIErrorCodes.BAD_REQUEST);
		expect(body.message).toBe('Requête invalide.');
	});

	it('prefers requestLocale context over Accept-Language header', async () => {
		const app = createApp();

		app.use('*', async (ctx, next) => {
			ctx.set('requestLocale', Locales.EN_US);
			await next();
		});

		app.get('/test', () => {
			throw new Error('boom');
		});

		const response = await app.request('/test', {
			headers: {
				'accept-language': 'fr',
			},
		});

		expect(response.status).toBe(500);
		const body = (await response.json()) as ErrorResponse;
		expect(body.code).toBe(APIErrorCodes.INTERNAL_SERVER_ERROR);
		expect(body.message).toBe('Internal server error.');
	});
});
