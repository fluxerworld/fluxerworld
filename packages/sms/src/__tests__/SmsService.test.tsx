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
import {SmsVerificationUnavailableError} from '@fluxer/errors/src/domains/auth/SmsVerificationUnavailableError';
import type {ISmsProvider} from '@fluxer/sms/src/providers/ISmsProvider';
import {UnavailableSmsProvider} from '@fluxer/sms/src/providers/UnavailableSmsProvider';
import {SmsService} from '@fluxer/sms/src/SmsService';
import {describe, expect, it} from 'vitest';

function createInMemoryProvider(): ISmsProvider & {
	verifications: Map<string, string>;
	startedVerifications: Array<string>;
} {
	const verifications = new Map<string, string>();
	const startedVerifications: Array<string> = [];

	return {
		verifications,
		startedVerifications,
		async startVerification(phone: string): Promise<void> {
			startedVerifications.push(phone);
			verifications.set(phone, '123456');
		},
		async checkVerification(phone: string, code: string): Promise<boolean> {
			const storedCode = verifications.get(phone);
			if (storedCode === code) {
				verifications.delete(phone);
				return true;
			}
			return false;
		},
	};
}

describe('SmsService', () => {
	describe('with provider', () => {
		it('starts verification through provider', async () => {
			const provider = createInMemoryProvider();
			const service = new SmsService(provider);

			await service.startVerification('+15551234567');

			expect(provider.startedVerifications).toContain('+15551234567');
			expect(provider.verifications.has('+15551234567')).toBe(true);
		});

		it('checks verification through provider and returns true for valid code', async () => {
			const provider = createInMemoryProvider();
			const service = new SmsService(provider);

			await service.startVerification('+15551234567');
			const code = provider.verifications.get('+15551234567') ?? '';

			const result = await service.checkVerification('+15551234567', code);

			expect(result).toBe(true);
		});

		it('checks verification through provider and returns false for invalid code', async () => {
			const provider = createInMemoryProvider();
			const service = new SmsService(provider);

			await service.startVerification('+15551234567');

			const result = await service.checkVerification('+15551234567', 'wrong-code');

			expect(result).toBe(false);
		});

		it('returns false for verification check on non-existent phone', async () => {
			const provider = createInMemoryProvider();
			const service = new SmsService(provider);

			const result = await service.checkVerification('+15559999999', '123456');

			expect(result).toBe(false);
		});
	});

	describe('with unavailable provider', () => {
		it('silently completes startVerification when provider is unavailable', async () => {
			const service = new SmsService(new UnavailableSmsProvider());

			await expect(service.startVerification('+15551234567')).resolves.toBeUndefined();
		});

		it('throws SmsVerificationUnavailableError when checking verification', async () => {
			const service = new SmsService(new UnavailableSmsProvider());

			await expect(service.checkVerification('+15551234567', '123456')).rejects.toThrow(
				SmsVerificationUnavailableError,
			);
		});

		it('defaults to unavailable provider when no provider is injected', async () => {
			const service = new SmsService();

			await expect(service.checkVerification('+15551234567', '123456')).rejects.toThrow(
				SmsVerificationUnavailableError,
			);
		});

		it('exposes the correct api error code when checking verification', async () => {
			const service = new SmsService(new UnavailableSmsProvider());

			await expect(service.checkVerification('+15551234567', '123456')).rejects.toMatchObject({
				code: APIErrorCodes.SMS_VERIFICATION_UNAVAILABLE,
				message: APIErrorCodes.SMS_VERIFICATION_UNAVAILABLE,
			});
		});
	});
});
