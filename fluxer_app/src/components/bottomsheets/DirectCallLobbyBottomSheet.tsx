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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import * as LayoutActionCreators from '@app/actions/LayoutActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import styles from '@app/components/bottomsheets/DirectCallLobbyBottomSheet.module.css';
import {useCallHeaderState} from '@app/components/channel/channel_view/useCallHeaderState';
import {CameraPreviewModalInRoom} from '@app/components/modals/CameraPreviewModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import {Button} from '@app/components/uikit/button/Button';
import {
	CameraOffIcon,
	CameraOnIcon,
	DeafenIcon,
	DisconnectCallIcon,
	MicrophoneOffIcon,
	MicrophoneOnIcon,
	SettingsIcon,
	UndeafenIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {CompactVoiceCallView} from '@app/components/voice/CompactVoiceCallView';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {navigateToWithMobileHistory} from '@app/utils/MobileNavigation';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('DirectCallLobbyBottomSheet');

interface DirectCallLobbyBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channel: ChannelRecord;
}

export const DirectCallLobbyBottomSheet = observer(function DirectCallLobbyBottomSheet({
	isOpen,
	onClose,
	channel,
}: DirectCallLobbyBottomSheetProps) {
	const {t} = useLingui();
	const callHeaderState = useCallHeaderState(channel);
	const voiceState = MediaEngineStore.getCurrentUserVoiceState(channel.guildId ?? null);
	const localSelfMute = LocalVoiceStateStore.selfMute;
	const localSelfDeaf = LocalVoiceStateStore.selfDeaf;
	const localSelfVideo = LocalVoiceStateStore.selfVideo;
	const currentLatency = MediaEngineStore.currentLatency;
	const voiceStats = MediaEngineStore.voiceStats;
	const voiceServerEndpoint = MediaEngineStore.voiceServerEndpoint;
	const connectionId = MediaEngineStore.connectionId;
	const isConnected = MediaEngineStore.connected && MediaEngineStore.channelId === channel.id;

	const isMuted = voiceState ? voiceState.self_mute : localSelfMute;
	const isDeafened = voiceState ? voiceState.self_deaf : localSelfDeaf;
	const isCameraOn = voiceState ? Boolean(voiceState.self_video) : localSelfVideo;

	const callStatusLabel = useMemo(() => {
		switch (callHeaderState.controlsVariant) {
			case 'incoming':
				return t`Incoming call`;
			case 'join':
				return t`Call available`;
			case 'connecting':
				return t`Join call`;
			case 'inCall':
				return callHeaderState.isDeviceInRoomForChannelCall ? t`In call` : t`In call on other device`;
			default:
				return t`Voice call`;
		}
	}, [callHeaderState.controlsVariant, callHeaderState.isDeviceInRoomForChannelCall, t]);

	const handleToggleMute = useCallback(() => {
		VoiceStateActionCreators.toggleSelfMute(null);
	}, []);

	const handleToggleDeafen = useCallback(() => {
		VoiceStateActionCreators.toggleSelfDeaf(null);
	}, []);

	const handleOpenVoiceSettings = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="voice_video" />));
	}, [onClose]);

	const handleOpenCallView = useCallback(() => {
		onClose();
		const isMobile = MobileLayoutStore.isMobileLayout();
		navigateToWithMobileHistory(Routes.dmChannel(channel.id), isMobile);
		LayoutActionCreators.updateMobileLayoutState(false, true);
	}, [channel.id, onClose]);

	const handleDisconnect = useCallback(() => {
		onClose();
		void CallActionCreators.leaveCall(channel.id);
	}, [channel.id, onClose]);

	const handleRejectIncomingCall = useCallback(() => {
		CallActionCreators.rejectCall(channel.id);
	}, [channel.id]);

	const handleIgnoreIncomingCall = useCallback(() => {
		CallActionCreators.ignoreCall(channel.id);
	}, [channel.id]);

	const handleToggleCamera = useCallback(async () => {
		try {
			if (isCameraOn) {
				await MediaEngineStore.setCameraEnabled(false);
			} else {
				ModalActionCreators.push(modal(() => <CameraPreviewModalInRoom />));
			}
		} catch (err) {
			logger.error('Failed to toggle camera:', err);
		}
	}, [isCameraOn]);

	const handlePrimaryAction = useCallback(() => {
		switch (callHeaderState.controlsVariant) {
			case 'incoming':
				CallActionCreators.joinCall(channel.id);
				return;
			case 'join':
				CallActionCreators.joinCall(channel.id);
				return;
			case 'connecting':
				return;
			case 'inCall':
				if (!callHeaderState.isDeviceInRoomForChannelCall) {
					CallActionCreators.joinCall(channel.id);
					return;
				}
				handleOpenCallView();
				return;
			default:
				return;
		}
	}, [callHeaderState.controlsVariant, callHeaderState.isDeviceInRoomForChannelCall, channel.id, handleOpenCallView]);

	const primaryButtonLabel = useMemo(() => {
		switch (callHeaderState.controlsVariant) {
			case 'incoming':
				return t`Accept`;
			case 'join':
				return t`Join call`;
			case 'connecting':
				return t`Connecting...`;
			case 'inCall':
				return callHeaderState.isDeviceInRoomForChannelCall ? t`Open call view` : t`In call on other device (join?)`;
			default:
				return t`Voice call`;
		}
	}, [callHeaderState.controlsVariant, callHeaderState.isDeviceInRoomForChannelCall, t]);

	const prettyEndpoint = useMemo(() => {
		if (!voiceServerEndpoint) return null;
		try {
			const url = new URL(voiceServerEndpoint);
			return url.port ? `${url.hostname}:${url.port}` : url.hostname;
		} catch {
			return voiceServerEndpoint;
		}
	}, [voiceServerEndpoint]);

	const shouldShowControls = callHeaderState.controlsVariant !== 'hidden';
	const shouldShowDisconnect = callHeaderState.controlsVariant === 'inCall';

	const title = useMemo(() => {
		if (channel.name) return channel.name;
		const dmName = ChannelUtils.getDMDisplayName(channel);
		return dmName || callStatusLabel;
	}, [channel, callStatusLabel]);

	const Row = useMemo(
		() =>
			observer(({label, value, valueClassName}: {label: string; value: React.ReactNode; valueClassName?: string}) => (
				<div className={styles.statRow}>
					<span className={styles.statLabel}>{label}</span>
					<div className={clsx(styles.statValue, valueClassName)}>{value}</div>
				</div>
			)),
		[],
	);

	if (!shouldShowControls) return null;

	return (
		<BottomSheet isOpen={isOpen} onClose={onClose} title={title} surface="primary" snapPoints={[0.35, 0.7, 0.95]}>
			<div className={styles.container}>
				<div className={styles.buttonRow}>
					<Button
						variant="primary"
						onClick={handlePrimaryAction}
						className={styles.fullWidth}
						submitting={callHeaderState.controlsVariant === 'connecting'}
					>
						{primaryButtonLabel}
					</Button>
					{callHeaderState.controlsVariant === 'incoming' && (
						<>
							<Button variant="danger-primary" onClick={handleRejectIncomingCall} className={styles.fullWidth}>
								{t`Reject`}
							</Button>
							<Button variant="secondary" onClick={handleIgnoreIncomingCall} className={styles.fullWidth}>
								{t`Ignore`}
							</Button>
						</>
					)}
					{shouldShowDisconnect && (
						<Button
							variant="danger-primary"
							onClick={handleDisconnect}
							leftIcon={<DisconnectCallIcon size={18} />}
							className={styles.fullWidth}
						>
							{t`Leave call`}
						</Button>
					)}
				</div>

				<div className={styles.statusRow}>
					<span className={styles.statusLabel}>{callStatusLabel}</span>
				</div>

				{callHeaderState.controlsVariant === 'inCall' && callHeaderState.isDeviceInRoomForChannelCall && (
					<div className={styles.callPreview}>
						<CompactVoiceCallView channel={channel} hideHeader={true} />
					</div>
				)}

				<div className={styles.actionButtons}>
					<button type="button" className={styles.actionButton} onClick={handleToggleMute}>
						<div
							className={clsx(styles.iconContainer, isMuted ? styles.iconContainerDanger : styles.iconContainerBrand)}
						>
							{isMuted ? (
								<MicrophoneOffIcon className={styles.actionIcon} size={24} />
							) : (
								<MicrophoneOnIcon className={styles.actionIcon} size={24} />
							)}
						</div>
						<span className={styles.actionText}>{isMuted ? t`Unmute` : t`Mute`}</span>
					</button>

					<button type="button" className={styles.actionButton} onClick={handleToggleDeafen}>
						<div
							className={clsx(
								styles.iconContainer,
								isDeafened ? styles.iconContainerDanger : styles.iconContainerTertiary,
							)}
						>
							{isDeafened ? (
								<DeafenIcon className={styles.actionIconSecondary} size={24} />
							) : (
								<UndeafenIcon className={styles.actionIconSecondary} size={24} />
							)}
						</div>
						<span className={styles.actionText}>{isDeafened ? t`Undeafen` : t`Deafen`}</span>
					</button>

					{isConnected && (
						<button type="button" className={styles.actionButton} onClick={handleToggleCamera}>
							<div
								className={clsx(
									styles.iconContainer,
									isCameraOn ? styles.iconContainerSuccess : styles.iconContainerTertiary,
								)}
							>
								{isCameraOn ? (
									<CameraOnIcon className={styles.actionIcon} size={24} />
								) : (
									<CameraOffIcon className={styles.actionIconSecondary} size={24} />
								)}
							</div>
							<span className={styles.actionText}>{isCameraOn ? t`Camera On` : t`Camera Off`}</span>
						</button>
					)}

					<button type="button" className={styles.actionButton} onClick={handleOpenVoiceSettings}>
						<div className={clsx(styles.iconContainer, styles.iconContainerTertiary)}>
							<SettingsIcon className={styles.actionIconSecondary} size={24} />
						</div>
						<span className={styles.actionText}>{t`Settings`}</span>
					</button>
				</div>

				{isConnected && (
					<div className={styles.connectionInfo}>
						<div className={styles.connectionHeader}>
							<div className={styles.connectionStatusInfo}>
								<div className={styles.connectionTitle}>{t`Connected to call`}</div>
								<div className={styles.connectionSubtitle}>{t`You're in the call`}</div>
							</div>
							<div className={styles.connectionStatusDot} />
						</div>

						<div className={styles.statsGrid}>
							{currentLatency !== null && (
								<Row label={t`Ping`} value={<span className={styles.statValuePrimary}>{currentLatency}ms</span>} />
							)}

							{prettyEndpoint && (
								<Row
									label={t`Endpoint`}
									value={
										<Tooltip text={prettyEndpoint}>
											<span className={styles.endpointValue}>{prettyEndpoint}</span>
										</Tooltip>
									}
									valueClassName={styles.maxWidth}
								/>
							)}

							{connectionId && (
								<Row
									label={t`Connection ID`}
									value={
										<Tooltip text={connectionId}>
											<span className={styles.connectionIdValue}>{connectionId}</span>
										</Tooltip>
									}
									valueClassName={styles.maxWidth}
								/>
							)}

							{typeof voiceStats?.audioPacketLoss === 'number' && voiceStats.audioPacketLoss > 0 && (
								<Row
									label={t`Packet Loss`}
									value={<span className={styles.statValuePrimary}>{voiceStats.audioPacketLoss.toFixed(1)}%</span>}
								/>
							)}

							{typeof voiceStats?.jitter === 'number' && voiceStats.jitter > 0 && (
								<Row
									label={t`Jitter`}
									value={<span className={styles.statValuePrimary}>{voiceStats.jitter.toFixed(1)}ms</span>}
								/>
							)}
						</div>
					</div>
				)}
			</div>
		</BottomSheet>
	);
});
