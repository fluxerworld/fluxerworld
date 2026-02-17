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

import {SMS_TWILIO_DEFAULT_VERIFY_API_URL} from '@fluxer/constants/src/SmsVerificationConstants';
import {InvalidPhoneNumberError} from '@fluxer/errors/src/domains/auth/InvalidPhoneNumberError';
import {createLogger} from '@fluxer/logger/src/Logger';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {ISmsProvider} from '@fluxer/sms/src/providers/ISmsProvider';
import {maskPhoneNumber} from '@fluxer/sms/src/SmsVerificationUtils';

const TWILIO_INVALID_PHONE_ERROR_CODE = 21211;

interface TwilioErrorResponse {
	code?: number;
	message?: string;
}

interface TwilioVerificationCheckResponse {
	status?: string;
}

export interface TwilioSmsProviderConfig {
	accountSid: string;
	authToken: string;
	verifyServiceSid: string;
	verifyApiUrl?: string;
}

interface TwilioSmsProviderDependencies {
	config: TwilioSmsProviderConfig;
	logger?: LoggerInterface;
	fetchFn?: typeof fetch;
}

export class TwilioSmsProvider implements ISmsProvider {
	private readonly verifyApiUrl: string;
	private readonly logger: LoggerInterface;
	private readonly config: TwilioSmsProviderConfig;
	private readonly fetchFn: typeof fetch;

	constructor({config, logger, fetchFn = fetch}: TwilioSmsProviderDependencies) {
		this.verifyApiUrl = config.verifyApiUrl ?? SMS_TWILIO_DEFAULT_VERIFY_API_URL;
		this.logger = logger ?? createLogger('@fluxer/sms/src');
		this.config = config;
		this.fetchFn = fetchFn;
	}

	async startVerification(phone: string): Promise<void> {
		const response = await this.requestTwilio('Verifications', {
			To: phone,
			Channel: 'sms',
		});

		if (response.ok) {
			return;
		}

		const body = await this.parseErrorBody(response);
		if (body?.code === TWILIO_INVALID_PHONE_ERROR_CODE) {
			throw new InvalidPhoneNumberError();
		}

		this.logger.error(
			{
				status: response.status,
				code: body?.code,
				message: body?.message,
				phone: maskPhoneNumber(phone),
			},
			'[TwilioSmsProvider] Failed to start SMS verification',
		);
		throw new Error('Failed to start SMS verification');
	}

	async checkVerification(phone: string, code: string): Promise<boolean> {
		const response = await this.requestTwilio('VerificationCheck', {
			To: phone,
			Code: code,
		});

		if (!response.ok) {
			return false;
		}

		const body = (await response.json()) as TwilioVerificationCheckResponse;
		return body.status === 'approved';
	}

	private async requestTwilio(
		endpoint: 'Verifications' | 'VerificationCheck',
		body: Record<string, string>,
	): Promise<Response> {
		const url = `${this.verifyApiUrl}/Services/${this.config.verifyServiceSid}/${endpoint}`;
		const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
		return this.fetchFn(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams(body).toString(),
		});
	}

	private async parseErrorBody(response: Response): Promise<TwilioErrorResponse | null> {
		try {
			return (await response.json()) as TwilioErrorResponse;
		} catch {
			return null;
		}
	}
}
