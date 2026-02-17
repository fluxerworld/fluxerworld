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

import * as LayoutActionCreators from '@app/actions/LayoutActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import styles from '@app/components/bottomsheets/VoiceLobbyBottomSheet.module.css';
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
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {navigateToWithMobileHistory} from '@app/utils/MobileNavigation';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const logger = new Logger('VoiceLobbyBottomSheet');

interface VoiceLobbyBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	channel: ChannelRecord;
	guild: GuildRecord;
}

export const VoiceLobbyBottomSheet = observer(function VoiceLobbyBottomSheet({
	isOpen,
	onClose,
	channel,
	guild,
}: VoiceLobbyBottomSheetProps) {
	const {t} = useLingui();
	const connectedGuildId = MediaEngineStore.guildId;
	const connectedChannelId = MediaEngineStore.channelId;
	const voiceState = MediaEngineStore.getCurrentUserVoiceState(connectedGuildId);
	const localSelfMute = LocalVoiceStateStore.selfMute;
	const localSelfDeaf = LocalVoiceStateStore.selfDeaf;
	const localSelfVideo = LocalVoiceStateStore.selfVideo;
	const currentLatency = MediaEngineStore.currentLatency;
	const voiceStats = MediaEngineStore.voiceStats;
	const voiceServerEndpoint = MediaEngineStore.voiceServerEndpoint;
	const connectionId = MediaEngineStore.connectionId;

	const isConnected = connectedGuildId === guild.id && connectedChannelId === channel.id;
	const isMuted = voiceState ? voiceState.self_mute : localSelfMute;
	const isDeafened = voiceState ? voiceState.self_deaf : localSelfDeaf;
	const isCameraOn = voiceState ? Boolean(voiceState.self_video) : localSelfVideo;

	const handleToggleMute = () => {
		VoiceStateActionCreators.toggleSelfMute(null);
	};

	const handleToggleDeafen = () => {
		VoiceStateActionCreators.toggleSelfDeaf(null);
	};

	const handleOpenVoiceSettings = () => {
		onClose();
		ModalActionCreators.push(modal(() => <UserSettingsModal initialTab="voice_video" />));
	};

	const handleEnterCall = () => {
		onClose();
		const isMobile = MobileLayoutStore.isMobileLayout();
		navigateToWithMobileHistory(Routes.guildChannel(guild.id, channel.id), isMobile);
		if (isMobile) {
			LayoutActionCreators.updateMobileLayoutState(false, true);
		}
	};

	const handleDisconnect = () => {
		onClose();
		void MediaEngineStore.disconnectFromVoiceChannel('user');
	};

	const handleVoiceConnected = useCallback(() => {
		onClose();
		const isMobile = MobileLayoutStore.isMobileLayout();
		navigateToWithMobileHistory(Routes.guildChannel(guild.id, channel.id), isMobile);
		if (isMobile) {
			LayoutActionCreators.updateMobileLayoutState(false, true);
		}
	}, [guild.id, channel.id, onClose]);

	const {isPending: isConnecting, startConnection: handleConnect} = usePendingVoiceConnection({
		guildId: guild.id,
		channelId: channel.id,
		onConnected: handleVoiceConnected,
	});

	const handleToggleCamera = async () => {
		try {
			if (isCameraOn) {
				await MediaEngineStore.setCameraEnabled(false);
			} else {
				ModalActionCreators.push(modal(() => <CameraPreviewModalInRoom />));
			}
		} catch (err) {
			logger.error('Failed to toggle camera:', err);
		}
	};

	const Row = observer(
		({label, value, valueClassName}: {label: string; value: React.ReactNode; valueClassName?: string}) => (
			<div className={styles.statRow}>
				<span className={styles.statLabel}>{label}</span>
				<div className={clsx(styles.statValue, valueClassName)}>{value}</div>
			</div>
		),
	);

	const prettyEndpoint = (() => {
		if (!voiceServerEndpoint) return null;
		try {
			const url = new URL(voiceServerEndpoint);
			return url.port ? `${url.hostname}:${url.port}` : url.hostname;
		} catch {
			return voiceServerEndpoint;
		}
	})();

	return (
		<BottomSheet isOpen={isOpen} onClose={onClose} title={channel.name}>
			<div className={styles.container}>
				<div className={styles.buttonRow}>
					{isConnected ? (
						<>
							<Button variant="primary" onClick={handleEnterCall} className={styles.fullWidth}>
								{t`Open Call View`}
							</Button>
							<Button
								variant="danger-primary"
								onClick={handleDisconnect}
								leftIcon={<DisconnectCallIcon size={18} />}
								className={styles.fullWidth}
							>
								{t`Disconnect`}
							</Button>
						</>
					) : (
						<Button variant="primary" onClick={handleConnect} className={styles.fullWidth} submitting={isConnecting}>
							{t`Connect to Voice`}
						</Button>
					)}
				</div>

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
								<div className={styles.connectionTitle}>{t`Connected to Voice`}</div>
								<div className={styles.connectionSubtitle}>{t`You're in the voice channel`}</div>
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
