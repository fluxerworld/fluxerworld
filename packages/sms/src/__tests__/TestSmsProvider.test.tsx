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

import {createMockLogger} from '@fluxer/logger/src/mock';
import {TestSmsProvider} from '@fluxer/sms/src/providers/TestSmsProvider';
import {describe, expect, it} from 'vitest';

describe('TestSmsProvider', () => {
	describe('startVerification', () => {
		it('completes without error', async () => {
			const logger = createMockLogger();
			const provider = new TestSmsProvider({logger});

			await expect(provider.startVerification('+15551234567')).resolves.toBeUndefined();
		});

		it('supports different phone number formats', async () => {
			const logger = createMockLogger();
			const provider = new TestSmsProvider({logger});

			await expect(provider.startVerification('+14155552671')).resolves.toBeUndefined();
			await expect(provider.startVerification('+447911123456')).resolves.toBeUndefined();
			await expect(provider.startVerification('+81312345678')).resolves.toBeUndefined();
		});
	});

	describe('checkVerification', () => {
		it('returns true for the default valid code', async () => {
			const logger = createMockLogger();
			const provider = new TestSmsProvider({logger});

			await provider.startVerification('+15551234567');
			const result = await provider.checkVerification('+15551234567', '123456');

			expect(result).toBe(true);
		});

		it('returns false for invalid codes', async () => {
			const logger = createMockLogger();
			const provider = new TestSmsProvider({logger});

			await provider.startVerification('+15551234567');

			expect(await provider.checkVerification('+15551234567', '000000')).toBe(false);
			expect(await provider.checkVerification('+15551234567', '654321')).toBe(false);
			expect(await provider.checkVerification('+15551234567', 'abcdef')).toBe(false);
			expect(await provider.checkVerification('+15551234567', '')).toBe(false);
		});

		it('supports custom verification code overrides', async () => {
			const logger = createMockLogger();
			const provider = new TestSmsProvider({logger, verificationCode: '654321'});

			expect(await provider.checkVerification('+15551111111', '123456')).toBe(false);
			expect(await provider.checkVerification('+15551111111', '654321')).toBe(true);
		});
	});
});
