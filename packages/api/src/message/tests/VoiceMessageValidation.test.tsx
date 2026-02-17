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
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {MessageFlags} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path?: string; code?: string}>;
}

describe('Voice message validation', () => {
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

	const voiceAttachment = {
		id: 0,
		filename: 'voice.ogg',
		flags: 0,
	};

	test('rejects voice message with content', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Voice Message Guild 1');
		const channelId = guild.system_channel_id!;

		await ensureSessionStarted(harness, account.token);

		const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content: 'Hello',
				flags: MessageFlags.VOICE_MESSAGE,
				attachments: [
					{
						...voiceAttachment,
						waveform: 'AA==',
						duration: 5,
					},
				],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.VOICE_MESSAGES_CANNOT_HAVE_CONTENT);
	});

	test('requires a single attachment', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Voice Message Guild 2');
		const channelId = guild.system_channel_id!;

		await ensureSessionStarted(harness, account.token);

		const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				flags: MessageFlags.VOICE_MESSAGE,
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.VOICE_MESSAGES_REQUIRE_SINGLE_ATTACHMENT);
	});

	test('requires waveform for voice attachment', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Voice Message Guild 3');
		const channelId = guild.system_channel_id!;

		await ensureSessionStarted(harness, account.token);

		const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				flags: MessageFlags.VOICE_MESSAGE,
				attachments: [
					{
						...voiceAttachment,
						duration: 5,
					},
				],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.VOICE_MESSAGES_ATTACHMENT_WAVEFORM_REQUIRED);
	});

	test('requires duration for voice attachment', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Voice Message Guild 4');
		const channelId = guild.system_channel_id!;

		await ensureSessionStarted(harness, account.token);

		const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				flags: MessageFlags.VOICE_MESSAGE,
				attachments: [
					{
						...voiceAttachment,
						waveform: 'AA==',
					},
				],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.VOICE_MESSAGES_ATTACHMENT_DURATION_REQUIRED);
	});

	test('rejects voice message exceeding duration limit', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Voice Message Guild 5');
		const channelId = guild.system_channel_id!;

		await ensureSessionStarted(harness, account.token);

		const json = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				flags: MessageFlags.VOICE_MESSAGE,
				attachments: [
					{
						...voiceAttachment,
						waveform: 'AA==',
						duration: 99999,
					},
				],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(json.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(json.errors?.[0]?.code).toBe(ValidationErrorCodes.VOICE_MESSAGES_DURATION_EXCEEDS_LIMIT);
	});
});
