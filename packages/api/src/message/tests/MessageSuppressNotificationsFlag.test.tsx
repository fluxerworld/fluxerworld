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

import {MessageFlags} from '@fluxer/api/src/constants/Channel';
import {
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message suppress notifications flag', () => {
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

	it('sends message with suppress notifications flag set', async () => {
		const account = await createTestAccount(harness);
		await ensureSessionStarted(harness, account.token);
		const guild = await createGuild(harness, account.token, 'Suppress Notifications Flag Guild');
		const channelId = guild.system_channel_id!;

		const message = await createBuilder<{flags: number}>(harness, account.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content: 'Quiet message',
				flags: MessageFlags.SUPPRESS_NOTIFICATIONS,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.flags & MessageFlags.SUPPRESS_NOTIFICATIONS).not.toBe(0);
	});
});
