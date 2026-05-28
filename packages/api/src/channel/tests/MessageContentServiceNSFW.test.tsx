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

import {MessageContentService} from '@fluxer/api/src/channel/services/message/MessageContentService';
import type {Channel} from '@fluxer/api/src/models/Channel';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {GuildExplicitContentFilterTypes, GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import type {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {describe, expect, it} from 'vitest';

// isNSFWContentAllowed only inspects channel/guild/member fields — no
// service calls, no async, no DB. Stub deps with empty objects cast to
// the right interfaces. The four constructor params don't get touched
// for this code path.
const service = new MessageContentService(
	{} as never,
	{} as never,
	{} as never,
	{} as never,
);

function channel(isNsfw: boolean, type = ChannelTypes.GUILD_TEXT): Channel {
	return {type, isNsfw} as Channel;
}

function guild(overrides: Partial<GuildResponse> = {}): GuildResponse {
	return {
		nsfw_level: GuildNSFWLevel.DEFAULT,
		explicit_content_filter: GuildExplicitContentFilterTypes.ALL_MEMBERS,
		...overrides,
	} as GuildResponse;
}

function member(roleCount: number): GuildMemberResponse {
	return {roles: new Array(roleCount).fill('role')} as unknown as GuildMemberResponse;
}

describe('MessageContentService.isNSFWContentAllowed', () => {
	it('returns true for an NSFW-flagged guild text channel', () => {
		expect(service.isNSFWContentAllowed({channel: channel(true)})).toBe(true);
	});

	it('returns false for a non-NSFW guild text channel with no guild context', () => {
		expect(service.isNSFWContentAllowed({channel: channel(false)})).toBe(false);
	});

	it('returns true when the guild is age-restricted (nsfw_level), even in a non-NSFW channel', () => {
		// This is the gap Slice A closes — guild-wide age gate now unlocks
		// NSFW content handling for embeds, matching the access-gate behavior.
		expect(
			service.isNSFWContentAllowed({
				channel: channel(false),
				guild: guild({nsfw_level: GuildNSFWLevel.AGE_RESTRICTED}),
			}),
		).toBe(true);
	});

	it('returns true when guild explicit_content_filter is DISABLED', () => {
		expect(
			service.isNSFWContentAllowed({
				channel: channel(false),
				guild: guild({explicit_content_filter: GuildExplicitContentFilterTypes.DISABLED}),
			}),
		).toBe(true);
	});

	it('returns true for MEMBERS_WITHOUT_ROLES filter when the member has roles', () => {
		expect(
			service.isNSFWContentAllowed({
				channel: channel(false),
				guild: guild({
					explicit_content_filter: GuildExplicitContentFilterTypes.MEMBERS_WITHOUT_ROLES,
				}),
				member: member(2),
			}),
		).toBe(true);
	});

	it('returns false for MEMBERS_WITHOUT_ROLES filter when the member has no roles', () => {
		expect(
			service.isNSFWContentAllowed({
				channel: channel(false),
				guild: guild({
					explicit_content_filter: GuildExplicitContentFilterTypes.MEMBERS_WITHOUT_ROLES,
				}),
				member: member(0),
			}),
		).toBe(false);
	});

	it('returns false for ALL_MEMBERS filter regardless of member roles', () => {
		expect(
			service.isNSFWContentAllowed({
				channel: channel(false),
				guild: guild({explicit_content_filter: GuildExplicitContentFilterTypes.ALL_MEMBERS}),
				member: member(5),
			}),
		).toBe(false);
	});

	it('NSFW channel beats every guild-level filter (channel always wins)', () => {
		expect(
			service.isNSFWContentAllowed({
				channel: channel(true),
				guild: guild({
					nsfw_level: GuildNSFWLevel.SAFE,
					explicit_content_filter: GuildExplicitContentFilterTypes.ALL_MEMBERS,
				}),
			}),
		).toBe(true);
	});
});
