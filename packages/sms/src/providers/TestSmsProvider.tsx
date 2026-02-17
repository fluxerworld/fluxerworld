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

import {SMS_TEST_VERIFICATION_CODE} from '@fluxer/constants/src/SmsVerificationConstants';
import {createLogger} from '@fluxer/logger/src/Logger';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {ISmsProvider} from '@fluxer/sms/src/providers/ISmsProvider';
import {maskPhoneNumber} from '@fluxer/sms/src/SmsVerificationUtils';

interface TestSmsProviderOptions {
	logger?: LoggerInterface;
	verificationCode?: string;
}

export class TestSmsProvider implements ISmsProvider {
	private readonly logger: LoggerInterface;
	private readonly verificationCode: string;

	constructor({logger, verificationCode}: TestSmsProviderOptions = {}) {
		this.logger = logger ?? createLogger('@fluxer/sms/src', {environment: 'test'});
		this.verificationCode = verificationCode ?? SMS_TEST_VERIFICATION_CODE;
	}

	async startVerification(phone: string): Promise<void> {
		this.logger.info(
			`[TestSmsProvider] Mock verification started for ${maskPhoneNumber(phone)}. Use code: ${this.verificationCode}`,
		);
	}

	async checkVerification(phone: string, code: string): Promise<boolean> {
		const isValid = code === this.verificationCode;
		this.logger.info(
			`[TestSmsProvider] Mock verification check for ${maskPhoneNumber(phone)} with code ${code}: ${isValid ? 'APPROVED' : 'REJECTED'}`,
		);
		return isValid;
	}
}
