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

import {apiClient} from '@fluxer/integration/helpers/ApiClient';

export interface GuildResponse {
	id: string;
	name: string;
	owner_id: string;
	system_channel_id: string | null;
}

export interface ChannelResponse {
	id: string;
	name: string;
	type: number;
	guild_id?: string;
}

export async function createGuild(token: string, name: string): Promise<GuildResponse> {
	const response = await apiClient.post<GuildResponse>('/guilds', {name}, token);

	if (!response.ok) {
		throw new Error(`Failed to create guild: ${JSON.stringify(response.data)}`);
	}

	return response.data;
}

export async function createVoiceChannel(token: string, guildId: string, name: string): Promise<ChannelResponse> {
	const response = await apiClient.post<ChannelResponse>(
		`/guilds/${guildId}/channels`,
		{
			name,
			type: 2,
		},
		token,
	);

	if (!response.ok) {
		throw new Error(`Failed to create voice channel: ${JSON.stringify(response.data)}`);
	}

	return response.data;
}

export async function createTextChannel(token: string, guildId: string, name: string): Promise<ChannelResponse> {
	const response = await apiClient.post<ChannelResponse>(
		`/guilds/${guildId}/channels`,
		{
			name,
			type: 0,
		},
		token,
	);

	if (!response.ok) {
		throw new Error(`Failed to create text channel: ${JSON.stringify(response.data)}`);
	}

	return response.data;
}
