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

import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('@app/actions/AuthenticationActionCreators', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@app/actions/AuthenticationActionCreators')>();
	return {
		...actual,
		resetPassword: vi.fn(),
	};
});

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import {resetPassword} from '@app/viewmodels/auth/AuthFlow';

describe('AuthFlow resetPassword', () => {
	const mockedResetPassword = vi.mocked(AuthenticationActionCreators.resetPassword);

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns success result when reset returns auth token', async () => {
		mockedResetPassword.mockResolvedValue({
			token: 'test-token',
			user_id: '123',
		});

		const result = await resetPassword('reset-token', 'new-password');

		expect(result).toEqual({
			type: 'success',
			payload: {
				token: 'test-token',
				userId: '123',
			},
		});
	});

	it('returns MFA challenge when reset requires MFA', async () => {
		mockedResetPassword.mockResolvedValue({
			mfa: true,
			ticket: 'mfa-ticket',
			sms: false,
			totp: true,
			webauthn: false,
		});

		const result = await resetPassword('reset-token', 'new-password');

		expect(result).toEqual({
			type: 'mfa',
			challenge: {
				ticket: 'mfa-ticket',
				sms: false,
				totp: true,
				webauthn: false,
			},
		});
	});
});
