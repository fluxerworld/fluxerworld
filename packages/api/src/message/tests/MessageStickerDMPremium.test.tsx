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
import {createFriendship, ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {grantPremium} from '@fluxer/api/src/user/tests/UserTestUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path?: string; code?: string}>;
}

interface DMChannelResponse {
	id: string;
}

interface GuildStickerResponse {
	id: string;
}

interface MessageResponse {
	stickers?: Array<{id: string; name: string; animated: boolean}>;
}

const VALID_PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('Message sticker DM premium gating', () => {
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

	it('rejects custom stickers in DMs for non-premium users', async () => {
		const sender = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const guild = await createGuild(harness, sender.token, 'DM Sticker Premium Test Guild');

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, recipient.token);
		await createFriendship(harness, sender, recipient);

		const sticker = await createBuilder<GuildStickerResponse>(harness, sender.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'dm_sticker',
				tags: ['dm'],
				image: VALID_PNG_DATA_URL,
			})
			.execute();

		const dmChannel = await createBuilder<DMChannelResponse>(harness, sender.token)
			.post('/users/@me/channels')
			.body({recipient_id: recipient.userId})
			.execute();

		const error = await createBuilder<ValidationErrorResponse>(harness, sender.token)
			.post(`/channels/${dmChannel.id}/messages`)
			.body({
				content: 'Sending sticker in DM',
				sticker_ids: [sticker.id],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(error.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(error.errors?.[0]?.path).toBe('sticker');
		expect(error.errors?.[0]?.code).toBe(ValidationErrorCodes.CUSTOM_STICKERS_IN_DMS_REQUIRE_PREMIUM);
	});

	it('allows custom stickers in DMs for premium users', async () => {
		const sender = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const guild = await createGuild(harness, sender.token, 'DM Sticker Premium Success Guild');

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, recipient.token);
		await createFriendship(harness, sender, recipient);
		await grantPremium(harness, sender.userId, UserPremiumTypes.SUBSCRIPTION);

		const sticker = await createBuilder<GuildStickerResponse>(harness, sender.token)
			.post(`/guilds/${guild.id}/stickers`)
			.body({
				name: 'dm_sticker_premium',
				tags: ['dm'],
				image: VALID_PNG_DATA_URL,
			})
			.execute();

		const dmChannel = await createBuilder<DMChannelResponse>(harness, sender.token)
			.post('/users/@me/channels')
			.body({recipient_id: recipient.userId})
			.execute();

		const message = await createBuilder<MessageResponse>(harness, sender.token)
			.post(`/channels/${dmChannel.id}/messages`)
			.body({
				content: 'Sending sticker in DM as premium',
				sticker_ids: [sticker.id],
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.stickers?.[0]?.id).toBe(sticker.id);
	});
});
