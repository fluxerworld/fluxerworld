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

import {createGuildID} from '@fluxer/api/src/BrandedTypes';
import {GuildRepository} from '@fluxer/api/src/guild/repositories/GuildRepository';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import {getGuildMemberSearchService} from '@fluxer/api/src/SearchFactory';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {SearchableGuildMember} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildMemberSearchRequest,
	GuildMemberSearchResponse,
	type GuildMemberSearchResponse as GuildMemberSearchResponseBody,
	type GuildMemberSearchResult,
} from '@fluxer/schema/src/domains/guild/GuildMemberSearchSchemas';

const guildRepository = new GuildRepository();

function createEmptySearchResponse(guildId: string, indexing: boolean): GuildMemberSearchResponseBody {
	return {
		guild_id: guildId,
		members: [],
		page_result_count: 0,
		total_result_count: 0,
		indexing,
	};
}

function mapSearchableMember(hit: SearchableGuildMember): GuildMemberSearchResult {
	return {
		id: hit.id,
		guild_id: hit.guildId,
		user_id: hit.userId,
		username: hit.username,
		discriminator: hit.discriminator,
		global_name: hit.globalName,
		nickname: hit.nickname,
		role_ids: hit.roleIds,
		joined_at: hit.joinedAt,
		supplemental: {
			join_source_type: hit.joinSourceType,
			source_invite_code: hit.sourceInviteCode,
			inviter_id: hit.inviterId,
		},
		is_bot: hit.isBot,
	};
}

export function GuildMemberSearchController(app: HonoApp) {
	app.post(
		'/guilds/:guild_id/members-search',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBERS),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildMemberSearchRequest),
		OpenAPI({
			operationId: 'search_guild_members',
			summary: 'Search guild members',
			responseSchema: GuildMemberSearchResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Search and filter guild members with pagination support.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const guildIdString = guildId.toString();
			const body = ctx.req.valid('json');

			const {checkPermission} = await ctx.get('guildService').getGuildAuthenticated({userId, guildId});
			await checkPermission(Permissions.MANAGE_GUILD);

			const searchService = getGuildMemberSearchService();
			if (!searchService || !searchService.isAvailable()) {
				return ctx.json(createEmptySearchResponse(guildIdString, false));
			}

			const guild = await guildRepository.findUnique(guildId);
			if (!guild) {
				return ctx.json(createEmptySearchResponse(guildIdString, false));
			}

			if (!guild.membersIndexedAt) {
				const workerService = ctx.get('workerService');
				await workerService.addJob(
					'indexGuildMembers',
					{guildId: guildIdString},
					{jobKey: `index-guild-members-${guildId}-lazy`, maxAttempts: 3},
				);
				return ctx.json(createEmptySearchResponse(guildIdString, true));
			}

			const query = body.query?.trim() ?? '';
			const limit = body.limit ?? 25;
			const offset = body.offset ?? 0;

			const results = await searchService.searchMembers(
				query,
				{
					guildId: guildIdString,
					roleIds: body.role_ids,
					joinedAtGte: body.joined_at_gte,
					joinedAtLte: body.joined_at_lte,
					joinSourceType: body.join_source_type,
					sourceInviteCode: body.source_invite_code,
					userCreatedAtGte: body.user_created_at_gte,
					userCreatedAtLte: body.user_created_at_lte,
					isBot: body.is_bot,
					sortBy: body.sort_by,
					sortOrder: body.sort_order,
				},
				{limit, offset},
			);

			const members = results.hits.map(mapSearchableMember);

			return ctx.json({
				guild_id: guildIdString,
				members,
				page_result_count: members.length,
				total_result_count: results.total,
				indexing: false,
			});
		},
	);
}
