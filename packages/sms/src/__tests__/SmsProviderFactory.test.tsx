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

import {SmsVerificationUnavailableError} from '@fluxer/errors/src/domains/auth/SmsVerificationUnavailableError';
import {createMockLogger} from '@fluxer/logger/src/mock';
import {createSmsProvider} from '@fluxer/sms/src/providers/SmsProviderFactory';
import {describe, expect, it} from 'vitest';

describe('createSmsProvider', () => {
	it('creates a test provider that accepts the configured code', async () => {
		const provider = createSmsProvider({
			mode: 'test',
			logger: createMockLogger(),
			verificationCode: '654321',
		});

		await expect(provider.startVerification('+15551234567')).resolves.toBeUndefined();
		await expect(provider.checkVerification('+15551234567', '654321')).resolves.toBe(true);
		await expect(provider.checkVerification('+15551234567', '123456')).resolves.toBe(false);
	});

	it('creates an unavailable provider that throws on verification checks', async () => {
		const provider = createSmsProvider({
			mode: 'unavailable',
			logger: createMockLogger(),
		});

		await expect(provider.startVerification('+15551234567')).resolves.toBeUndefined();
		await expect(provider.checkVerification('+15551234567', '123456')).rejects.toThrow(SmsVerificationUnavailableError);
	});

	it('creates a Twilio provider in twilio mode', async () => {
		const provider = createSmsProvider({
			mode: 'twilio',
			config: {
				accountSid: 'AC123',
				authToken: 'twilio-secret',
				verifyServiceSid: 'VA123',
			},
			logger: createMockLogger(),
			fetchFn: async () => new Response(JSON.stringify({status: 'pending'}), {status: 200}),
		});

		await expect(provider.startVerification('+15551234567')).resolves.toBeUndefined();
	});
});
