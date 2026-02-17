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

import {
	addReaction,
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path?: string; code?: string}>;
}

describe('Message reaction validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createMessageHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	describe('GET reactions limit validation', () => {
		it('rejects limit too high', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=6000`)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		it('rejects limit zero', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=0`)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		it('rejects limit negative', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=-1`)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		it('rejects limit non-integer', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=3.5`)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		it('accepts valid limit and pagination parameters', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await addReaction(harness, account.token, channelId, msg.id, '👍');

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=10`)
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, account.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/👍?limit=50&after=${account.userId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
		});
	});

	describe('Unicode emoji validation', () => {
		it('accepts valid simple unicode emoji', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('accepts emoji with skin tone at correct position', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍🏿')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('accepts ZWJ sequence emoji with skin tone at correct position', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🧑🏿‍🎄')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('accepts single regional indicator emoji', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🇵')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('accepts flag emoji (paired regional indicators)', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🇬🇧')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('rejects malformed emoji with skin tone at wrong position', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🧑‍🎄🏿')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();

			expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
			expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		});

		it('rejects multiple emojis concatenated', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍👍')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();

			expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
			expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		});

		it('rejects plain text as emoji', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('hello')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();

			expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
			expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		});

		it('rejects emoji with trailing text', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍abc')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();

			expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
			expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		});

		it('accepts standalone skin tone modifier as valid emoji', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			await createBuilder(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🏿')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('rejects emoji followed by invalid skin tone on non-person emoji', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Test Guild');
			const channelId = guild.system_channel_id!;
			const msg = await sendMessage(harness, account.token, channelId, 'test message');

			const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🎄🏿')}/@me`)
				.body(null)
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();

			expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
			expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.NOT_A_VALID_UNICODE_EMOJI);
		});
	});
});
