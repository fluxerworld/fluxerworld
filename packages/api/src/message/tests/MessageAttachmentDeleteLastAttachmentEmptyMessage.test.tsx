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
import {createGuild, loadFixture, sendMessageWithAttachments} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {deleteAttachment, ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message attachment delete last attachment empty message', () => {
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

	it('deletes entire message when last attachment removed from empty message', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Attachment Empty Message Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {response, json: msg} = await sendMessageWithAttachments(
			harness,
			account.token,
			channelId,
			{
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(response.status).toBe(200);
		expect(msg.id).toBeDefined();
		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!).toHaveLength(1);

		const attachmentId = msg.attachments![0].id;

		await deleteAttachment(harness, account.token, channelId, msg.id, attachmentId);

		await createBuilder(harness, account.token).get(`/channels/${channelId}/messages/${msg.id}`).expect(404).execute();
	});
});
