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

import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {createMuteConfig} from '@app/components/channel/MuteOptions';
import type {MuteConfig} from '@app/records/UserGuildSettingsRecord';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import {useCallback, useState} from 'react';

interface UseMuteSheetBaseParams {
	onMuteSuccess?: () => void;
	onUnmuteSuccess?: () => void;
	onClose?: () => void;
}

interface UseMuteSheetChannelParams extends UseMuteSheetBaseParams {
	mode?: 'channel';
	guildId: string | null;
	channelId: string;
	additionalMutePayload?: Record<string, unknown>;
}

interface UseMuteSheetGuildParams extends UseMuteSheetBaseParams {
	mode: 'guild';
	guildId: string;
}

type UseMuteSheetParams = UseMuteSheetChannelParams | UseMuteSheetGuildParams;

interface UseMuteSheetReturn {
	muteSheetOpen: boolean;
	muteConfig: MuteConfig | null | undefined;
	openMuteSheet: () => void;
	closeMuteSheet: () => void;
	handleMute: (duration: number | null) => void;
	handleUnmute: () => void;
}

export function useMuteSheet(params: UseMuteSheetParams): UseMuteSheetReturn {
	const [muteSheetOpen, setMuteSheetOpen] = useState(false);

	const isGuildMode = params.mode === 'guild';
	const guildId = params.guildId;
	const channelId = isGuildMode ? null : params.channelId;
	const additionalMutePayload = isGuildMode ? undefined : params.additionalMutePayload;
	const {onMuteSuccess, onUnmuteSuccess, onClose} = params;

	const muteConfig = isGuildMode
		? UserGuildSettingsStore.getSettings(guildId)?.mute_config
		: UserGuildSettingsStore.getChannelOverride(guildId, channelId!)?.mute_config;

	const openMuteSheet = useCallback(() => {
		setMuteSheetOpen(true);
	}, []);

	const closeMuteSheet = useCallback(() => {
		setMuteSheetOpen(false);
	}, []);

	const handleMute = useCallback(
		(duration: number | null) => {
			if (isGuildMode) {
				UserGuildSettingsActionCreators.updateGuildSettings(guildId, {
					muted: true,
					mute_config: createMuteConfig(duration),
				});
			} else {
				UserGuildSettingsActionCreators.updateChannelOverride(
					guildId,
					channelId!,
					{
						muted: true,
						mute_config: createMuteConfig(duration),
						...additionalMutePayload,
					},
					{persistImmediately: true},
				);
			}
			setMuteSheetOpen(false);
			onMuteSuccess?.();
			onClose?.();
		},
		[isGuildMode, guildId, channelId, additionalMutePayload, onMuteSuccess, onClose],
	);

	const handleUnmute = useCallback(() => {
		if (isGuildMode) {
			UserGuildSettingsActionCreators.updateGuildSettings(guildId, {
				muted: false,
				mute_config: null,
			});
		} else {
			UserGuildSettingsActionCreators.updateChannelOverride(
				guildId,
				channelId!,
				{
					muted: false,
					mute_config: null,
				},
				{persistImmediately: true},
			);
		}
		setMuteSheetOpen(false);
		onUnmuteSuccess?.();
		onClose?.();
	}, [isGuildMode, guildId, channelId, onUnmuteSuccess, onClose]);

	return {
		muteSheetOpen,
		muteConfig,
		openMuteSheet,
		closeMuteSheet,
		handleMute,
		handleUnmute,
	};
}
