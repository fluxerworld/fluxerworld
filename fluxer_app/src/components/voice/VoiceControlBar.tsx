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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import {
	VoiceAudioSettingsBottomSheet,
	VoiceCameraSettingsBottomSheet,
	VoiceMoreOptionsBottomSheet,
} from '@app/components/bottomsheets/VoiceSettingsBottomSheets';
import {CameraPreviewModalInRoom} from '@app/components/modals/CameraPreviewModal';
import {ScreenShareSettingsModal} from '@app/components/modals/ScreenShareSettingsModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {TooltipWithKeybind} from '@app/components/uikit/keybind_hint/KeybindHint';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import styles from '@app/components/voice/VoiceControlBar.module.css';
import {parseVoiceParticipantIdentity} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import {VoiceCameraSettingsMenu, VoiceMoreOptionsMenu} from '@app/components/voice/VoiceSettingsMenus';
import {useAudioSettingsMenu} from '@app/hooks/useAudioSettingsMenu';
import {useMediaDevices} from '@app/hooks/useMediaDevices';
import {Logger} from '@app/lib/Logger';
import KeybindStore from '@app/stores/KeybindStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {formatKeyCombo} from '@app/utils/KeybindUtils';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {supportsDesktopScreenShareAudioCapture} from '@app/utils/NativeUtils';
import {executeScreenShareOperation} from '@app/utils/ScreenShareUtils';
import {SoundType} from '@app/utils/SoundUtils';
import {VOICE_CHANNEL_CAMERA_USER_LIMIT} from '@fluxer/constants/src/LimitConstants';
import {useLingui} from '@lingui/react/macro';
import {useLocalParticipant} from '@livekit/components-react';
import {
	CameraIcon,
	CameraSlashIcon,
	CaretDownIcon,
	CaretRightIcon,
	DotsThreeIcon,
	EyeSlashIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MonitorPlayIcon,
	PhoneXIcon,
	SpeakerHighIcon,
	SpeakerSlashIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {ScreenSharePresets, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('VoiceControlBar');

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

const VoiceControlBarInner = observer(function VoiceControlBarInner() {
	const {t} = useLingui();
	const {localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled} = useLocalParticipant();

	const voiceState = MediaEngineStore.getCurrentUserVoiceState();
	const localSelfMute = LocalVoiceStateStore.selfMute;
	const localSelfDeaf = LocalVoiceStateStore.selfDeaf;

	const voiceSettings = VoiceSettingsStore;
	const isMobile = MobileLayoutStore.isMobileLayout();

	const {inputDevices, outputDevices, videoDevices} = useMediaDevices();

	const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
	const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
	const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

	const isMuted = voiceState ? voiceState.self_mute : localSelfMute;
	const isDeafened = voiceState ? voiceState.self_deaf : localSelfDeaf;
	const isGuildMuted = voiceState?.mute ?? false;
	const isGuildDeafened = voiceState?.deaf ?? false;

	const muteReason = MediaEngineStore.getMuteReason(voiceState);
	const effectiveMuted = muteReason !== null || isMuted;

	const isPushToTalkEffective = KeybindStore.isPushToTalkEffective();
	const pushToTalkCombo = KeybindStore.getByAction('push_to_talk').combo;
	const pushToTalkHint = isPushToTalkEffective ? formatKeyCombo(pushToTalkCombo) : '';
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

	const {renderAudioSettingsMenu, handleAudioSettingsContextMenu} = useAudioSettingsMenu({
		inputDevices,
		outputDevices,
		isMobile,
		onOpenMobile: () => setAudioSettingsOpen(true),
	});

	useEffect(() => {
		if (!localParticipant) return;

		const switchMicrophone = async () => {
			if (isMicrophoneEnabled && voiceSettings.inputDeviceId) {
				try {
					await localParticipant.setMicrophoneEnabled(true, {
						deviceId: voiceSettings.inputDeviceId,
						echoCancellation: voiceSettings.echoCancellation,
						noiseSuppression: voiceSettings.noiseSuppression,
						autoGainControl: voiceSettings.autoGainControl,
					});
				} catch (error) {
					logger.error('Failed to switch microphone:', error);
				}
			}
		};

		const switchCamera = async () => {
			if (isCameraEnabled && voiceSettings.videoDeviceId) {
				try {
					await localParticipant.setCameraEnabled(true, {
						deviceId: voiceSettings.videoDeviceId,
					});
				} catch (error) {
					logger.error('Failed to switch camera:', error);
				}
			}
		};

		switchMicrophone();
		switchCamera();
	}, [
		voiceSettings.inputDeviceId,
		voiceSettings.videoDeviceId,
		voiceSettings.echoCancellation,
		voiceSettings.noiseSuppression,
		voiceSettings.autoGainControl,
		localParticipant,
		isMicrophoneEnabled,
		isCameraEnabled,
	]);

	const handleToggleMute = useCallback(() => {
		VoiceStateActionCreators.toggleSelfMute(null);
	}, []);

	const handleToggleDeafen = useCallback(() => {
		VoiceStateActionCreators.toggleSelfDeaf(null);
	}, []);

	const handleToggleVideo = useCallback(async () => {
		if (!localParticipant) return;

		try {
			if (isCameraEnabled) {
				await MediaEngineStore.setCameraEnabled(false);
			} else {
				const voiceStates = MediaEngineStore.getAllVoiceStatesInChannel(
					MediaEngineStore.guildId ?? '',
					MediaEngineStore.channelId ?? '',
				);
				const participantCount = Object.keys(voiceStates).length;
				if (participantCount > VOICE_CHANNEL_CAMERA_USER_LIMIT) {
					return;
				}

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
	}, [localParticipant, isCameraEnabled]);

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
			if (!localParticipant || !isScreenShareEnabled) {
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
		[getScreenShareOptions, isScreenShareEnabled, localParticipant, supportsStreamAudioCapture],
	);

	const openScreenShareMenu = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (!localParticipant || !isScreenShareEnabled) return;

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
			isScreenShareEnabled,
			localParticipant,
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
	}, [localParticipant, isScreenShareEnabled, getScreenShareOptions, supportsStreamAudioCapture]);

	const handleDisconnect = useCallback(async () => {
		try {
			await MediaEngineStore.disconnectFromVoiceChannel('user');
		} catch (error) {
			logger.error('Failed to disconnect from voice channel', error);
		}
	}, []);

	const viewerStreamKeys = LocalVoiceStateStore.viewerStreamKeys;
	const focusedScreenShareStreamKey = useMemo(() => {
		if (VoiceCallLayoutStore.pinnedParticipantSource !== Track.Source.ScreenShare) return null;
		const identity = VoiceCallLayoutStore.pinnedParticipantIdentity;
		const channelId = MediaEngineStore.channelId;
		if (!identity || !channelId) return null;
		const parsedIdentity = parseVoiceParticipantIdentity(identity);
		if (!parsedIdentity.connectionId) return null;
		return getStreamKey(MediaEngineStore.guildId, channelId, parsedIdentity.connectionId);
	}, [
		MediaEngineStore.channelId,
		MediaEngineStore.guildId,
		VoiceCallLayoutStore.pinnedParticipantIdentity,
		VoiceCallLayoutStore.pinnedParticipantSource,
	]);
	const isFocusedStreamOnLocalDevice = useMemo(() => {
		if (VoiceCallLayoutStore.pinnedParticipantSource !== Track.Source.ScreenShare) return false;
		const identity = VoiceCallLayoutStore.pinnedParticipantIdentity;
		if (!identity) return false;
		const parsedIdentity = parseVoiceParticipantIdentity(identity);
		if (!parsedIdentity.connectionId) return false;
		return parsedIdentity.connectionId === MediaEngineStore.connectionId;
	}, [
		MediaEngineStore.connectionId,
		VoiceCallLayoutStore.pinnedParticipantIdentity,
		VoiceCallLayoutStore.pinnedParticipantSource,
	]);
	const canStopWatchingFocusedStream =
		focusedScreenShareStreamKey != null &&
		viewerStreamKeys.includes(focusedScreenShareStreamKey) &&
		!isFocusedStreamOnLocalDevice;

	const handleStopWatching = useCallback(() => {
		if (!focusedScreenShareStreamKey) return;
		const nextViewerStreamKeys = viewerStreamKeys.filter((key) => key !== focusedScreenShareStreamKey);
		if (nextViewerStreamKeys.length === viewerStreamKeys.length) return;
		LocalVoiceStateStore.updateViewerStreamKeys(nextViewerStreamKeys);
		MediaEngineStore.syncLocalVoiceStateWithServer({viewer_stream_keys: nextViewerStreamKeys});
		VoiceCallLayoutActionCreators.setPinnedParticipant(null);
		SoundActionCreators.playSound(SoundType.ViewerLeave);
	}, [focusedScreenShareStreamKey, viewerStreamKeys]);

	const handleAudioSettingsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setAudioSettingsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, renderAudioSettingsMenu);
			}
		},
		[isMobile, renderAudioSettingsMenu],
	);

	const handleCameraSettingsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setCameraSettingsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
					<VoiceCameraSettingsMenu videoDevices={videoDevices} onClose={onClose} />
				));
			}
		},
		[videoDevices, isMobile],
	);

	const handleMoreOptionsClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (isMobile) {
				setMoreOptionsOpen(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => <VoiceMoreOptionsMenu onClose={onClose} />);
			}
		},
		[isMobile],
	);

	const isCameraLimitReached = useMemo(() => {
		if (isCameraEnabled) return false;
		const voiceStates = MediaEngineStore.getAllVoiceStatesInChannel(
			MediaEngineStore.guildId ?? '',
			MediaEngineStore.channelId ?? '',
		);
		return Object.keys(voiceStates).length > VOICE_CHANNEL_CAMERA_USER_LIMIT;
	}, [isCameraEnabled]);

	const getMuteTooltipLabel = useCallback(() => {
		if (isGuildMuted) return t`Community Muted`;

		switch (muteReason) {
			case 'push_to_talk':
				return t`Push-to-talk enabled — hold ${pushToTalkHint} to speak`;
			default:
				return effectiveMuted ? t`Unmute` : t`Mute`;
		}
	}, [effectiveMuted, isGuildMuted, muteReason, pushToTalkHint, t]);

	const getDeafenTooltipLabel = useCallback(() => {
		if (isGuildDeafened) return t`Community Deafened`;

		switch (isDeafened) {
			case true:
				return t`Undeafen`;
			default:
				return t`Deafen`;
		}
	}, [isDeafened, isGuildDeafened, t]);

	return (
		<div className={styles.container}>
			<div className={styles.buttonContainer}>
				<Tooltip
					text={() => (
						<TooltipWithKeybind label={getMuteTooltipLabel()} action={isGuildMuted ? undefined : 'toggle_mute'} />
					)}
				>
					<FocusRing offset={-2}>
						<div>
							<button
								type="button"
								className={clsx(
									styles.button,
									effectiveMuted || isGuildMuted ? styles.buttonMuted : styles.buttonUnmuted,
									isGuildMuted && 'disabled',
								)}
								onClick={isGuildMuted ? undefined : handleToggleMute}
								onContextMenu={handleAudioSettingsContextMenu}
								disabled={isGuildMuted}
							>
								{effectiveMuted || isGuildMuted ? (
									<MicrophoneSlashIcon weight="fill" className={styles.icon} />
								) : (
									<MicrophoneIcon weight="fill" className={styles.icon} />
								)}
							</button>
						</div>
					</FocusRing>
				</Tooltip>

				<Tooltip text={t`Audio Settings`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.settingsButton} onClick={handleAudioSettingsClick}>
							<CaretDownIcon weight="bold" className={styles.iconSmall} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>

			<Tooltip
				text={() => (
					<TooltipWithKeybind label={getDeafenTooltipLabel()} action={isGuildDeafened ? undefined : 'toggle_deafen'} />
				)}
			>
				<FocusRing offset={-2}>
					<div>
						<button
							type="button"
							className={clsx(
								styles.button,
								isDeafened || isGuildDeafened ? styles.buttonDeafened : styles.buttonUnmuted,
								isGuildDeafened && 'disabled',
							)}
							onClick={isGuildDeafened ? undefined : handleToggleDeafen}
							onContextMenu={handleAudioSettingsContextMenu}
							disabled={isGuildDeafened}
						>
							{isDeafened || isGuildDeafened ? (
								<SpeakerSlashIcon weight="fill" className={styles.icon} />
							) : (
								<SpeakerHighIcon weight="fill" className={styles.icon} />
							)}
						</button>
					</div>
				</FocusRing>
			</Tooltip>

			<div className={styles.buttonContainer}>
				<Tooltip
					text={
						isCameraLimitReached
							? t`Cameras are disabled when there are more than ${VOICE_CHANNEL_CAMERA_USER_LIMIT} participants`
							: isCameraEnabled
								? t`Turn Off Camera`
								: t`Turn On Camera`
					}
				>
					<FocusRing offset={-2}>
						<button
							type="button"
							className={clsx(styles.button, isCameraEnabled ? styles.buttonCameraOn : styles.buttonCameraOff)}
							onClick={isCameraLimitReached ? undefined : handleToggleVideo}
							disabled={isCameraLimitReached}
						>
							{isCameraEnabled ? (
								<CameraIcon weight="fill" className={styles.icon} />
							) : (
								<CameraSlashIcon weight="fill" className={styles.icon} />
							)}
						</button>
					</FocusRing>
				</Tooltip>

				<Tooltip text={t`Camera Settings`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.settingsButton} onClick={handleCameraSettingsClick}>
							<CaretDownIcon weight="bold" className={styles.iconSmall} />
						</button>
					</FocusRing>
				</Tooltip>
			</div>

			<Tooltip text={isScreenShareEnabled ? t`Stop Sharing` : t`Share Your Screen`}>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(
							styles.button,
							isScreenShareEnabled ? styles.buttonScreenShareOn : styles.buttonScreenShareOff,
						)}
						onClick={(event) => {
							if (isScreenShareEnabled) {
								openScreenShareMenu(event);
								return;
							}
							void handleScreenShare();
						}}
						onContextMenu={openScreenShareMenu}
					>
						<MonitorPlayIcon weight="fill" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			<Tooltip text={t`More Options`}>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(styles.button, styles.buttonMoreOptions)}
						onClick={handleMoreOptionsClick}
					>
						<DotsThreeIcon weight="bold" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			<Tooltip text={t`Disconnect`}>
				<FocusRing offset={-2}>
					<button type="button" className={clsx(styles.button, styles.buttonDisconnect)} onClick={handleDisconnect}>
						<PhoneXIcon weight="fill" className={styles.icon} />
					</button>
				</FocusRing>
			</Tooltip>

			{canStopWatchingFocusedStream && (
				<Tooltip text={t`Stop watching the current stream`}>
					<FocusRing offset={-2}>
						<button type="button" className={styles.stopWatchingButton} onClick={handleStopWatching}>
							<EyeSlashIcon weight="fill" className={styles.icon} />
							{t`Stop Watching`}
						</button>
					</FocusRing>
				</Tooltip>
			)}

			{isMobile && (
				<>
					<VoiceAudioSettingsBottomSheet isOpen={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} />
					<VoiceCameraSettingsBottomSheet isOpen={cameraSettingsOpen} onClose={() => setCameraSettingsOpen(false)} />
					<VoiceMoreOptionsBottomSheet isOpen={moreOptionsOpen} onClose={() => setMoreOptionsOpen(false)} />
				</>
			)}
		</div>
	);
});

export const VoiceControlBar = observer(() => {
	const room = MediaEngineStore.room;
	if (!room) return null;
	return <VoiceControlBarInner />;
});
