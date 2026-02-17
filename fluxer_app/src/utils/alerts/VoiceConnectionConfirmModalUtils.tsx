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
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ME} from '@fluxer/constants/src/AppConstants';
import {useCallback, useMemo} from 'react';

export interface VoiceConnectionConfirmModalCallbacks {
	onSwitchDevice: () => void | Promise<void>;
	onJustJoin: () => void;
	onCancel: () => void;
}

export interface VoiceConnectionConfirmModalProps extends VoiceConnectionConfirmModalCallbacks {
	guildId: string | null;
	channelId: string;
}

export interface VoiceConnectionConfirmModalLogicState {
	existingConnectionsCount: number;
	handleSwitchDevice: () => Promise<void>;
	handleJustJoin: () => void;
	handleCancel: () => void;
}

export function useVoiceConnectionConfirmModalLogic({
	guildId,
	channelId,
	onSwitchDevice,
	onJustJoin,
	onCancel,
}: VoiceConnectionConfirmModalProps): VoiceConnectionConfirmModalLogicState {
	const currentUser = UserStore.currentUser;
	const currentConnectionId = MediaEngineStore.connectionId;

	const existingConnectionsCount = useMemo(() => {
		if (!currentUser) return 0;
		const resolvedGuildId = guildId ?? ME;
		const voiceStates = MediaEngineStore.getAllVoiceStatesInChannel(resolvedGuildId, channelId);
		return Object.values(voiceStates).filter(
			(voiceState) =>
				voiceState.user_id === currentUser.id &&
				voiceState.connection_id &&
				voiceState.connection_id !== currentConnectionId,
		).length;
	}, [channelId, currentConnectionId, currentUser, guildId]);

	const handleSwitchDevice = useCallback(async () => {
		await onSwitchDevice();
		ModalActionCreators.pop();
	}, [onSwitchDevice]);

	const handleJustJoin = useCallback(() => {
		onJustJoin();
		ModalActionCreators.pop();
	}, [onJustJoin]);

	const handleCancel = useCallback(() => {
		onCancel();
		ModalActionCreators.pop();
	}, [onCancel]);

	return {
		existingConnectionsCount,
		handleSwitchDevice,
		handleJustJoin,
		handleCancel,
	};
}
