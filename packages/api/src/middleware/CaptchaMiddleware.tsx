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

import {Config} from '@fluxer/api/src/Config';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {createCaptchaProvider} from '@fluxer/captcha/src/CaptchaProviderFactory';
import type {ICaptchaProvider} from '@fluxer/captcha/src/ICaptchaProvider';
import {CaptchaRequiredError, InvalidCaptchaError} from '@fluxer/errors/src/CaptchaErrors';
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import {createMiddleware} from 'hono/factory';

let providers: Map<string, ICaptchaProvider> | null = null;
let defaultProvider: ICaptchaProvider | null = null;

function initializeProviders(): void {
	if (providers) return;
	providers = new Map();

	if (Config.dev.testModeEnabled) {
		const testProvider = createCaptchaProvider({mode: 'test'});
		defaultProvider = testProvider;
		return;
	}

	if (Config.captcha.hcaptcha?.secretKey) {
		const provider = createCaptchaProvider({mode: 'hcaptcha', secretKey: Config.captcha.hcaptcha.secretKey});
		providers.set('hcaptcha', provider);
	}

	if (Config.captcha.turnstile?.secretKey) {
		const provider = createCaptchaProvider({mode: 'turnstile', secretKey: Config.captcha.turnstile.secretKey});
		providers.set('turnstile', provider);
	}

	if (providers.size === 0) {
		throw new Error(
			'CAPTCHA_ENABLED=true but no captcha service has been configured. ' +
				'Please supply HCAPTCHA_SECRET_KEY or TURNSTILE_SECRET_KEY (or disable captcha).',
		);
	}

	defaultProvider = providers.get(Config.captcha.provider) ?? providers.values().next().value ?? null;
}

function resolveProvider(requestedType: string | undefined): ICaptchaProvider {
	if (defaultProvider && !providers?.size) {
		return defaultProvider;
	}

	if (requestedType && providers?.has(requestedType)) {
		return providers.get(requestedType)!;
	}

	if (defaultProvider) {
		return defaultProvider;
	}

	throw new Error('No captcha provider available');
}

export const CaptchaMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	if (!Config.captcha.enabled) {
		await next();
		return;
	}

	initializeProviders();

	const token = ctx.req.header('x-captcha-token');
	if (!token) {
		throw new CaptchaRequiredError();
	}

	const provider = resolveProvider(ctx.req.header('x-captcha-type'));

	const isValid = await provider.verify({
		token,
		remoteIp:
			extractClientIp(ctx.req.raw, {
				trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
			}) ?? undefined,
	});

	if (!isValid) {
		throw new InvalidCaptchaError();
	}

	await next();
});
