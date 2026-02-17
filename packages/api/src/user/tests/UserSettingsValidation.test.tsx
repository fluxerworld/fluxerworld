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
import {updateUserSettings} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('User Settings Validation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('boolean fields must be booleans', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/users/@me/settings')
			.body({inline_attachment_media: 'true'})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('status must be known string', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/users/@me/settings')
			.body({status: 42})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('null theme not allowed', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/users/@me/settings')
			.body({theme: null})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('mixed invalid shape', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/users/@me/settings')
			.body({status: 'offline', gif_auto_play: 'nope'})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('valid settings update', async () => {
		const account = await createTestAccount(harness);

		const {json} = await updateUserSettings(harness, account.token, {
			status: 'online',
			inline_attachment_media: true,
			gif_auto_play: false,
		});
		expect(json.status).toBe('online');
		expect(json.inline_attachment_media).toBe(true);
		expect(json.gif_auto_play).toBe(false);
	});
});
