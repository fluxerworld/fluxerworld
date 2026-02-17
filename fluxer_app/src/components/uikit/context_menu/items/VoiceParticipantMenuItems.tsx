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

import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {
	BulkTurnOffCameraIcon,
	CopyIdIcon,
	DisconnectIcon,
	FocusIcon,
	GuildDeafenIcon,
	GuildMuteIcon,
	LocalDisableVideoIcon,
	LocalMuteIcon,
	SelfDeafenIcon,
	SelfMuteIcon,
	SettingsIcon,
	TurnOffCameraIcon,
	TurnOffStreamIcon,
	UnfocusIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import styles from '@app/components/uikit/context_menu/items/MenuItems.module.css';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSlider} from '@app/components/uikit/context_menu/MenuItemSlider';
import {Logger} from '@app/lib/Logger';
import CallMediaPrefsStore from '@app/stores/CallMediaPrefsStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import ParticipantVolumeStore from '@app/stores/ParticipantVolumeStore';
import UserStore from '@app/stores/UserStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import {SoundType} from '@app/utils/SoundUtils';
import {useLingui} from '@lingui/react/macro';
import {Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('VoiceParticipantMenuItems');

interface SelfMuteMenuItemProps {
	onClose: () => void;
	connectionId?: string;
	isDeviceSpecific?: boolean;
	label?: string;
}

export const SelfMuteMenuItem: React.FC<SelfMuteMenuItemProps> = observer(
	({connectionId, isDeviceSpecific = false, label}) => {
		const {t} = useLingui();
		const voiceState = connectionId
			? MediaEngineStore.getVoiceStateByConnectionId(connectionId)
			: MediaEngineStore.getCurrentUserVoiceState();
		const isSelfMuted = voiceState?.self_mute ?? false;
		const handleToggle = useCallback(() => {
			if (isDeviceSpecific && connectionId) {
				VoiceStateActionCreators.toggleSelfMuteForConnection(connectionId);
			} else {
				VoiceStateActionCreators.toggleSelfMute(null);
			}
		}, [connectionId, isDeviceSpecific]);
		return (
			<CheckboxItem
				icon={<SelfMuteIcon className={styles.icon} />}
				checked={isSelfMuted}
				onCheckedChange={handleToggle}
			>
				{label ?? t`Mute`}
			</CheckboxItem>
		);
	},
);

interface SelfDeafenMenuItemProps {
	onClose: () => void;
	connectionId?: string;
	isDeviceSpecific?: boolean;
	label?: string;
}

export const SelfDeafenMenuItem: React.FC<SelfDeafenMenuItemProps> = observer(
	({connectionId, isDeviceSpecific = false, label}) => {
		const {t} = useLingui();
		const voiceState = connectionId
			? MediaEngineStore.getVoiceStateByConnectionId(connectionId)
			: MediaEngineStore.getCurrentUserVoiceState();
		const isSelfDeafened = voiceState?.self_deaf ?? false;
		const handleToggle = useCallback(() => {
			if (isDeviceSpecific && connectionId) {
				VoiceStateActionCreators.toggleSelfDeafenForConnection(connectionId);
			} else {
				VoiceStateActionCreators.toggleSelfDeaf(null);
			}
		}, [connectionId, isDeviceSpecific]);
		return (
			<CheckboxItem
				icon={<SelfDeafenIcon className={styles.icon} />}
				checked={isSelfDeafened}
				onCheckedChange={handleToggle}
			>
				{label ?? t`Deafen`}
			</CheckboxItem>
		);
	},
);

interface VoiceVideoSettingsMenuItemProps {
	onClose: () => void;
}

export const VoiceVideoSettingsMenuItem: React.FC<VoiceVideoSettingsMenuItemProps> = observer(({onClose}) => {
	const {t} = useLingui();
	const handleClick = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="voice_video" />));
	}, [onClose]);
	return (
		<MenuItem icon={<SettingsIcon className={styles.icon} />} onClick={handleClick}>
			{t`Voice & Video Settings`}
		</MenuItem>
	);
});

interface SelfTurnOffCameraMenuItemProps {
	onClose: () => void;
}
export const SelfTurnOffCameraMenuItem: React.FC<SelfTurnOffCameraMenuItemProps> = observer(({onClose}) => {
	const {t} = useLingui();
	const connectionId = MediaEngineStore.connectionId;
	const voiceState = connectionId ? MediaEngineStore.getVoiceStateByConnectionId(connectionId) : null;
	const isCameraOn = voiceState?.self_video ?? false;
	const handleClick = useCallback(() => {
		if (connectionId) VoiceStateActionCreators.turnOffCameraForConnection(connectionId);
		onClose();
	}, [connectionId, onClose]);
	if (!isCameraOn) return null;
	return (
		<MenuItem icon={<TurnOffCameraIcon className={styles.icon} />} onClick={handleClick}>
			{t`Turn Off Camera`}
		</MenuItem>
	);
});

interface SelfTurnOffStreamMenuItemProps {
	onClose: () => void;
}
export const SelfTurnOffStreamMenuItem: React.FC<SelfTurnOffStreamMenuItemProps> = observer(({onClose}) => {
	const {t} = useLingui();
	const connectionId = MediaEngineStore.connectionId;
	const voiceState = connectionId ? MediaEngineStore.getVoiceStateByConnectionId(connectionId) : null;
	const isStreaming = voiceState?.self_stream ?? false;
	const handleClick = useCallback(() => {
		if (connectionId) VoiceStateActionCreators.turnOffStreamForConnection(connectionId);
		onClose();
	}, [connectionId, onClose]);
	if (!isStreaming) return null;
	return (
		<MenuItem icon={<TurnOffStreamIcon className={styles.icon} />} onClick={handleClick}>
			{t`Turn Off Stream`}
		</MenuItem>
	);
});

interface ParticipantVolumeSliderProps {
	userId: string;
}

export const ParticipantVolumeSlider: React.FC<ParticipantVolumeSliderProps> = observer(({userId}) => {
	const {t} = useLingui();
	const participantVolume = ParticipantVolumeStore.getVolume(userId);
	const handleChange = useCallback(
		(value: number) => {
			ParticipantVolumeStore.setVolume(userId, value);
			MediaEngineStore.applyLocalAudioPreferencesForUser(userId);
		},
		[userId],
	);
	return (
		<MenuItemSlider
			label={t`User Volume`}
			value={participantVolume}
			minValue={0}
			maxValue={200}
			onChange={handleChange}
			onFormat={(value) => `${Math.round(value)}%`}
		/>
	);
});

interface LocalMuteParticipantMenuItemProps {
	userId: string;
	onClose: () => void;
}

export const LocalMuteParticipantMenuItem: React.FC<LocalMuteParticipantMenuItemProps> = observer(({userId}) => {
	const {t} = useLingui();
	const isLocalMuted = ParticipantVolumeStore.isLocalMuted(userId);
	const handleToggle = useCallback(
		(checked: boolean) => {
			ParticipantVolumeStore.setLocalMute(userId, checked);
			MediaEngineStore.applyLocalAudioPreferencesForUser(userId);
		},
		[userId],
	);
	return (
		<CheckboxItem
			icon={<LocalMuteIcon className={styles.icon} />}
			checked={isLocalMuted}
			onCheckedChange={handleToggle}
		>
			{t`Mute`}
		</CheckboxItem>
	);
});

interface LocalDisableVideoMenuItemProps {
	userId: string;
	connectionId: string;
}

export const LocalDisableVideoMenuItem: React.FC<LocalDisableVideoMenuItemProps> = observer(
	({userId, connectionId}) => {
		const {t} = useLingui();
		const callId = MediaEngineStore.connectionId ?? '';
		const identity = `user_${userId}_${connectionId}`;
		const disabled = callId ? CallMediaPrefsStore.isVideoDisabled(callId, identity) : false;
		const handleToggle = useCallback(
			(checked: boolean) => {
				const id = MediaEngineStore.connectionId ?? '';
				if (!id) {
					const error = new Error('Unable to toggle local video without an active connection');
					logger.error('Local disable video toggle invoked without connection id', {
						userId,
						connectionId,
						identity,
					});
					throw error;
				}
				MediaEngineStore.setLocalVideoDisabled(identity, checked);
			},
			[identity, connectionId, userId],
		);
		return (
			<CheckboxItem
				icon={<LocalDisableVideoIcon className={styles.icon} />}
				checked={disabled}
				onCheckedChange={handleToggle}
			>
				{t`Disable Video (Local)`}
			</CheckboxItem>
		);
	},
);

interface GuildMuteMenuItemProps {
	userId: string;
	guildId: string;
	onClose: () => void;
}

export const GuildMuteMenuItem: React.FC<GuildMuteMenuItemProps> = observer(function GuildMuteMenuItem({
	userId,
	guildId,
}) {
	const {t} = useLingui();
	const member = GuildMemberStore.getMember(guildId, userId);
	const isGuildMuted = member?.mute ?? false;
	const isTimedOut = member?.isTimedOut() ?? false;
	const handleToggle = useCallback(
		async (checked: boolean) => {
			try {
				await GuildMemberActionCreators.update(guildId, userId, {mute: checked});
				if (checked) SoundActionCreators.playSound(SoundType.Mute);
				else SoundActionCreators.playSound(SoundType.Unmute);
			} catch {}
		},
		[guildId, userId],
	);
	return (
		<CheckboxItem
			icon={<GuildMuteIcon className={styles.icon} />}
			checked={!!isGuildMuted}
			onCheckedChange={handleToggle}
			danger
			disabled={isTimedOut}
		>
			{t`Community Mute`}
		</CheckboxItem>
	);
});

interface GuildDeafenMenuItemProps {
	userId: string;
	guildId: string;
	onClose: () => void;
}

export const GuildDeafenMenuItem: React.FC<GuildDeafenMenuItemProps> = observer(function GuildDeafenMenuItem({
	userId,
	guildId,
}) {
	const {t} = useLingui();
	const member = GuildMemberStore.getMember(guildId, userId);
	const isGuildDeafened = member?.deaf ?? false;
	const handleToggle = useCallback(
		async (checked: boolean) => {
			try {
				await GuildMemberActionCreators.update(guildId, userId, {deaf: checked});
				if (checked) SoundActionCreators.playSound(SoundType.Deaf);
				else SoundActionCreators.playSound(SoundType.Undeaf);
			} catch {}
		},
		[guildId, userId],
	);
	return (
		<CheckboxItem
			icon={<GuildDeafenIcon className={styles.icon} />}
			checked={!!isGuildDeafened}
			onCheckedChange={handleToggle}
			danger
		>
			{t`Community Deafen`}
		</CheckboxItem>
	);
});

interface DisconnectParticipantMenuItemProps {
	userId: string;
	guildId: string;
	participantName: string;
	connectionId?: string;
	onClose: () => void;
	label?: string;
}

export const DisconnectParticipantMenuItem: React.FC<DisconnectParticipantMenuItemProps> = observer(
	function DisconnectParticipantMenuItem({userId, guildId, connectionId, onClose, label}) {
		const {t} = useLingui();
		const currentUser = UserStore.currentUser;
		const isSelf = currentUser?.id === userId;
		const handleClick = useCallback(async () => {
			onClose();
			if (isSelf) {
				const isCurrentDevice = !connectionId || connectionId === MediaEngineStore.connectionId;
				if (isCurrentDevice) {
					await MediaEngineStore.disconnectFromVoiceChannel('user');
				} else {
					const cid = connectionId ?? MediaEngineStore.connectionId ?? null;
					if (cid) {
						MediaEngineStore.disconnectRemoteDevice(guildId, cid);
					}
				}
			} else {
				try {
					await GuildMemberActionCreators.update(guildId, userId, {channel_id: null, connection_id: connectionId});
				} catch {}
			}
		}, [guildId, userId, connectionId, onClose, isSelf]);
		const defaultLabel = connectionId ? t`Disconnect Device` : t`Disconnect`;
		return (
			<MenuItem icon={<DisconnectIcon className={styles.icon} />} onClick={handleClick} danger>
				{label ?? defaultLabel}
			</MenuItem>
		);
	},
);

interface TurnOffDeviceCameraMenuItemProps {
	onClose: () => void;
	connectionId: string;
}

export const TurnOffDeviceCameraMenuItem: React.FC<TurnOffDeviceCameraMenuItemProps> = observer(
	({connectionId, onClose}) => {
		const {t} = useLingui();
		const voiceState = MediaEngineStore.getVoiceStateByConnectionId(connectionId);
		const isCameraOn = voiceState?.self_video ?? false;
		const handleClick = useCallback(() => {
			VoiceStateActionCreators.turnOffCameraForConnection(connectionId);
			onClose();
		}, [connectionId, onClose]);
		if (!isCameraOn) return null;
		return (
			<MenuItem icon={<TurnOffCameraIcon className={styles.icon} />} onClick={handleClick}>
				{t`Turn Off Device Camera`}
			</MenuItem>
		);
	},
);

interface TurnOffDeviceStreamMenuItemProps {
	onClose: () => void;
	connectionId: string;
}

export const TurnOffDeviceStreamMenuItem: React.FC<TurnOffDeviceStreamMenuItemProps> = observer(
	({connectionId, onClose}) => {
		const {t} = useLingui();
		const voiceState = MediaEngineStore.getVoiceStateByConnectionId(connectionId);
		const isStreaming = voiceState?.self_stream ?? false;
		const handleClick = useCallback(() => {
			VoiceStateActionCreators.turnOffStreamForConnection(connectionId);
			onClose();
		}, [connectionId, onClose]);
		if (!isStreaming) return null;
		return (
			<MenuItem icon={<TurnOffStreamIcon className={styles.icon} />} onClick={handleClick}>
				{t`Turn Off Device Stream`}
			</MenuItem>
		);
	},
);

interface CopyDeviceIdMenuItemProps {
	onClose: () => void;
	connectionId: string;
}

export const CopyDeviceIdMenuItem: React.FC<CopyDeviceIdMenuItemProps> = observer(({connectionId, onClose}) => {
	const {t, i18n} = useLingui();
	const handleClick = useCallback(() => {
		TextCopyActionCreators.copy(i18n, connectionId, true).catch(() => {});
		onClose();
	}, [connectionId, onClose, i18n]);
	return (
		<MenuItem icon={<CopyIdIcon className={styles.icon} />} onClick={handleClick}>
			{t`Copy Device ID`}
		</MenuItem>
	);
});

interface BulkMuteDevicesMenuItemProps {
	userVoiceStates: Array<{connectionId: string; voiceState: VoiceState}>;
	onClose: () => void;
}

export const BulkMuteDevicesMenuItem: React.FC<BulkMuteDevicesMenuItemProps> = observer(
	({userVoiceStates, onClose}) => {
		const {t} = useLingui();
		const allMuted = useMemo(() => userVoiceStates.every(({voiceState}) => voiceState.self_mute), [userVoiceStates]);
		const handleClick = useCallback(() => {
			const connectionIds = userVoiceStates.map(({connectionId}) => connectionId);
			const targetMute = !allMuted;
			VoiceStateActionCreators.bulkMuteConnections(connectionIds, targetMute);
			if (targetMute) SoundActionCreators.playSound(SoundType.Mute);
			else SoundActionCreators.playSound(SoundType.Unmute);
			onClose();
		}, [userVoiceStates, allMuted, onClose]);
		return (
			<MenuItem icon={<GuildMuteIcon className={styles.icon} />} onClick={handleClick}>
				{allMuted ? t`Unmute All Devices` : t`Mute All Devices`}
			</MenuItem>
		);
	},
);

interface BulkDeafenDevicesMenuItemProps {
	userVoiceStates: Array<{connectionId: string; voiceState: VoiceState}>;
	onClose: () => void;
}

export const BulkDeafenDevicesMenuItem: React.FC<BulkDeafenDevicesMenuItemProps> = observer(
	({userVoiceStates, onClose}) => {
		const {t} = useLingui();
		const allDeafened = useMemo(() => userVoiceStates.every(({voiceState}) => voiceState.self_deaf), [userVoiceStates]);
		const handleClick = useCallback(() => {
			const connectionIds = userVoiceStates.map(({connectionId}) => connectionId);
			const targetDeafen = !allDeafened;
			VoiceStateActionCreators.bulkDeafenConnections(connectionIds, targetDeafen);
			if (targetDeafen) SoundActionCreators.playSound(SoundType.Deaf);
			else SoundActionCreators.playSound(SoundType.Undeaf);
			onClose();
		}, [userVoiceStates, allDeafened, onClose]);
		return (
			<MenuItem icon={<GuildDeafenIcon className={styles.icon} />} onClick={handleClick}>
				{allDeafened ? t`Undeafen All Devices` : t`Deafen All Devices`}
			</MenuItem>
		);
	},
);

interface BulkCameraDevicesMenuItemProps {
	userVoiceStates: Array<{connectionId: string; voiceState: VoiceState}>;
	onClose: () => void;
}

export const BulkCameraDevicesMenuItem: React.FC<BulkCameraDevicesMenuItemProps> = observer(
	({userVoiceStates, onClose}) => {
		const {t} = useLingui();
		const handleClick = useCallback(() => {
			const connectionIds = userVoiceStates.map(({connectionId}) => connectionId);
			VoiceStateActionCreators.bulkTurnOffCameras(connectionIds);
			onClose();
		}, [userVoiceStates, onClose]);
		return (
			<MenuItem icon={<BulkTurnOffCameraIcon className={styles.icon} />} onClick={handleClick}>
				{t`Turn Off All Device Cameras`}
			</MenuItem>
		);
	},
);

interface BulkDisconnectDevicesMenuItemProps {
	userVoiceStates: Array<{connectionId: string; voiceState: VoiceState}>;
	onClose: () => void;
}

export const BulkDisconnectDevicesMenuItem: React.FC<BulkDisconnectDevicesMenuItemProps> = observer(
	({userVoiceStates, onClose}) => {
		const {t} = useLingui();
		const handleClick = useCallback(async () => {
			await VoiceStateActionCreators.bulkDisconnect(userVoiceStates.map(({connectionId}) => connectionId));
			onClose();
		}, [userVoiceStates, onClose]);
		return (
			<MenuItem icon={<DisconnectIcon className={styles.icon} />} onClick={handleClick} danger>
				{t`Disconnect All Devices`}
			</MenuItem>
		);
	},
);

interface FocusParticipantMenuItemProps {
	userId: string;
	connectionId: string;
	isScreenShare?: boolean;
	onClose: () => void;
}

export const FocusParticipantMenuItem: React.FC<FocusParticipantMenuItemProps> = observer(
	({userId, connectionId, isScreenShare = false, onClose}) => {
		const {t} = useLingui();
		const identity = `user_${userId}_${connectionId}`;
		const pinnedParticipantSource = VoiceCallLayoutStore.pinnedParticipantSource;
		const isFocused =
			VoiceCallLayoutStore.pinnedParticipantIdentity === identity &&
			(pinnedParticipantSource == null ||
				pinnedParticipantSource === (isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera));
		const hasMultipleConnections = useMemo(() => {
			const allStates = MediaEngineStore.getAllVoiceStates();
			let count = 0;
			Object.values(allStates).forEach((guildData) => {
				Object.values(guildData).forEach((channelData) => {
					Object.values(channelData).forEach((vs: VoiceState) => {
						if (vs.user_id === userId) count++;
					});
				});
			});
			return count > 1;
		}, [userId]);
		const handleClick = useCallback(() => {
			if (isFocused) {
				VoiceCallLayoutActionCreators.setPinnedParticipant(null);
				VoiceCallLayoutActionCreators.setLayoutMode('grid');
				VoiceCallLayoutActionCreators.markUserOverride();
			} else {
				VoiceCallLayoutActionCreators.setLayoutMode('focus');
				VoiceCallLayoutActionCreators.setPinnedParticipant(
					identity,
					isScreenShare ? Track.Source.ScreenShare : Track.Source.Camera,
				);
				VoiceCallLayoutActionCreators.markUserOverride();
			}
			onClose();
		}, [identity, onClose, isFocused, isScreenShare]);

		const focusLabel = (() => {
			if (isFocused) return t`Unfocus`;
			if (hasMultipleConnections) return t`Focus This Device`;
			return t`Focus This Person`;
		})();

		return (
			<MenuItem
				icon={isFocused ? <UnfocusIcon className={styles.icon} /> : <FocusIcon className={styles.icon} />}
				onClick={handleClick}
			>
				{focusLabel}
			</MenuItem>
		);
	},
);
