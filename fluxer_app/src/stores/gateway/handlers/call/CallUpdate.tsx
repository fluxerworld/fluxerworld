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
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import type {CallVoiceState} from '@app/types/gateway/GatewayVoiceTypes';

interface CallUpdatePayload {
	channel_id: string;
	message_id?: string;
	region?: string;
	ringing?: Array<string>;
	voice_states?: Array<CallVoiceState>;
}

export function handleCallUpdate(data: CallUpdatePayload, _context: GatewayHandlerContext): void {
	const callData: GatewayCallData = {
		channel_id: data.channel_id,
		message_id: data.message_id,
		region: data.region,
		ringing: data.ringing,
		voice_states: data.voice_states,
	};

	CallAvailabilityStore.setCallAvailable(data.channel_id);
	CallStateStore.handleCallUpdate(callData);
}
