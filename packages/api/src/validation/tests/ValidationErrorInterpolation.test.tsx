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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Validation error message interpolation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	describe('type mismatch errors', () => {
		test('returns INVALID_FORMAT for number type mismatch with no uninterpolated placeholders', async () => {
			const account = await createTestAccount(harness);

			const {json} = await createBuilder<{errors: Array<{path: string; code: string; message: string}>}>(
				harness,
				account.token,
			)
				.patch('/users/@me/settings')
				.body({
					guild_folders: [
						{
							id: 'string-instead-of-number',
							name: 'Test',
							guild_ids: [],
						},
					],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();

			expect(json.errors).toBeDefined();
			const error = json.errors.find((e) => e.path === 'guild_folders.0.id');
			expect(error).toBeDefined();
			expect(error?.code).toBe(ValidationErrorCodes.INVALID_FORMAT);
			expect(error?.message).not.toMatch(/\{[^}]+\}/);
		});
	});

	describe('range errors', () => {
		test('properly interpolates field name for too_small errors', async () => {
			const account = await createTestAccount(harness);

			const {json} = await createBuilder<{errors: Array<{path: string; code: string; message: string}>}>(
				harness,
				account.token,
			)
				.patch('/users/@me/settings')
				.body({
					guild_folders: [
						{
							id: -100,
							name: 'Test',
							guild_ids: [],
						},
					],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();

			expect(json.errors).toBeDefined();
			const error = json.errors.find((e) => e.path === 'guild_folders.0.id');
			expect(error).toBeDefined();
			expect(error?.message).not.toMatch(/\{name\}/);
			expect(error?.message).not.toMatch(/\{minValue\}/);
			expect(error?.message).not.toMatch(/\{minimum\}/);
		});
	});

	describe('custom validation errors with params', () => {
		test('properly interpolates params for query integer validation', async () => {
			const account = await createTestAccount(harness);

			const {json} = await createBuilder<{errors: Array<{path: string; code: string; message: string}>}>(
				harness,
				account.token,
			)
				.get('/users/@me/mentions?limit=abc')
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();

			expect(json.errors).toBeDefined();
			const error = json.errors.find((e) => e.path === 'limit');
			expect(error).toBeDefined();
			expect(error?.code).toBe(ValidationErrorCodes.VALUE_MUST_BE_INTEGER_IN_RANGE);
			expect(error?.message).not.toMatch(/\{name\}/);
			expect(error?.message).not.toMatch(/\{minValue\}/);
			expect(error?.message).not.toMatch(/\{maxValue\}/);
			expect(error?.message).toContain('limit');
		});

		test('properly interpolates params for out of range query integer', async () => {
			const account = await createTestAccount(harness);

			const {json} = await createBuilder<{errors: Array<{path: string; code: string; message: string}>}>(
				harness,
				account.token,
			)
				.get('/users/@me/mentions?limit=9999')
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();

			expect(json.errors).toBeDefined();
			const error = json.errors.find((e) => e.path === 'limit');
			expect(error).toBeDefined();
			expect(error?.code).toBe(ValidationErrorCodes.VALUE_MUST_BE_INTEGER_IN_RANGE);
			expect(error?.message).not.toMatch(/\{[^}]+\}/);
		});
	});
});
