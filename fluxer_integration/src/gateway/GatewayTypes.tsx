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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const GatewayOpcode = {
	DISPATCH: 0,
	HEARTBEAT: 1,
	IDENTIFY: 2,
	PRESENCE_UPDATE: 3,
	VOICE_STATE_UPDATE: 4,
	RESUME: 6,
	RECONNECT: 7,
	REQUEST_GUILD_MEMBERS: 8,
	INVALID_SESSION: 9,
	HELLO: 10,
	HEARTBEAT_ACK: 11,
	GATEWAY_ERROR: 12,
	LAZY_REQUEST: 14,
} as const;

export type GatewayOpcodeType = ValueOf<typeof GatewayOpcode>;

export interface GatewayPayload {
	op: GatewayOpcodeType;
	d: unknown;
	s?: number | null;
	t?: string | null;
}

export interface GatewayHelloPayload {
	heartbeat_interval: number;
}

export interface GatewayIdentifyPayload {
	token: string;
	properties: {
		os: string;
		browser: string;
		device: string;
	};
	compress?: boolean;
	large_threshold?: number;
	presence?: {
		status: string;
		since?: number | null;
		activities?: Array<unknown>;
		afk?: boolean;
	};
}

export interface GatewayResumePayload {
	token: string;
	session_id: string;
	seq: number;
}

export interface GatewayVoiceStateUpdatePayload {
	guild_id: string | null;
	channel_id: string | null;
	connection_id?: string | null;
	self_mute: boolean;
	self_deaf: boolean;
	self_video?: boolean;
	self_stream?: boolean;
}

export interface GatewayDispatch {
	type: string;
	data: unknown;
	sequence: number;
}

export interface VoiceServerUpdate {
	token: string;
	guild_id?: string | null;
	channel_id?: string | null;
	endpoint: string;
	connection_id: string;
}

export interface VoiceStateUpdate {
	guild_id?: string | null;
	channel_id?: string | null;
	user_id: string;
	member?: unknown;
	session_id: string;
	deaf: boolean;
	mute: boolean;
	self_deaf: boolean;
	self_mute: boolean;
	self_stream?: boolean;
	self_video?: boolean;
	suppress: boolean;
	connection_id?: string | null;
}

export interface ReadyPayload {
	v: number;
	user: {
		id: string;
		username: string;
		discriminator: string;
	};
	guilds: Array<{
		id: string;
		unavailable?: boolean;
	}>;
	session_id: string;
	resume_gateway_url?: string;
	private_channels: Array<unknown>;
	relationships: Array<unknown>;
}

export interface MessageCreatePayload {
	id: string;
	channel_id: string;
	guild_id?: string;
	author: {
		id: string;
		username: string;
	};
	content: string;
	timestamp: string;
}

export interface GatewayResumeState {
	sessionId: string;
	sequence: number;
}
