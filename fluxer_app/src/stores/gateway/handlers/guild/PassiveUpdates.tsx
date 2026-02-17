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

import ChannelStore from '@app/stores/ChannelStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import {handleChannelCreate} from '@app/stores/gateway/handlers/channel/ChannelCreate';
import {handleChannelDelete} from '@app/stores/gateway/handlers/channel/ChannelDelete';
import {handleChannelUpdate} from '@app/stores/gateway/handlers/channel/ChannelUpdate';
import ReadStateStore from '@app/stores/ReadStateStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

interface PassiveUpdatesPayload {
	guild_id: string;
	channels: Record<string, string>;
	voice_states?: Array<VoiceState>;
	created_channels?: Array<Channel>;
	updated_channels?: Array<Channel>;
	deleted_channel_ids?: Array<string>;
}

export function handlePassiveUpdates(data: PassiveUpdatesPayload, context: GatewayHandlerContext): void {
	const {
		channels,
		voice_states: voiceStates,
		created_channels: createdChannels,
		updated_channels: updatedChannels,
	} = data;

	for (const [channelId, lastMessageId] of Object.entries(channels)) {
		const state = ReadStateStore.getIfExists(channelId);
		if (state && state.lastMessageId !== lastMessageId) {
			state.lastMessageId = lastMessageId;
		}
	}

	if (createdChannels?.length) {
		for (const channel of createdChannels) {
			handleChannelCreate(channel, context);
		}
	}

	if (updatedChannels?.length) {
		for (const channel of updatedChannels) {
			handleChannelUpdate(channel, context);
		}
	}

	if (data.deleted_channel_ids?.length) {
		for (const channelId of data.deleted_channel_ids) {
			const existingChannel = ChannelStore.getChannel(channelId);
			if (existingChannel) {
				handleChannelDelete(existingChannel.toJSON(), context);
			}
		}
	}

	if (voiceStates?.length) {
		MediaEngineStore.handlePassiveVoiceStates(data.guild_id, voiceStates);
	}
}
