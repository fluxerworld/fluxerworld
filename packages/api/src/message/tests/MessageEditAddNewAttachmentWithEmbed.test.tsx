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
import {
	createGuild,
	createMultipartFormData,
	loadFixture,
	sendMessageWithAttachments,
} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message edit add new attachment with embed', () => {
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

	it('adds new attachment with embed referencing it', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const {json: msg} = await sendMessageWithAttachments(
			harness,
			account.token,
			channelId,
			{content: 'Original message'},
			[],
		);

		const fileData = loadFixture('yeah.png');
		const payload = {
			content: 'Edited with new attachment',
			attachments: [
				{
					id: 0,
					filename: 'yeah.png',
				},
			],
			embeds: [
				{
					title: 'New Image',
					image: {
						url: 'attachment://yeah.png',
					},
				},
			],
		};

		const {body, contentType} = createMultipartFormData(payload, [{index: 0, filename: 'yeah.png', data: fileData}]);

		const editResponse = await harness.app.request(`/channels/${channelId}/messages/${msg.id}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': contentType,
				Authorization: account.token,
				'x-forwarded-for': '127.0.0.1',
			},
			body,
		});

		expect(editResponse.status).toBe(200);
		const edited = (await editResponse.json()) as {
			content: string;
			embeds?: Array<{title: string; image?: {url: string}}>;
			attachments?: Array<{id: string; filename: string}>;
		};

		expect(edited.content).toBe('Edited with new attachment');
		expect(edited.embeds).toBeDefined();
		expect(edited.embeds?.length).toBe(1);

		const embed = edited.embeds?.[0];
		expect(embed?.title).toBe('New Image');
		expect(embed?.image?.url).toBeDefined();

		expect(embed?.image?.url).not.toBe('attachment://yeah.png');
		expect(embed?.image?.url).toContain('/attachments/');

		expect(edited.attachments).toBeDefined();
	});
});
