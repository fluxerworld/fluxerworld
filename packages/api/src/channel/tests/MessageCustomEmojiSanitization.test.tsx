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
import {createGuild, getChannel, sendChannelMessage} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {createEmoji, getGifDataUrl, getPngDataUrl} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message custom emoji sanitization', () => {
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

	it('preserves guild-local static and animated custom emojis for free users', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Local emoji guild');
		if (!guild.system_channel_id) {
			throw new Error('Guild system channel id is missing');
		}

		const channel = await getChannel(harness, account.token, guild.system_channel_id);
		const staticEmoji = await createEmoji(harness, account.token, guild.id, {
			name: 'local_static',
			image: getPngDataUrl(),
		});
		const animatedEmoji = await createEmoji(harness, account.token, guild.id, {
			name: 'local_animated',
			image: getGifDataUrl(),
		});

		const content = `Static <:${staticEmoji.name}:${staticEmoji.id}> animated <a:${animatedEmoji.name}:${animatedEmoji.id}>`;
		const message = await sendChannelMessage(harness, account.token, channel.id, content);

		expect(message.content).toBe(content);
	});

	it('strips external custom emojis for free users', async () => {
		const account = await createTestAccount(harness);
		const destinationGuild = await createGuild(harness, account.token, 'Destination guild');
		if (!destinationGuild.system_channel_id) {
			throw new Error('Destination guild system channel id is missing');
		}

		const destinationChannel = await getChannel(harness, account.token, destinationGuild.system_channel_id);
		const sourceGuild = await createGuild(harness, account.token, 'External emoji guild');
		const externalEmoji = await createEmoji(harness, account.token, sourceGuild.id, {
			name: 'external_emoji',
			image: getPngDataUrl(),
		});

		const content = `External <:${externalEmoji.name}:${externalEmoji.id}>`;
		const message = await sendChannelMessage(harness, account.token, destinationChannel.id, content);

		expect(message.content).toBe('External :external_emoji:');
	});
});
