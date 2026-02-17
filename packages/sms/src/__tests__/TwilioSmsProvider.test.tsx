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

import {InvalidPhoneNumberError} from '@fluxer/errors/src/domains/auth/InvalidPhoneNumberError';
import {createMockLogger} from '@fluxer/logger/src/mock';
import {TwilioSmsProvider} from '@fluxer/sms/src/providers/TwilioSmsProvider';
import {describe, expect, it} from 'vitest';

interface TwilioRequest {
	url: string;
	authHeader: string;
	body: string;
}

function getCapturedRequest(request: TwilioRequest | null): TwilioRequest {
	if (!request) {
		throw new Error('Expected Twilio request to be captured');
	}
	return request;
}

describe('TwilioSmsProvider', () => {
	it('calls Twilio Verify start endpoint with expected payload', async () => {
		let capturedRequest: TwilioRequest | null = null;

		const fetchStub: typeof fetch = async (_input, init) => {
			capturedRequest = {
				url: String(_input),
				authHeader: (init?.headers as Record<string, string>).Authorization,
				body: init?.body as string,
			};
			return new Response(JSON.stringify({success: true}), {status: 200});
		};

		const provider = new TwilioSmsProvider({
			config: {
				accountSid: 'AC123',
				authToken: 'twilio-secret',
				verifyServiceSid: 'VA123',
			},
			logger: createMockLogger(),
			fetchFn: fetchStub,
		});

		const phone = '+15551234567';
		await provider.startVerification(phone);

		const request = getCapturedRequest(capturedRequest);
		expect(request.url).toBe('https://verify.twilio.com/v2/Services/VA123/Verifications');
		expect(request.authHeader).toBe(`Basic ${Buffer.from('AC123:twilio-secret').toString('base64')}`);
		expect(request.body).toContain('To=%2B15551234567');
		expect(request.body).toContain('Channel=sms');
	});

	it('returns true when verification check is approved', async () => {
		const provider = new TwilioSmsProvider({
			config: {
				accountSid: 'AC123',
				authToken: 'twilio-secret',
				verifyServiceSid: 'VA123',
			},
			logger: createMockLogger(),
			fetchFn: async () => new Response(JSON.stringify({status: 'approved'}), {status: 200}),
		});

		const result = await provider.checkVerification('+15551234567', '123456');
		expect(result).toBe(true);
	});

	it('returns false when verification check is rejected', async () => {
		const provider = new TwilioSmsProvider({
			config: {
				accountSid: 'AC123',
				authToken: 'twilio-secret',
				verifyServiceSid: 'VA123',
			},
			logger: createMockLogger(),
			fetchFn: async () => new Response(JSON.stringify({status: 'pending'}), {status: 200}),
		});
		expect(await provider.checkVerification('+15551234567', '123456')).toBe(false);
	});

	it('throws InvalidPhoneNumberError for Twilio invalid phone code', async () => {
		const provider = new TwilioSmsProvider({
			config: {
				accountSid: 'AC123',
				authToken: 'twilio-secret',
				verifyServiceSid: 'VA123',
			},
			logger: createMockLogger(),
			fetchFn: async () =>
				new Response(JSON.stringify({code: 21211, message: 'Invalid To phone number'}), {status: 400}),
		});
		await expect(provider.startVerification('+15550000000')).rejects.toThrow(InvalidPhoneNumberError);
	});
});
