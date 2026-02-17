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

import {ChannelMessages} from '@app/lib/ChannelMessages';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function clearChannelMessagesCache(): void {
	const channelIds: Array<string> = [];
	ChannelMessages.forEach((_messages, channelId) => {
		channelIds.push(channelId);
	});

	channelIds.forEach((channelId) => {
		ChannelMessages.releaseRetainedChannel(channelId);
		ChannelMessages.clear(channelId);
	});
}

function createManyChannels(prefix: string, count: number): void {
	for (let index = 0; index < count; index += 1) {
		ChannelMessages.getOrCreate(`${prefix}-${index}`);
	}
}

describe('ChannelMessages eviction policy', () => {
	beforeEach(() => {
		clearChannelMessagesCache();
	});

	afterEach(() => {
		clearChannelMessagesCache();
	});

	it('evicts least-recently-used channels when over memory budget', () => {
		const firstChannelId = 'test-lru-first-channel';
		ChannelMessages.getOrCreate(firstChannelId);
		createManyChannels('test-lru-channel', 70);

		expect(ChannelMessages.get(firstChannelId)).toBeUndefined();
		expect(ChannelMessages.get('test-lru-channel-69')).toBeDefined();
	});

	it('keeps retained channels while evicting other channels', () => {
		const retainedChannelId = 'test-retained-active-channel';
		ChannelMessages.retainChannel(retainedChannelId);
		ChannelMessages.getOrCreate(retainedChannelId);

		createManyChannels('test-retained-neighbour', 80);

		expect(ChannelMessages.get(retainedChannelId)).toBeDefined();
		expect(ChannelMessages.get('test-retained-neighbour-0')).toBeUndefined();
	});

	it('allows retained channels to evict after release', () => {
		const retainedChannelId = 'test-release-retained-channel';
		ChannelMessages.retainChannel(retainedChannelId);
		ChannelMessages.getOrCreate(retainedChannelId);
		createManyChannels('test-release-prelude', 60);

		expect(ChannelMessages.get(retainedChannelId)).toBeDefined();

		ChannelMessages.releaseRetainedChannel(retainedChannelId);
		createManyChannels('test-release-followup', 90);

		expect(ChannelMessages.get(retainedChannelId)).toBeUndefined();
	});
});
