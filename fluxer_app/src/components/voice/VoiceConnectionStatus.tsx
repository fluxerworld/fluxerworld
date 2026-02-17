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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as DeveloperOptionsActionCreators from '@app/actions/DeveloperOptionsActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PopoutActionCreators from '@app/actions/PopoutActionCreators';
import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import {CameraPreviewModalInRoom} from '@app/components/modals/CameraPreviewModal';
import {ScreenShareSettingsModal} from '@app/components/modals/ScreenShareSettingsModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {FocusRingWrapper} from '@app/components/uikit/FocusRingWrapper';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {SignalStrengthIcon} from '@app/components/voice/SignalStrengthIcon';
import styles from '@app/components/voice/VoiceConnectionStatus.module.css';
import {
	useVoiceParticipantAvatarEntries,
	VoiceParticipantSpeakingAvatarStack,
} from '@app/components/voice/VoiceParticipantAvatarList';
import {VoiceCameraSettingsMenu} from '@app/components/voice/VoiceSettingsMenus';
import {useMediaDevices} from '@app/hooks/useMediaDevices';
import {usePopout} from '@app/hooks/usePopout';
import {Logger} from '@app/lib/Logger';
import {Link} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import ChannelStore from '@app/stores/ChannelStore';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import GuildStore from '@app/stores/GuildStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {LatencyDataPoint} from '@app/stores/voice/VoiceStatsManager';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {supportsDesktopScreenShareAudioCapture} from '@app/utils/NativeUtils';
import {executeScreenShareOperation} from '@app/utils/ScreenShareUtils';
import {useLingui} from '@lingui/react/macro';
import {
	CameraIcon,
	CameraSlashIcon,
	CaretRightIcon,
	DesktopIcon,
	DeviceMobileIcon,
	LockSimpleIcon,
	MonitorPlayIcon,
	PhoneXIcon,
	UsersIcon,
	WaveformIcon,
	XIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {ScreenSharePresets} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import {type MouseEvent as ReactMouseEvent, useCallback, useMemo} from 'react';

const logger = new Logger('VoiceConnectionStatus');
const SCREEN_SHARE_PRESETS = {
	low: ScreenSharePresets.h360fps15,
	medium: ScreenSharePresets.h720fps30,
	high: ScreenSharePresets.h1080fps30,
	ultra: ScreenSharePresets.h1080fps30,
	'4k': ScreenSharePresets.original,
} as const;
type ScreenShareResolution = keyof typeof SCREEN_SHARE_PRESETS;

function resolveScreenShareFrameRate(frameRate: number): number {
	if (frameRate === 15 || frameRate === 24 || frameRate === 60) {
		return frameRate;
	}
	return 30;
}

const VoiceDetailsPopout = observer(() => {
	const {i18n, t} = useLingui();
	const latency = MediaEngineStore.currentLatency;
	const averageLatency = MediaEngineStore.averageLatency;
	const latencyHistory = MediaEngineStore.latencyHistory;
	const voiceServerEndpoint = MediaEngineStore.voiceServerEndpoint;
	const connectionId = MediaEngineStore.connectionId;
	const voiceState = MediaEngineStore.getCurrentUserVoiceState();
	const isMobile = voiceState?.is_mobile ?? false;

	const strippedEndpoint = voiceServerEndpoint
		? (() => {
				try {
					const url = new URL(voiceServerEndpoint);
					return url.port ? `${url.hostname}:${url.port}` : url.hostname;
				} catch {
					return voiceServerEndpoint;
				}
			})()
		: null;

	const chartData = latencyHistory.slice(-30);
	const maxLatency = Math.max(...chartData.map((d: LatencyDataPoint) => d.latency), 0) + 10;
	const chartWidth = 300;
	const chartHeight = 120;
	const padding = {top: 10, right: 10, bottom: 20, left: 40};
	const graphWidth = chartWidth - padding.left - padding.right;
	const graphHeight = chartHeight - padding.top - padding.bottom;

	const createLinePath = () => {
		if (chartData.length === 0) return '';

		const points = chartData.map((point: LatencyDataPoint, index: number) => {
			const x = padding.left + (index / Math.max(chartData.length - 1, 1)) * graphWidth;
			const y = padding.top + graphHeight - (point.latency / maxLatency) * graphHeight;
			return `${x},${y}`;
		});

		return `M ${points.join(' L ')}`;
	};

	return (
		<div className={styles.popoutContainer}>
			<div className={styles.popoutHeader}>
				<span className={styles.popoutTitle}>{t`Voice Connection`}</span>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={styles.popoutCloseButton}
						onClick={() => PopoutActionCreators.close()}
						aria-label={t`Close`}
					>
						<XIcon weight="bold" className={styles.iconSmall} />
					</button>
				</FocusRing>
			</div>

			{chartData.length > 0 && (
				<div className={styles.chartContainer}>
					<svg
						viewBox={`0 0 ${chartWidth} ${chartHeight}`}
						className={styles.chartSvg}
						role="img"
						aria-label={t`Latency graph`}
					>
						{Array.from({length: 5}, (_, i) => Math.round((maxLatency / 4) * i)).map((value) => {
							const y = padding.top + graphHeight - (value / maxLatency) * graphHeight;
							return (
								<g key={value}>
									<line
										x1={padding.left}
										y1={y}
										x2={chartWidth - padding.right}
										y2={y}
										className={`${styles.gridLine} ${styles.gridLineHorizontal} ${styles.textBackgroundModifierHover}`}
									/>
									<text x={padding.left - 5} y={y} className={styles.gridText}>
										{value}ms
									</text>
								</g>
							);
						})}

						<line
							x1={padding.left}
							y1={chartHeight - padding.bottom}
							x2={chartWidth - padding.right}
							y2={chartHeight - padding.bottom}
							className={`${styles.gridLine} ${styles.textBackgroundModifierHover}`}
						/>

						<line
							x1={padding.left}
							y1={padding.top}
							x2={padding.left}
							y2={chartHeight - padding.bottom}
							className={`${styles.gridLine} ${styles.textBackgroundModifierHover}`}
						/>

						<path d={createLinePath()} className={`${styles.chartLine} ${styles.textGreen}`} />

						{chartData.map((point: LatencyDataPoint, index: number) => {
							const x = padding.left + (index / Math.max(chartData.length - 1, 1)) * graphWidth;
							const y = padding.top + graphHeight - (point.latency / maxLatency) * graphHeight;
							return (
								<circle
									key={point.timestamp}
									cx={x}
									cy={y}
									r="2"
									className={`${styles.chartPoint} ${styles.textGreen}`}
								/>
							);
						})}
					</svg>
				</div>
			)}

			<div className={styles.popoutStats}>
				{connectionId && (
					<div className={styles.popoutStatRow}>
						<span className={styles.popoutStatLabel}>{t`Device:`}</span>
						<Tooltip text={connectionId}>
							<div className={styles.deviceBadge}>
								{isMobile ? (
									<DeviceMobileIcon weight="regular" className={styles.deviceIcon} />
								) : (
									<DesktopIcon weight="regular" className={styles.deviceIcon} />
								)}
								<span className={styles.deviceBadgeText}>{connectionId}</span>
							</div>
						</Tooltip>
					</div>
				)}
				<div className={styles.popoutStatRow}>
					<span className={styles.popoutStatLabel}>{t`Current ping:`}</span>
					<span className={styles.popoutStatValue}>{latency !== null ? `${latency}ms` : t`Measuring...`}</span>
				</div>
				{averageLatency !== null && averageLatency !== undefined && (
					<div className={styles.popoutStatRow}>
						<span className={styles.popoutStatLabel}>{t`Average ping:`}</span>
						<span className={styles.popoutStatValue}>{averageLatency}ms</span>
					</div>
				)}
				{strippedEndpoint && (
					<div className={styles.popoutStatRow}>
						<span className={styles.popoutStatLabel}>{t`Endpoint:`}</span>
						<Tooltip text={strippedEndpoint}>
							<FocusRing offset={-2}>
								<div
									className={styles.endpointBadge}
									role="button"
									tabIndex={0}
									aria-label={t`Copy endpoint`}
									onClick={async (e) => {
										e.stopPropagation();
										await TextCopyActionCreators.copy(i18n, strippedEndpoint);
									}}
									onKeyDown={async (e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											await TextCopyActionCreators.copy(i18n, strippedEndpoint);
										}
									}}
								>
									<LockSimpleIcon weight="fill" className={styles.lockIcon} />
									<span className={styles.endpointBadgeText}>{strippedEndpoint}</span>
								</div>
							</FocusRing>
						</Tooltip>
					</div>
				)}
			</div>
		</div>
	);
});

const VoiceConnectionStatusInner = observer(() => {
	const {t} = useLingui();
	const voiceState = MediaEngineStore.getCurrentUserVoiceState();
	const storeConnectedGuildId = MediaEngineStore.guildId;
	const storeConnectedChannelId = MediaEngineStore.channelId;
	const isConnecting = MediaEngineStore.connecting;
	const storeIsConnected = MediaEngineStore.connected;
	const voiceSettings = VoiceSettingsStore;
	const noiseSuppressionEnabled = voiceSettings.noiseSuppression;
	const showVoiceConnectionId = voiceSettings.showVoiceConnectionId;

	const currentLatency = MediaEngineStore.currentLatency;
	const latencyForSignal = currentLatency;
	const connectionId = MediaEngineStore.connectionId;
	const isMobile = voiceState?.is_mobile ?? false;
	const participantAvatarEntries = useVoiceParticipantAvatarEntries({
		guildId: storeConnectedGuildId ?? null,
		channelId: storeConnectedChannelId,
	});
	const showVoiceConnectionAvatarStack = voiceSettings.showVoiceConnectionAvatarStack;

	const {openProps: popoutProps} = usePopout('voice-details-popout');

	const connectedGuildId = storeConnectedGuildId;
	const connectedChannelId = storeConnectedChannelId;
	const isConnected = storeIsConnected;

	if (!connectedChannelId) {
		return null;
	}

	const channel = ChannelStore.getChannel(connectedChannelId);
	if (!channel) {
		return null;
	}

	const isPrivateChannel = channel.isPrivate();
	const guild = connectedGuildId ? GuildStore.getGuild(connectedGuildId) : null;

	if (!isPrivateChannel && !guild) {
		return null;
	}

	const getStatusText = () => {
		if (isConnecting) return t`Connecting...`;
		if (isConnected) return t`Voice Connected`;
		return t`Disconnected`;
	};

	const getStatusClass = () => {
		if (isConnecting) return styles.statusConnecting;
		if (isConnected) return styles.statusConnected;
		return styles.statusDisconnected;
	};
	const shouldShowVoiceConnectionAvatarStack =
		isConnected && showVoiceConnectionAvatarStack && participantAvatarEntries.length > 0;
	let channelRoute: string;
	if (isPrivateChannel) {
		channelRoute = Routes.dmChannel(channel.id);
	} else if (guild) {
		channelRoute = Routes.guildChannel(guild.id, channel.id);
	} else {
		return null;
	}
	const avatarGuildId = guild?.id ?? channel.guildId ?? null;
	const channelDisplayName = isPrivateChannel
		? ChannelUtils.getDMDisplayName(channel)
		: channel.name?.trim() || ChannelUtils.getName(channel);
	const guildDisplayName = guild?.name ?? '';
	const channelSourceLabel = isPrivateChannel ? channelDisplayName : `${channelDisplayName} / ${guildDisplayName}`;

	const handleVoiceConnectionStatusContextMenu = useCallback(
		(event: ReactMouseEvent<HTMLElement>) => {
			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<MenuGroup>
					<CheckboxItem
						icon={<UsersIcon weight="regular" className={styles.icon} />}
						checked={showVoiceConnectionAvatarStack}
						onCheckedChange={(checked) => {
							VoiceSettingsActionCreators.update({showVoiceConnectionAvatarStack: checked});
							onClose();
						}}
					>
						{t`Show Call Avatars`}
					</CheckboxItem>
					<CheckboxItem
						checked={showVoiceConnectionId}
						onCheckedChange={(checked) => {
							VoiceSettingsActionCreators.update({showVoiceConnectionId: checked});
							onClose();
						}}
					>
						{t`Show Connection ID`}
					</CheckboxItem>
				</MenuGroup>
			));
		},
		[showVoiceConnectionAvatarStack, showVoiceConnectionId, t],
	);

	return (
		<div className={styles.voiceConnectionContainer}>
			<div className={styles.statusRow}>
				{isConnected && (
					<Tooltip text={currentLatency !== null ? t`Ping: ${currentLatency}ms` : t`Measuring latency...`}>
						<div className={styles.signalIcon}>
							<SignalStrengthIcon latency={latencyForSignal} size={16} />
						</div>
					</Tooltip>
				)}
				<Popout {...popoutProps} position="top" offsetMainAxis={16} render={() => <VoiceDetailsPopout />}>
					<FocusRingWrapper focusRingOffset={-2}>
						<button
							type="button"
							className={clsx(styles.statusButton, getStatusClass())}
							onContextMenu={handleVoiceConnectionStatusContextMenu}
						>
							{getStatusText()}
						</button>
					</FocusRingWrapper>
				</Popout>
				<div className={styles.controls}>
					<Tooltip text={noiseSuppressionEnabled ? t`Disable Noise Suppression` : t`Enable Noise Suppression`}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={clsx(styles.controlButton, noiseSuppressionEnabled && styles.selected)}
								onClick={() => VoiceSettingsActionCreators.update({noiseSuppression: !noiseSuppressionEnabled})}
								aria-label={noiseSuppressionEnabled ? t`Disable Noise Suppression` : t`Enable Noise Suppression`}
							>
								<WaveformIcon weight="fill" className={styles.icon} />
							</button>
						</FocusRing>
					</Tooltip>
					<Tooltip text={t`Disconnect`}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={styles.controlButton}
								onClick={async () => {
									await MediaEngineStore.disconnectFromVoiceChannel();
								}}
								aria-label={t`Disconnect`}
							>
								<PhoneXIcon weight="fill" className={styles.icon} />
							</button>
						</FocusRing>
					</Tooltip>
				</div>
			</div>

			<div className={styles.connectionInfo}>
				<div className={styles.channelSourceRow}>
					<FocusRing offset={-2}>
						<Link
							to={channelRoute}
							className={styles.channelSourceLink}
							aria-label={t`Jump to ${channelSourceLabel}`}
							onContextMenu={handleVoiceConnectionStatusContextMenu}
						>
							{isPrivateChannel ? (
								<span className={styles.channelSourceText}>{channelDisplayName}</span>
							) : (
								<span className={styles.channelSourceText}>
									<span className={styles.channelSourceChannel}>{channelDisplayName}</span>
									<span className={styles.channelSourceSeparator}> / </span>
									<span className={styles.channelSourceGuild}>{guildDisplayName}</span>
								</span>
							)}
						</Link>
					</FocusRing>
				</div>
				{showVoiceConnectionId && connectionId && (
					<div className={styles.connectionIdRow}>
						{isMobile ? (
							<DeviceMobileIcon weight="regular" className={styles.connectionIdIcon} />
						) : (
							<DesktopIcon weight="regular" className={styles.connectionIdIcon} />
						)}
						<div className={styles.connectionIdValue}>
							<Tooltip text={connectionId} position="top" align="center">
								<span className={styles.connectionIdValueText}>{connectionId}</span>
							</Tooltip>
						</div>
					</div>
				)}
				{shouldShowVoiceConnectionAvatarStack && (
					<div className={styles.channelAvatarStack}>
						<VoiceParticipantSpeakingAvatarStack
							entries={participantAvatarEntries}
							guildId={avatarGuildId}
							channelId={channel.id}
							size={20}
							maxVisible={4}
						/>
					</div>
				)}
			</div>

			<div className={styles.mediaSection}>
				<LocalParticipantControls />
			</div>
		</div>
	);
});

interface ScreenShareQualityMenuContentProps {
	frameRateOptions: Array<{value: number; label: string; isPremium: boolean}>;
	resolutionOptions: Array<{value: ScreenShareResolution; label: string; isPremium: boolean}>;
	hasHigherVideoQuality: boolean;
	includeStreamAudio: boolean;
	applyScreenShareSettings: (
		resolution: ScreenShareResolution,
		frameRate: number,
		includeAudio: boolean,
	) => Promise<void>;
}

const ScreenShareQualityMenuContent = observer(
	({
		frameRateOptions,
		resolutionOptions,
		hasHigherVideoQuality,
		includeStreamAudio,
		applyScreenShareSettings,
	}: ScreenShareQualityMenuContentProps) => {
		const {t} = useLingui();
		const selectedResolution = VoiceSettingsStore.screenshareResolution;
		const selectedFrameRate = resolveScreenShareFrameRate(VoiceSettingsStore.videoFrameRate);

		const runApplyScreenShareSettings = useCallback(
			(resolution: ScreenShareResolution, frameRate: number, includeAudio: boolean) => {
				void applyScreenShareSettings(resolution, frameRate, includeAudio).catch((error) => {
					logger.error('Failed to apply screen share settings from menu:', error);
				});
			},
			[applyScreenShareSettings],
		);

		const handleFrameRateSelect = useCallback(
			(option: {value: number; isPremium: boolean}) => {
				if (option.isPremium && !hasHigherVideoQuality) {
					PremiumModalActionCreators.open();
					return;
				}
				if (selectedFrameRate === option.value) {
					return;
				}
				VoiceSettingsActionCreators.update({videoFrameRate: option.value});
				runApplyScreenShareSettings(selectedResolution, option.value, includeStreamAudio);
			},
			[hasHigherVideoQuality, includeStreamAudio, runApplyScreenShareSettings, selectedFrameRate, selectedResolution],
		);

		const handleResolutionSelect = useCallback(
			(option: {value: ScreenShareResolution; isPremium: boolean}) => {
				if (option.isPremium && !hasHigherVideoQuality) {
					PremiumModalActionCreators.open();
					return;
				}
				if (selectedResolution === option.value) {
					return;
				}
				VoiceSettingsActionCreators.update({screenshareResolution: option.value});
				runApplyScreenShareSettings(option.value, selectedFrameRate, includeStreamAudio);
			},
			[hasHigherVideoQuality, includeStreamAudio, runApplyScreenShareSettings, selectedFrameRate, selectedResolution],
		);

		return (
			<>
				<MenuGroup>
					<MenuItem disabled>{t`Frame Rate`}</MenuItem>
					{frameRateOptions.map((option) => (
						<MenuItemRadio
							key={option.value}
							selected={selectedFrameRate === option.value}
							onSelect={() => {
								handleFrameRateSelect(option);
							}}
						>
							{option.label}
						</MenuItemRadio>
					))}
				</MenuGroup>
				<MenuGroup>
					<MenuItem disabled>{t`Resolution`}</MenuItem>
					{resolutionOptions.map((option) => (
						<MenuItemRadio
							key={option.value}
							selected={selectedResolution === option.value}
							onSelect={() => {
								handleResolutionSelect(option);
							}}
						>
							{option.label}
						</MenuItemRadio>
					))}
				</MenuGroup>
			</>
		);
	},
);

const LocalParticipantControls = observer(() => {
	const {t} = useLingui();
	const {videoDevices} = useMediaDevices();
	const room = MediaEngineStore.room;
	const localParticipant = room?.localParticipant;
	const participants = MediaEngineStore.participants;
	const localParticipantSnapshot = Object.values(participants).find((p) => p.isLocal);
	const isCameraEnabled = localParticipantSnapshot?.isCameraEnabled ?? false;
	const isScreenShareEnabled = localParticipantSnapshot?.isScreenShareEnabled ?? false;
	const isConnected = !!room && !!localParticipant;
	const supportsStreamAudioCapture = useMemo(() => supportsDesktopScreenShareAudioCapture(), []);
	const includeStreamAudio = supportsStreamAudioCapture && LocalVoiceStateStore.getSelfStreamAudio();
	const screenShareResolutionOptions = useMemo<
		Array<{value: ScreenShareResolution; label: string; isPremium: boolean}>
	>(
		() => [
			{value: 'low', label: t`480p`, isPremium: false},
			{value: 'medium', label: t`720p`, isPremium: false},
			{value: 'high', label: t`1080p`, isPremium: true},
			{value: 'ultra', label: t`1440p`, isPremium: true},
			{value: '4k', label: t`4K`, isPremium: true},
		],
		[t],
	);
	const screenShareFrameRateOptions = useMemo<Array<{value: number; label: string; isPremium: boolean}>>(
		() => [
			{value: 15, label: t`15 FPS`, isPremium: false},
			{value: 24, label: t`24 FPS`, isPremium: false},
			{value: 30, label: t`30 FPS`, isPremium: false},
			{value: 60, label: t`60 FPS`, isPremium: true},
		],
		[t],
	);
	const hasHigherVideoQuality = useMemo(
		() =>
			isLimitToggleEnabled(
				{
					feature_higher_video_quality: LimitResolver.resolve({
						key: 'feature_higher_video_quality',
						fallback: 0,
					}),
				},
				'feature_higher_video_quality',
			),
		[],
	);

	const handleToggleCamera = useCallback(async () => {
		if (!localParticipant) return;

		try {
			if (isCameraEnabled) {
				await MediaEngineStore.setCameraEnabled(false);
			} else {
				ModalActionCreators.push(
					modal(() => (
						<CameraPreviewModalInRoom
							onEnabled={async () => {
								await MediaEngineStore.setCameraEnabled(true, {
									deviceId: VoiceSettingsStore.getVideoDeviceId() || undefined,
								});
							}}
						/>
					)),
				);
			}
		} catch (error) {
			logger.error('Failed to toggle camera:', error);
		}
	}, [isCameraEnabled, localParticipant]);

	const getScreenShareOptions = useCallback((resolution: ScreenShareResolution, frameRate: number) => {
		const preset = SCREEN_SHARE_PRESETS[resolution];
		return {
			captureOptions: {
				audio: true,
				selfBrowserSurface: 'include' as const,
				systemAudio: 'include' as const,
				resolution: {
					...preset.resolution,
					frameRate,
				},
			},
			publishOptions: {
				screenShareEncoding: preset.encoding,
			},
		};
	}, []);

	const applyScreenShareSettings = useCallback(
		async (resolution: ScreenShareResolution, frameRate: number, includeAudio: boolean) => {
			if (!isConnected || !localParticipant || !isScreenShareEnabled) {
				return;
			}

			await executeScreenShareOperation(async () => {
				const includeAudioForRequest = supportsStreamAudioCapture ? includeAudio : false;
				const {captureOptions, publishOptions} = getScreenShareOptions(resolution, frameRate);
				await MediaEngineStore.updateActiveScreenShareSettings(
					{
						...captureOptions,
						audio: includeAudioForRequest,
					},
					publishOptions,
				);
			});
		},
		[getScreenShareOptions, isConnected, isScreenShareEnabled, localParticipant, supportsStreamAudioCapture],
	);

	const openCameraSettingsMenu = useCallback(
		(event: ReactMouseEvent<HTMLElement>) => {
			if (!isConnected) return;

			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<VoiceCameraSettingsMenu videoDevices={videoDevices} onClose={onClose} />
			));
		},
		[isConnected, videoDevices],
	);

	const openScreenShareMenu = useCallback(
		(event: ReactMouseEvent<HTMLElement>) => {
			if (!isConnected || !isScreenShareEnabled) return;

			event.preventDefault();
			event.stopPropagation();

			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<>
					<MenuGroup>
						<MenuItem
							icon={<MonitorPlayIcon weight="fill" className={styles.icon} />}
							danger
							onClick={async () => {
								onClose();
								await MediaEngineStore.setScreenShareEnabled(false);
							}}
						>
							{t`Stop Streaming`}
						</MenuItem>
					</MenuGroup>
					<MenuGroup>
						<MenuItemSubmenu
							label={t`Stream Quality`}
							icon={<CaretRightIcon weight="bold" className={styles.icon} />}
							render={() => (
								<ScreenShareQualityMenuContent
									frameRateOptions={screenShareFrameRateOptions}
									resolutionOptions={screenShareResolutionOptions}
									hasHigherVideoQuality={hasHigherVideoQuality}
									includeStreamAudio={includeStreamAudio}
									applyScreenShareSettings={applyScreenShareSettings}
								/>
							)}
						/>
					</MenuGroup>
					<MenuGroup>
						<CheckboxItem
							checked={includeStreamAudio}
							disabled={!supportsStreamAudioCapture}
							onCheckedChange={async (checked) => {
								if (!supportsStreamAudioCapture) {
									return;
								}
								LocalVoiceStateStore.updateSelfStreamAudio(checked);
								await applyScreenShareSettings(
									VoiceSettingsStore.screenshareResolution,
									resolveScreenShareFrameRate(VoiceSettingsStore.videoFrameRate),
									checked,
								);
							}}
						>
							{t`Share Stream Audio`}
						</CheckboxItem>
					</MenuGroup>
				</>
			));
		},
		[
			applyScreenShareSettings,
			hasHigherVideoQuality,
			includeStreamAudio,
			isConnected,
			isScreenShareEnabled,
			screenShareFrameRateOptions,
			screenShareResolutionOptions,
			supportsStreamAudioCapture,
			t,
		],
	);

	const handleScreenShare = useCallback(async () => {
		if (!localParticipant) return;

		try {
			if (isScreenShareEnabled) {
				return;
			} else {
				ModalActionCreators.push(
					modal(() => (
						<ScreenShareSettingsModal
							onStartShare={async (resolution, frameRate, includeAudio) => {
								await executeScreenShareOperation(async () => {
									const includeAudioForRequest = supportsStreamAudioCapture ? includeAudio : false;
									const {captureOptions, publishOptions} = getScreenShareOptions(resolution, frameRate);
									await MediaEngineStore.setScreenShareEnabled(
										true,
										{
											...captureOptions,
											audio: includeAudioForRequest,
										},
										publishOptions,
									);
								});
							}}
						/>
					)),
				);
			}
		} catch (error) {
			logger.error('Failed to toggle screen share:', error);
		}
	}, [isScreenShareEnabled, localParticipant, getScreenShareOptions, supportsStreamAudioCapture]);

	const cameraLabel = (() => {
		if (!isConnected) return t`Please wait for connection...`;
		if (isCameraEnabled) return t`Turn Off Camera`;
		return t`Turn On Camera`;
	})();

	const screenShareLabel = (() => {
		if (!isConnected) return t`Please wait for connection...`;
		if (isScreenShareEnabled) return t`Stop Sharing`;
		return t`Share Your Screen`;
	})();

	return (
		<>
			<Tooltip text={cameraLabel}>
				<FocusRing offset={-2} enabled={isConnected}>
					<button
						type="button"
						className={clsx(styles.mediaButton, isCameraEnabled && styles.cameraActive)}
						onClick={handleToggleCamera}
						onContextMenu={openCameraSettingsMenu}
						disabled={!isConnected}
						aria-label={cameraLabel}
					>
						{isCameraEnabled ? (
							<CameraIcon weight="fill" className={styles.mediaIcon} />
						) : (
							<CameraSlashIcon weight="fill" className={styles.mediaIcon} />
						)}
					</button>
				</FocusRing>
			</Tooltip>
			<Tooltip text={screenShareLabel}>
				<FocusRing offset={-2} enabled={isConnected}>
					<button
						type="button"
						className={clsx(styles.mediaButton, isScreenShareEnabled && styles.screenShareActive)}
						onClick={(event) => {
							if (isScreenShareEnabled) {
								openScreenShareMenu(event);
								return;
							}
							void handleScreenShare();
						}}
						onContextMenu={openScreenShareMenu}
						disabled={!isConnected}
						aria-label={screenShareLabel}
					>
						<MonitorPlayIcon weight="fill" className={styles.mediaIcon} />
					</button>
				</FocusRing>
			</Tooltip>
		</>
	);
});

const MockedVoiceConnectionStatus = observer(() => {
	const {i18n, t} = useLingui();
	const voiceSettings = VoiceSettingsStore;
	const noiseSuppressionEnabled = voiceSettings.noiseSuppression;
	const showVoiceConnectionId = voiceSettings.showVoiceConnectionId;
	const {openProps: popoutProps} = usePopout('voice-details-popout');
	const latency = 42;
	const averageLatency = 45;

	const generateMockLatencyData = () => {
		const data: Array<{timestamp: number; latency: number}> = [];
		const baseLatency = 45;
		for (let i = 0; i < 30; i++) {
			const variation = Math.sin(i / 3) * 15 + Math.random() * 10 - 5;
			data.push({
				timestamp: Date.now() - (30 - i) * 1000,
				latency: Math.max(20, Math.min(80, baseLatency + variation)),
			});
		}
		return data;
	};

	const chartData = generateMockLatencyData();
	const maxLatency = Math.max(...chartData.map((d) => d.latency), 0) + 10;

	return (
		<div className={styles.voiceConnectionContainer}>
			<div className={styles.statusRow}>
				<Tooltip text={t`Ping: ${latency}ms`}>
					<div className={styles.signalIcon}>
						<SignalStrengthIcon latency={latency} size={16} />
					</div>
				</Tooltip>
				<Popout
					{...popoutProps}
					position="top"
					offsetMainAxis={16}
					render={() => (
						<div className={styles.popoutContainer}>
							<div className={styles.popoutHeader}>
								<span className={styles.popoutTitle}>{t`Voice Connection`}</span>
								<FocusRing offset={-2}>
									<button
										type="button"
										className={styles.popoutCloseButton}
										onClick={() => PopoutActionCreators.close()}
										aria-label={t`Close`}
									>
										<XIcon weight="bold" className={styles.iconSmall} />
									</button>
								</FocusRing>
							</div>

							{chartData.length > 0 && (
								<div className={styles.chartContainer}>
									<svg viewBox="0 0 300 120" className={styles.chartSvg} role="img" aria-label={t`Latency graph`}>
										{Array.from({length: 5}, (_, i) => Math.round((maxLatency / 4) * i)).map((value) => {
											const y = 110 - (value / maxLatency) * 80;
											return (
												<g key={value}>
													<line
														x1={40}
														y1={y}
														x2={290}
														y2={y}
														className={`${styles.gridLine} ${styles.gridLineHorizontal} ${styles.textBackgroundModifierHover}`}
													/>
													<text x={35} y={y} className={styles.gridText}>
														{value}ms
													</text>
												</g>
											);
										})}

										<line
											x1={40}
											y1={100}
											x2={290}
											y2={100}
											className={`${styles.gridLine} ${styles.textBackgroundModifierHover}`}
										/>

										<line
											x1={40}
											y1={20}
											x2={40}
											y2={100}
											className={`${styles.gridLine} ${styles.textBackgroundModifierHover}`}
										/>

										<path
											d={(() => {
												if (chartData.length === 0) return '';
												const points = chartData.map((point, index) => {
													const x = 40 + (index / Math.max(chartData.length - 1, 1)) * 250;
													const y = 110 - (point.latency / maxLatency) * 80;
													return `${x},${y}`;
												});
												return `M ${points.join(' L ')}`;
											})()}
											className={`${styles.chartLine} ${styles.textGreen}`}
										/>

										{chartData.map((point, index) => {
											const x = 40 + (index / Math.max(chartData.length - 1, 1)) * 250;
											const y = 110 - (point.latency / maxLatency) * 80;
											return (
												<circle
													key={point.timestamp}
													cx={x}
													cy={y}
													r="2"
													className={`${styles.chartPoint} ${styles.textGreen}`}
												/>
											);
										})}
									</svg>
								</div>
							)}

							<div className={styles.popoutStats}>
								<div className={styles.popoutStatRow}>
									<span className={styles.popoutStatLabel}>{t`Device:`}</span>
									<Tooltip text="mock-device-1">
										<div className={styles.deviceBadge}>
											<DesktopIcon weight="regular" className={styles.deviceIcon} />
											<span className={styles.deviceBadgeText}>mock-device-1</span>
										</div>
									</Tooltip>
								</div>
								<div className={styles.popoutStatRow}>
									<span className={styles.popoutStatLabel}>{t`Current ping:`}</span>
									<span className={styles.popoutStatValue}>{latency}ms</span>
								</div>
								<div className={styles.popoutStatRow}>
									<span className={styles.popoutStatLabel}>{t`Average ping:`}</span>
									<span className={styles.popoutStatValue}>{averageLatency}ms</span>
								</div>
								<div className={styles.popoutStatRow}>
									<span className={styles.popoutStatLabel}>{t`Endpoint:`}</span>
									<Tooltip text="mock.voice.server:443">
										<FocusRing offset={-2}>
											<div
												className={styles.endpointBadge}
												role="button"
												tabIndex={0}
												aria-label={t`Copy endpoint`}
												onClick={async (e) => {
													e.stopPropagation();
													await TextCopyActionCreators.copy(i18n, 'mock.voice.server:443');
												}}
												onKeyDown={async (e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														await TextCopyActionCreators.copy(i18n, 'mock.voice.server:443');
													}
												}}
											>
												<LockSimpleIcon weight="fill" className={styles.lockIcon} />
												<span className={styles.endpointBadgeText}>mock.voice.server:443</span>
											</div>
										</FocusRing>
									</Tooltip>
								</div>
							</div>
						</div>
					)}
				>
					<FocusRingWrapper focusRingOffset={-2}>
						<button type="button" className={clsx(styles.statusButton, styles.statusConnected)}>
							{t`Voice Connected`}
						</button>
					</FocusRingWrapper>
				</Popout>
				<div className={styles.controls}>
					<Tooltip text={noiseSuppressionEnabled ? t`Disable Noise Suppression` : t`Enable Noise Suppression`}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={clsx(styles.controlButton, noiseSuppressionEnabled && styles.selected)}
								onClick={() => VoiceSettingsActionCreators.update({noiseSuppression: !noiseSuppressionEnabled})}
								aria-label={noiseSuppressionEnabled ? t`Disable Noise Suppression` : t`Enable Noise Suppression`}
							>
								<WaveformIcon weight="fill" className={styles.icon} />
							</button>
						</FocusRing>
					</Tooltip>
					<Tooltip text={t`Disconnect`}>
						<FocusRing offset={-2}>
							<button
								type="button"
								className={styles.controlButton}
								onClick={() => {
									DeveloperOptionsActionCreators.updateOption('forceShowVoiceConnection', false);
								}}
								aria-label={t`Disconnect`}
							>
								<PhoneXIcon weight="fill" className={styles.icon} />
							</button>
						</FocusRing>
					</Tooltip>
				</div>
			</div>

			<div className={styles.connectionInfo}>
				<div className={styles.channelSourceRow}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.channelSourceLink}>
							<span className={styles.channelSourceText}>
								<span className={styles.channelSourceChannel}>general</span>
								<span className={styles.channelSourceSeparator}> / </span>
								<span className={styles.channelSourceGuild}>Mock Guild</span>
							</span>
						</button>
					</FocusRing>
				</div>
				{showVoiceConnectionId && (
					<div className={styles.connectionIdRow}>
						<DesktopIcon weight="regular" className={styles.connectionIdIcon} />
						<div className={styles.connectionIdValue}>
							<Tooltip text="mock-connection-1" position="top" align="center">
								<span className={styles.connectionIdValueText}>mock-connection-1</span>
							</Tooltip>
						</div>
					</div>
				)}
			</div>

			<div className={styles.mediaSection}>
				<Tooltip text={t`Turn On Camera`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.mediaButton} aria-label={t`Turn On Camera`}>
							<CameraSlashIcon weight="fill" className={styles.mediaIcon} />
						</button>
					</FocusRing>
				</Tooltip>
				<Tooltip text={t`Share Your Screen`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.mediaButton} aria-label={t`Share Your Screen`}>
							<MonitorPlayIcon weight="fill" className={styles.mediaIcon} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>
		</div>
	);
});

export const VoiceConnectionStatus = observer(() => {
	const storeConnectedChannelId = MediaEngineStore.channelId;
	const mobileLayout = MobileLayoutStore;
	const forceShowVoiceConnection = DeveloperOptionsStore.forceShowVoiceConnection;

	if (mobileLayout.enabled) {
		return null;
	}

	const connectedChannelId = storeConnectedChannelId;

	if (!connectedChannelId) {
		if (!forceShowVoiceConnection) {
			return null;
		}
		return <MockedVoiceConnectionStatus />;
	}

	return <VoiceConnectionStatusInner />;
});
