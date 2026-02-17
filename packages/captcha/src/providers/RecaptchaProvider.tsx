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

import type {CaptchaProviderType} from '@fluxer/captcha/src/ICaptchaProvider';
import type {HttpCaptchaProviderOptions} from '@fluxer/captcha/src/providers/HttpCaptchaProvider';
import {HttpCaptchaProvider} from '@fluxer/captcha/src/providers/HttpCaptchaProvider';

const DEFAULT_MINIMUM_SCORE = 0.5;

interface RecaptchaVerifyResponse {
	success: boolean;
	'error-codes'?: Array<string>;
	score?: number;
}

export interface RecaptchaProviderOptions extends HttpCaptchaProviderOptions {
	minimumScore?: number;
}

export class RecaptchaProvider extends HttpCaptchaProvider {
	readonly type: CaptchaProviderType = 'recaptcha';
	protected readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
	protected readonly providerName = 'reCAPTCHA';

	private readonly minimumScore: number;

	constructor(options: RecaptchaProviderOptions) {
		super(options);
		this.minimumScore = options.minimumScore ?? DEFAULT_MINIMUM_SCORE;
	}

	protected override validateResponse(data: RecaptchaVerifyResponse): boolean {
		if (data.score !== undefined && data.score < this.minimumScore) {
			this.logger?.warn(
				{score: data.score, minimumScore: this.minimumScore},
				'reCAPTCHA score below minimum threshold',
			);
			return false;
		}
		return true;
	}
}
