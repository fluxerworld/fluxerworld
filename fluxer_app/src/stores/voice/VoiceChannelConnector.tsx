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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {VoiceChannelFullModal} from '@app/components/alerts/VoiceChannelFullModal';
import {VoiceConnectionConfirmModal} from '@app/components/alerts/VoiceConnectionConfirmModal';
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import UserStore from '@app/stores/UserStore';
import VoiceConnectionManager from '@app/stores/voice/VoiceConnectionManager';
import VoiceStateManager from '@app/stores/voice/VoiceStateManager';
import {ME} from '@fluxer/constants/src/AppConstants';

const logger = new Logger('VoiceChannelConnector');

export function checkChannelLimit(guildId: string | null, channelId: string): boolean {
	if (!guildId) return true;

	const channel = ChannelStore.getChannel(channelId);
	if (!channel?.userLimit || channel.userLimit <= 0) return true;

	const voiceStates = VoiceStateManager.getAllVoiceStatesInChannel(guildId, channelId);
	const count = Object.keys(voiceStates).length;
	const user = UserStore.getCurrentUser();
	const already = user && voiceStates[user.id];
	const adjusted = already ? count - 1 : count;

	if (adjusted >= channel.userLimit) {
		ModalActionCreators.push(modal(() => <VoiceChannelFullModal />));
		return false;
	}

	return true;
}

export function checkMultipleConnections(
	guildId: string | null,
	channelId: string,
	onSwitchDevice: () => Promise<void>,
	onJustJoin: () => void,
	onCancel: () => void,
): boolean {
	const user = UserStore.getCurrentUser();
	if (!user) return true;

	if (!GatewayConnectionStore.socket) return true;

	const voiceStateGuildId = guildId ?? ME;
	const voiceStates = VoiceStateManager.getAllVoiceStatesInChannel(voiceStateGuildId, channelId);
	const currentConnectionId = VoiceConnectionManager.connectionId;
	const userStates = Object.values(voiceStates).filter(
		(vs) => vs.user_id === user.id && vs.connection_id !== currentConnectionId,
	);

	if (userStates.length > 0) {
		ModalActionCreators.push(
			modal(() => (
				<VoiceConnectionConfirmModal
					guildId={guildId}
					channelId={channelId}
					onSwitchDevice={async () => {
						for (const vs of userStates) {
							if (vs.connection_id) {
								sendVoiceStateDisconnect(guildId, vs.connection_id);
							}
						}
						await onSwitchDevice();
					}}
					onJustJoin={onJustJoin}
					onCancel={onCancel}
				/>
			)),
		);
		return false;
	}

	return true;
}

export function sendVoiceStateConnect(guildId: string | null, channelId: string): void {
	const socket = GatewayConnectionStore.socket;
	if (!socket) {
		logger.warn('No socket');
		return;
	}

	LocalVoiceStateStore.ensurePermissionMute();

	socket.updateVoiceState({
		guild_id: guildId,
		channel_id: channelId,
		self_mute: LocalVoiceStateStore.getSelfMute(),
		self_deaf: LocalVoiceStateStore.getSelfDeaf(),
		self_video: false,
		self_stream: false,
		viewer_stream_keys: [],
		connection_id: VoiceConnectionManager.connectionId ?? null,
	});
}

export function sendVoiceStateDisconnect(guildId: string | null, connectionId: string): void {
	const socket = GatewayConnectionStore.socket;
	if (!socket) {
		logger.warn('No socket');
		return;
	}

	socket.updateVoiceState({
		guild_id: guildId,
		channel_id: null,
		self_mute: true,
		self_deaf: true,
		self_video: false,
		self_stream: false,
		viewer_stream_keys: [],
		connection_id: connectionId,
	});
}

export function syncVoiceStateToServer(
	guildId: string | null,
	channelId: string,
	connectionId: string,
	partial?: {
		self_video?: boolean;
		self_stream?: boolean;
		self_mute?: boolean;
		self_deaf?: boolean;
		viewer_stream_keys?: Array<string>;
	},
): void {
	const socket = GatewayConnectionStore.socket;
	if (!socket) return;

	socket.updateVoiceState({
		guild_id: guildId,
		channel_id: channelId,
		self_mute: partial?.self_mute ?? LocalVoiceStateStore.getSelfMute(),
		self_deaf: partial?.self_deaf ?? LocalVoiceStateStore.getSelfDeaf(),
		self_video: partial?.self_video ?? LocalVoiceStateStore.getSelfVideo(),
		self_stream: partial?.self_stream ?? LocalVoiceStateStore.getSelfStream(),
		viewer_stream_keys: partial?.viewer_stream_keys ?? LocalVoiceStateStore.getViewerStreamKeys(),
		connection_id: connectionId,
	});
}
