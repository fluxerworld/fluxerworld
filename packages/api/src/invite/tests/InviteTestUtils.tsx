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

import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {GuildInviteMetadataResponse, GuildInviteResponse} from '@fluxer/schema/src/domains/invite/InviteSchemas';

export async function getInvite(harness: ApiTestHarness, token: string, code: string): Promise<GuildInviteResponse> {
	return createBuilder<GuildInviteResponse>(harness, token).get(`/invites/${code}`).execute();
}

export async function deleteInvite(harness: ApiTestHarness, token: string, code: string): Promise<void> {
	await createBuilder(harness, token).delete(`/invites/${code}`).expect(204).execute();
}

export async function listChannelInvites(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
): Promise<Array<GuildInviteMetadataResponse>> {
	return createBuilder<Array<GuildInviteMetadataResponse>>(harness, token)
		.get(`/channels/${channelId}/invites`)
		.execute();
}

export async function listGuildInvites(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
): Promise<Array<GuildInviteMetadataResponse>> {
	return createBuilder<Array<GuildInviteMetadataResponse>>(harness, token).get(`/guilds/${guildId}/invites`).execute();
}
