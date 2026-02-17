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

import type {CaptchaProviderType, ICaptchaProvider, VerifyCaptchaParams} from '@fluxer/captcha/src/ICaptchaProvider';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {ms} from 'itty-time';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; Fluxerbot/1.0; +https://fluxer.app)';
const DEFAULT_TIMEOUT = ms('10 seconds');

export interface HttpCaptchaProviderOptions {
	secretKey: string;
	logger?: LoggerInterface;
	timeoutMs?: number;
	userAgent?: string;
	fetchFn?: typeof fetch;
}

interface CaptchaVerifyResponse {
	success: boolean;
	'error-codes'?: Array<string>;
	hostname?: string;
	challenge_ts?: string;
}

export abstract class HttpCaptchaProvider implements ICaptchaProvider {
	abstract readonly type: CaptchaProviderType;

	protected readonly secretKey: string;
	protected readonly logger: LoggerInterface | undefined;
	protected readonly timeoutMs: number;
	protected readonly userAgent: string;
	protected readonly fetchFn: typeof fetch;

	protected abstract readonly verifyUrl: string;
	protected abstract readonly providerName: string;

	constructor(options: HttpCaptchaProviderOptions) {
		this.secretKey = options.secretKey;
		this.logger = options.logger;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
		this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
		this.fetchFn = options.fetchFn ?? fetch;
	}

	async verify({token, remoteIp}: VerifyCaptchaParams): Promise<boolean> {
		try {
			const body = new URLSearchParams();
			body.append('secret', this.secretKey);
			body.append('response', token);
			if (remoteIp) {
				body.append('remoteip', remoteIp);
			}

			const response = await this.fetchFn(this.verifyUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': this.userAgent,
				},
				body: body.toString(),
				signal: AbortSignal.timeout(this.timeoutMs),
			});

			if (!response.ok) {
				this.logger?.error({status: response.status}, `${this.providerName} verify request failed`);
				return false;
			}

			const data = (await response.json()) as CaptchaVerifyResponse;

			if (!data.success) {
				this.logger?.warn({errorCodes: data['error-codes']}, `${this.providerName} verification failed`);
				return false;
			}

			return this.validateResponse(data);
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				this.logger?.error({}, `${this.providerName} verification timed out after ${this.timeoutMs}ms`);
			} else {
				this.logger?.error({error}, `Error verifying ${this.providerName} token`);
			}
			return false;
		}
	}

	protected validateResponse(_data: CaptchaVerifyResponse): boolean {
		return true;
	}
}
