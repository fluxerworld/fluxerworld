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
import {getPngDataUrl} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {grantPremium} from '@fluxer/api/src/user/tests/UserTestUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {UserSettingsResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ValidationErrorResponse {
	code: string;
	errors?: Array<{path?: string; code?: string}>;
}

interface EmojiResponse {
	id: string;
}

describe('User custom status emoji premium', () => {
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

	it('rejects custom emoji status for non-premium users', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Custom Status Premium Guild');
		const emojiName = 'status_emoji';
		const emoji = await createBuilder<EmojiResponse>(harness, account.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: emojiName,
				image: getPngDataUrl(),
			})
			.execute();

		const error = await createBuilder<ValidationErrorResponse>(harness, account.token)
			.patch('/users/@me/settings')
			.body({
				custom_status: {
					text: 'Status',
					emoji_id: emoji.id,
					emoji_name: `:${emojiName}:`,
				},
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(error.code).toBe(APIErrorCodes.INVALID_FORM_BODY);
		expect(error.errors?.[0]?.path).toBe('custom_status.emoji_id');
		expect(error.errors?.[0]?.code).toBe(ValidationErrorCodes.PREMIUM_REQUIRED_FOR_CUSTOM_EMOJI);
	});

	it('allows custom emoji status for premium users', async () => {
		const account = await createTestAccount(harness);
		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);
		const guild = await createGuild(harness, account.token, 'Custom Status Premium Success Guild');
		const emojiName = 'status_emoji_premium';
		const emoji = await createBuilder<EmojiResponse>(harness, account.token)
			.post(`/guilds/${guild.id}/emojis`)
			.body({
				name: emojiName,
				image: getPngDataUrl(),
			})
			.execute();

		const settings = await createBuilder<UserSettingsResponse>(harness, account.token)
			.patch('/users/@me/settings')
			.body({
				custom_status: {
					text: 'Premium status',
					emoji_id: emoji.id,
					emoji_name: `:${emojiName}:`,
				},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(settings.custom_status?.emoji_id).toBe(emoji.id);
		expect(settings.custom_status?.emoji_name).toBe(emojiName);
		expect(settings.custom_status?.text).toBe('Premium status');
	});
});
