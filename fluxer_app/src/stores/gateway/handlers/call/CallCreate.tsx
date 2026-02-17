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

import CallAvailabilityStore from '@app/stores/CallAvailabilityStore';
import CallStateStore, {type GatewayCallData} from '@app/stores/CallStateStore';
import DimensionStore from '@app/stores/DimensionStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import type {CallVoiceState} from '@app/types/gateway/GatewayVoiceTypes';

interface CallCreatePayload {
	channel_id: string;
	message_id?: string;
	region?: string;
	voice_states?: Array<CallVoiceState>;
	ringing?: Array<string>;
}

export function handleCallCreate(data: CallCreatePayload, _context: GatewayHandlerContext): void {
	const callData: GatewayCallData = {
		channel_id: data.channel_id,
		message_id: data.message_id,
		region: data.region,
		voice_states: data.voice_states,
		ringing: data.ringing,
	};

	DimensionStore.handleCallCreate(data.channel_id);
	CallAvailabilityStore.setCallAvailable(data.channel_id);
	CallStateStore.handleCallCreate({channelId: data.channel_id, call: callData});
}
