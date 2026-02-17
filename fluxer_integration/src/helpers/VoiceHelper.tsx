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

interface ConfirmVoiceConnectionResponse {
	success: boolean;
	error?: string;
}

export async function confirmVoiceConnectionForTest(params: {
	guildId: string;
	channelId: string;
	connectionId: string;
}): Promise<void> {
	const response = await apiClient.post<ConfirmVoiceConnectionResponse>('/test/voice/confirm-connection', {
		guild_id: params.guildId,
		channel_id: params.channelId,
		connection_id: params.connectionId,
	});

	if (!response.ok || !response.data.success) {
		throw new Error(`Failed to confirm voice connection: ${JSON.stringify(response.data)}`);
	}
}
