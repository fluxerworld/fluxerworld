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

import {type ChannelID, createChannelID, createGuildID, type GuildID} from '@fluxer/api/src/BrandedTypes';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {User} from '@fluxer/api/src/models/User';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {normalizeRequestPath} from '@fluxer/api/src/utils/RequestPathUtils';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';

function parseResourceId(path: string, resourceName: 'guilds' | 'channels'): string | null {
	const segments = path.split('/').filter(Boolean);
	if (segments.length < 2 || segments[0] !== resourceName) {
		return null;
	}

	const id = segments[1];
	if (!/^\d+$/.test(id)) {
		return null;
	}

	return id;
}

function extractGuildId(path: string): GuildID | null {
	const guildId = parseResourceId(path, 'guilds');
	if (!guildId) {
		return null;
	}

	return createGuildID(BigInt(guildId));
}

function extractChannelId(path: string): ChannelID | null {
	const channelId = parseResourceId(path, 'channels');
	if (!channelId) {
		return null;
	}

	return createChannelID(BigInt(channelId));
}

function isStaffUser(user: User): boolean {
	return (user.flags & UserFlags.STAFF) === UserFlags.STAFF;
}

function isGuildUnavailableForUser(guild: Guild, user: User): boolean {
	if (guild.features.has(GuildFeatures.UNAVAILABLE_FOR_EVERYONE)) {
		return true;
	}

	if (guild.features.has(GuildFeatures.UNAVAILABLE_FOR_EVERYONE_BUT_STAFF)) {
		return !isStaffUser(user);
	}

	return false;
}

async function resolveGuildIdForRequest(ctx: Context<HonoEnv>, path: string): Promise<GuildID | null> {
	const guildId = extractGuildId(path);
	if (guildId !== null) {
		return guildId;
	}

	const channelId = extractChannelId(path);
	if (channelId === null) {
		return null;
	}

	const channel = await ctx.get('channelRepository').findUnique(channelId);
	return channel?.guildId ?? null;
}

export const GuildAvailabilityMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		await next();
		return;
	}

	const normalizedPath = normalizeRequestPath(ctx.req.path);
	const guildId = await resolveGuildIdForRequest(ctx, normalizedPath);
	if (guildId === null) {
		await next();
		return;
	}

	try {
		const guild = await ctx.get('guildService').data.getGuildSystem(guildId);
		if (isGuildUnavailableForUser(guild, user)) {
			throw new MissingAccessError();
		}
	} catch (error) {
		if (error instanceof UnknownGuildError) {
			await next();
			return;
		}

		throw error;
	}

	await next();
});
