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

import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {useCallback, useEffect, useRef, useState} from 'react';

interface PendingVoiceConnectionResult {
	isPending: boolean;
	startConnection: () => void;
	markPending: () => void;
	cancel: () => void;
}

export function usePendingVoiceConnection({
	guildId,
	channelId,
	onConnected,
}: {
	guildId: string | null | undefined;
	channelId: string | null | undefined;
	onConnected?: () => void;
}): PendingVoiceConnectionResult {
	const [isPending, setIsPending] = useState(false);
	const onConnectedRef = useRef(onConnected);
	onConnectedRef.current = onConnected;

	const isConnectedToTarget = channelId
		? MediaEngineStore.channelId === channelId && MediaEngineStore.guildId === (guildId ?? null)
		: false;
	const isConnected = MediaEngineStore.connected;
	const isConnecting = MediaEngineStore.connecting;

	useEffect(() => {
		if (!isPending) return;

		if (isConnectedToTarget && isConnected) {
			setIsPending(false);
			onConnectedRef.current?.();
			return;
		}

		if (!isConnecting && !isConnectedToTarget) {
			setIsPending(false);
		}
	}, [isPending, isConnectedToTarget, isConnected, isConnecting]);

	const startConnection = useCallback(() => {
		if (!channelId) return;
		setIsPending(true);
		void MediaEngineStore.connectToVoiceChannel(guildId ?? null, channelId);
	}, [guildId, channelId]);

	const markPending = useCallback(() => {
		setIsPending(true);
	}, []);

	const cancel = useCallback(() => {
		setIsPending(false);
	}, []);

	return {isPending, startConnection, markPending, cancel};
}
