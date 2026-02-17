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

import EmojiStore from '@app/stores/EmojiStore';
import type {GuildReadyData} from '@app/types/gateway/GatewayGuildTypes';
import type {GuildEmoji} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {beforeEach, describe, expect, test} from 'vitest';

function createGuildBase(guildId: string): Guild {
	return {
		id: guildId,
		name: `Guild ${guildId}`,
		icon: null,
		vanity_url_code: null,
		owner_id: '1000',
		system_channel_id: null,
		features: [],
		unavailable: false,
	};
}

function createGuildReadyData(guildId: string, emojis: ReadonlyArray<GuildEmoji>): GuildReadyData {
	return {
		id: guildId,
		properties: createGuildBase(guildId),
		channels: [],
		emojis,
		stickers: [],
		members: [],
		member_count: 0,
		presences: [],
		voice_states: [],
		roles: [],
		joined_at: '2026-01-01T00:00:00.000Z',
		unavailable: false,
	};
}

describe('EmojiStore', () => {
	beforeEach(() => {
		EmojiStore.handleConnectionOpen({guilds: []});
	});

	test('keeps guild emojis on metadata-only guild update payloads', () => {
		const guildId = '1';
		EmojiStore.handleConnectionOpen({
			guilds: [
				createGuildReadyData(guildId, [
					{
						id: '11',
						name: 'party',
						animated: false,
					},
				]),
			],
		});

		expect(EmojiStore.getGuildEmoji(guildId)).toHaveLength(1);

		EmojiStore.handleGuildUpdate({
			guild: {
				...createGuildBase(guildId),
				name: 'Guild renamed',
			},
		});

		const emojisAfterGuildUpdate = EmojiStore.getGuildEmoji(guildId);
		expect(emojisAfterGuildUpdate).toHaveLength(1);
		expect(emojisAfterGuildUpdate[0]?.id).toBe('11');
	});

	test('replaces guild emojis when a payload includes an explicit emoji list', () => {
		const guildId = '2';
		EmojiStore.handleConnectionOpen({
			guilds: [
				createGuildReadyData(guildId, [
					{
						id: '21',
						name: 'old',
						animated: false,
					},
				]),
			],
		});

		EmojiStore.handleGuildUpdate({
			guild: createGuildReadyData(guildId, [
				{
					id: '22',
					name: 'new',
					animated: false,
				},
			]),
		});

		const emojisAfterExplicitUpdate = EmojiStore.getGuildEmoji(guildId);
		expect(emojisAfterExplicitUpdate).toHaveLength(1);
		expect(emojisAfterExplicitUpdate[0]?.id).toBe('22');
	});
});
