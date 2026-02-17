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

import type {ICaptchaProvider} from '@fluxer/captcha/src/ICaptchaProvider';
import {HcaptchaProvider} from '@fluxer/captcha/src/providers/HcaptchaProvider';
import type {HttpCaptchaProviderOptions} from '@fluxer/captcha/src/providers/HttpCaptchaProvider';
import type {RecaptchaProviderOptions} from '@fluxer/captcha/src/providers/RecaptchaProvider';
import {RecaptchaProvider} from '@fluxer/captcha/src/providers/RecaptchaProvider';
import {TestCaptchaProvider} from '@fluxer/captcha/src/providers/TestProvider';
import {TurnstileProvider} from '@fluxer/captcha/src/providers/TurnstileProvider';
import {UnavailableCaptchaProvider} from '@fluxer/captcha/src/providers/UnavailableCaptchaProvider';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';

interface BaseCaptchaProviderFactoryParams {
	logger?: LoggerInterface;
}

interface CreateUnavailableCaptchaProviderParams extends BaseCaptchaProviderFactoryParams {
	mode: 'unavailable';
}

interface CreateTestCaptchaProviderParams extends BaseCaptchaProviderFactoryParams {
	mode: 'test';
}

interface CreateHcaptchaProviderParams extends BaseCaptchaProviderFactoryParams {
	mode: 'hcaptcha';
	secretKey: string;
	timeoutMs?: number;
	userAgent?: string;
	fetchFn?: typeof fetch;
}

interface CreateTurnstileProviderParams extends BaseCaptchaProviderFactoryParams {
	mode: 'turnstile';
	secretKey: string;
	timeoutMs?: number;
	userAgent?: string;
	fetchFn?: typeof fetch;
}

interface CreateRecaptchaProviderParams extends BaseCaptchaProviderFactoryParams {
	mode: 'recaptcha';
	secretKey: string;
	minimumScore?: number;
	timeoutMs?: number;
	userAgent?: string;
	fetchFn?: typeof fetch;
}

export type CreateCaptchaProviderParams =
	| CreateUnavailableCaptchaProviderParams
	| CreateTestCaptchaProviderParams
	| CreateHcaptchaProviderParams
	| CreateTurnstileProviderParams
	| CreateRecaptchaProviderParams;

function buildHttpOptions(
	params: CreateHcaptchaProviderParams | CreateTurnstileProviderParams | CreateRecaptchaProviderParams,
): HttpCaptchaProviderOptions {
	return {
		secretKey: params.secretKey,
		logger: params.logger,
		timeoutMs: params.timeoutMs,
		userAgent: params.userAgent,
		fetchFn: params.fetchFn,
	};
}

export function createCaptchaProvider(params: CreateCaptchaProviderParams): ICaptchaProvider {
	if (params.mode === 'test') {
		return new TestCaptchaProvider();
	}

	if (params.mode === 'hcaptcha') {
		return new HcaptchaProvider(buildHttpOptions(params));
	}

	if (params.mode === 'turnstile') {
		return new TurnstileProvider(buildHttpOptions(params));
	}

	if (params.mode === 'recaptcha') {
		const options: RecaptchaProviderOptions = {
			...buildHttpOptions(params),
			minimumScore: params.minimumScore,
		};
		return new RecaptchaProvider(options);
	}

	return new UnavailableCaptchaProvider();
}
