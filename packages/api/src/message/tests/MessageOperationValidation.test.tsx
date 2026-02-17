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
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {ensureSessionStarted, sendMessage} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_IDS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface ErrorResponse {
	code: string;
	errors?: Array<{path?: string; code?: string}>;
}

describe('Message Operation Validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	test('reject sending message without content or embeds', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await createBuilder(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CANNOT_SEND_EMPTY_MESSAGE)
			.execute();
	});

	test('reject message with content too long', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 2');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		const longContent = 'a'.repeat(4001);
		const json = await createBuilder<ErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: longContent})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH);
	});

	test('accept valid message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 3');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await ensureSessionStarted(harness, account.token);
		const message = await sendMessage(harness, account.token, channelId!, 'Hello, world!');
		expect(message.content).toBe('Hello, world!');
	});

	test('get nonexistent message returns 404', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 4');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await createBuilder(harness, account.token)
			.get(`/channels/${channelId}/messages/${TEST_IDS.NONEXISTENT_MESSAGE}`)
			.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.UNKNOWN_MESSAGE)
			.execute();
	});

	test('can get messages with limit', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 7');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await ensureSessionStarted(harness, account.token);
		await sendMessage(harness, account.token, channelId!, 'Test message');

		const {response, json} = await createBuilder<Array<MessageResponse>>(harness, account.token)
			.get(`/channels/${channelId}/messages?limit=1`)
			.expect(HTTP_STATUS.OK)
			.executeWithResponse();

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json.length).toBeLessThanOrEqual(1);
	});

	test('reject edit with empty content', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 8');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await ensureSessionStarted(harness, account.token);
		const message = await sendMessage(harness, account.token, channelId!, 'Test message');

		await createBuilder(harness, account.token)
			.patch(`/channels/${channelId}/messages/${message.id}`)
			.body({content: ''})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CANNOT_SEND_EMPTY_MESSAGE)
			.execute();
	});

	test('can edit own message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 9');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await ensureSessionStarted(harness, account.token);
		const message = await sendMessage(harness, account.token, channelId!, 'Test message');

		const {response, json} = await createBuilder<MessageResponse>(harness, account.token)
			.patch(`/channels/${channelId}/messages/${message.id}`)
			.body({content: 'Edited message'})
			.expect(HTTP_STATUS.OK)
			.executeWithResponse();

		expect(response.status).toBe(HTTP_STATUS.OK);
		expect(json.content).toBe('Edited message');
	});

	test('can delete own message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Message Test Guild 10');
		const channelId = guild.system_channel_id;

		expect(channelId).not.toBeNull();

		await ensureSessionStarted(harness, account.token);
		const message = await sendMessage(harness, account.token, channelId!, 'Test message');

		const {response} = await createBuilder(harness, account.token)
			.delete(`/channels/${channelId}/messages/${message.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.executeWithResponse();

		expect(response.status).toBe(HTTP_STATUS.NO_CONTENT);
	});
});
