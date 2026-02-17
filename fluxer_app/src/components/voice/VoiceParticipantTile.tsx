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
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import {VoiceParticipantBottomSheet} from '@app/components/bottomsheets/VoiceParticipantBottomSheet';
import {LongPressable} from '@app/components/LongPressable';
import {Avatar} from '@app/components/uikit/Avatar';
import {Button} from '@app/components/uikit/button/Button';
import {VoiceParticipantContextMenu} from '@app/components/uikit/context_menu/VoiceParticipantContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {LiveBadge} from '@app/components/uikit/LiveBadge';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {FeedHiddenOverlay} from '@app/components/voice/FeedHiddenOverlay';
import {getPlaceholderAvatarColor} from '@app/components/voice/GetPlaceholderAvatarColor';
import {
	getOwnStreamHiddenState,
	useOwnScreenSharePreviewState,
	useWindowFocus,
} from '@app/components/voice/OwnStreamPreviewState';
import {StreamInfoPill} from '@app/components/voice/StreamInfoPill';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import {StreamWatchHoverCard} from '@app/components/voice/StreamWatchHoverCard';
import {useStreamPreview} from '@app/components/voice/useStreamPreview';
import {useStreamSpectators} from '@app/components/voice/useStreamSpectators';
import {useStreamTrackInfo} from '@app/components/voice/useStreamTrackInfo';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import voiceCallStyles from '@app/components/voice/VoiceCallView.module.css';
import {
	isVoiceParticipantActuallySpeaking,
	parseVoiceParticipantIdentity,
} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import styles from '@app/components/voice/VoiceParticipantTile.module.css';
import {Endpoints} from '@app/Endpoints';
import HttpClient from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import CallMediaPrefsStore from '@app/stores/CallMediaPrefsStore';
import ContextMenuStore from '@app/stores/ContextMenuStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import ParticipantVolumeStore from '@app/stores/ParticipantVolumeStore';
import PermissionStore from '@app/stores/PermissionStore';
import PrivacyPreferencesStore from '@app/stores/PrivacyPreferencesStore';
import StreamAudioPrefsStore from '@app/stores/StreamAudioPrefsStore';
import UserStore from '@app/stores/UserStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {dimColor} from '@app/utils/ColorUtils';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {canViewStreamPreview} from '@app/utils/StreamPreviewPermissionUtils';
import {voiceVolumePercentToTrackVolume} from '@app/utils/VoiceVolumeUtils';
import {DEFAULT_ACCENT_COLOR} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	STREAM_AUDIO_PREFS_TOUCH_INTERVAL_MS,
	STREAM_PREVIEW_CONTENT_TYPE_JPEG,
	STREAM_PREVIEW_DIMENSION_SCALE_STEP,
	STREAM_PREVIEW_ENCODE_ATTEMPTS,
	STREAM_PREVIEW_INITIAL_UPLOAD_INTERVAL_MS,
	STREAM_PREVIEW_INITIAL_UPLOAD_MAX_ATTEMPTS,
	STREAM_PREVIEW_JPEG_DATA_URL_PREFIX,
	STREAM_PREVIEW_JPEG_QUALITY_MIN,
	STREAM_PREVIEW_JPEG_QUALITY_START,
	STREAM_PREVIEW_JPEG_QUALITY_STEP,
	STREAM_PREVIEW_MAX_BYTES,
	STREAM_PREVIEW_MAX_DIMENSION_PX,
	STREAM_PREVIEW_MIN_DIMENSION_PX,
	STREAM_PREVIEW_UPLOAD_INTERVAL_MS,
	STREAM_PREVIEW_UPLOAD_JITTER_MS,
} from '@fluxer/constants/src/StreamConstants';
import {useLingui} from '@lingui/react/macro';
import {
	isTrackReference,
	TrackRefContext,
	type TrackReferenceOrPlaceholder,
	useIsSpeaking,
	useParticipantTile,
	VideoTrack,
} from '@livekit/components-react';
import {
	DesktopIcon,
	DeviceMobileIcon,
	DotsThreeIcon,
	EyeIcon,
	MicrophoneSlashIcon,
	MonitorPlayIcon,
	PauseIcon,
	PlusIcon,
	SpeakerHighIcon,
	SpeakerSlashIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {type Participant, ParticipantEvent, type RemoteTrackPublication, Track} from 'livekit-client';
import {autorun} from 'mobx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('VoiceParticipantTile');

function estimateBase64Bytes(base64: string): number {
	return Math.floor((base64.length * 3) / 4);
}

function getScaledDimensions(width: number, height: number, maxDimension: number): {width: number; height: number} {
	if (width <= maxDimension && height <= maxDimension) {
		return {width, height};
	}

	const scale = maxDimension / Math.max(width, height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

function drawPreviewCanvas(
	source: CanvasImageSource,
	width: number,
	height: number,
	maxDimension: number,
): HTMLCanvasElement | null {
	const {width: targetWidth, height: targetHeight} = getScaledDimensions(width, height, maxDimension);
	const canvas = document.createElement('canvas');
	canvas.width = targetWidth;
	canvas.height = targetHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
	return canvas;
}

function encodePreviewBase64(canvas: HTMLCanvasElement, quality: number): string {
	const dataUrl = canvas.toDataURL(STREAM_PREVIEW_CONTENT_TYPE_JPEG, quality);
	return dataUrl.replace(STREAM_PREVIEW_JPEG_DATA_URL_PREFIX, '');
}

async function buildPreviewBase64FromSource(
	source: CanvasImageSource,
	width: number,
	height: number,
): Promise<string | null> {
	let quality = STREAM_PREVIEW_JPEG_QUALITY_START;
	let maxDimension = STREAM_PREVIEW_MAX_DIMENSION_PX;

	for (let attempt = 0; attempt < STREAM_PREVIEW_ENCODE_ATTEMPTS; attempt += 1) {
		const canvas = drawPreviewCanvas(source, width, height, maxDimension);
		if (!canvas) return null;

		const base64 = encodePreviewBase64(canvas, quality);
		if (estimateBase64Bytes(base64) <= STREAM_PREVIEW_MAX_BYTES) {
			return base64;
		}

		if (quality > STREAM_PREVIEW_JPEG_QUALITY_MIN) {
			quality = Math.max(STREAM_PREVIEW_JPEG_QUALITY_MIN, quality - STREAM_PREVIEW_JPEG_QUALITY_STEP);
		} else if (maxDimension > STREAM_PREVIEW_MIN_DIMENSION_PX) {
			maxDimension = Math.max(
				STREAM_PREVIEW_MIN_DIMENSION_PX,
				Math.round(maxDimension * STREAM_PREVIEW_DIMENSION_SCALE_STEP),
			);
		}
	}

	return null;
}

async function buildPreviewBase64FromVideo(videoEl: HTMLVideoElement): Promise<string | null> {
	if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return null;
	return buildPreviewBase64FromSource(videoEl, videoEl.videoWidth, videoEl.videoHeight);
}

async function buildPreviewBase64FromDataUrl(dataUrl: string): Promise<string | null> {
	const image = new Image();
	image.decoding = 'async';
	image.src = dataUrl;

	try {
		await image.decode();
	} catch {
		return null;
	}

	const width = image.naturalWidth || image.width;
	const height = image.naturalHeight || image.height;
	if (!width || !height) return null;
	return buildPreviewBase64FromSource(image, width, height);
}

interface VoiceParticipantTileProps {
	trackRef?: TrackReferenceOrPlaceholder;
	guildId?: string;
	channelId?: string;
	onClick?: (participantIdentity: string) => void;
	isPinned?: boolean;
	showFocusIndicator?: boolean;
	allowAutoSubscribe?: boolean;
	renderFocusedPlaceholder?: boolean;
}

interface VoiceParticipantTileInnerProps {
	trackRef: TrackReferenceOrPlaceholder;
	elementProps: React.HTMLAttributes<HTMLElement>;
	guildId?: string;
	channelId?: string;
	onClick?: (participantIdentity: string) => void;
	isPinned?: boolean;
	showFocusIndicator?: boolean;
	allowAutoSubscribe: boolean;
	renderFocusedPlaceholder: boolean;
}

function isCameraSource(source: Track.Source | undefined) {
	return source === Track.Source.Camera;
}

function isAudioTrackWithVolume(track: unknown): track is {kind: string; setVolume: (volume: number) => void} {
	return (
		track != null &&
		typeof track === 'object' &&
		'kind' in track &&
		(track as {kind: string}).kind === Track.Kind.Audio &&
		'setVolume' in track
	);
}

function getSourceDataAttr(source: Track.Source | undefined) {
	switch (source) {
		case Track.Source.ScreenShare:
			return 'screen_share';
		case Track.Source.Camera:
			return 'camera';
		default:
			return 'other';
	}
}

function useEffectiveTrackRef(explicit?: TrackReferenceOrPlaceholder) {
	const ctx = useContext(TrackRefContext as React.Context<TrackReferenceOrPlaceholder | undefined>);
	return (explicit ?? ctx) as TrackReferenceOrPlaceholder | undefined;
}

function useIntersection<T extends Element>(enabled: boolean) {
	const ref = useRef<T | null>(null);
	const [isIntersecting, setIsIntersecting] = useState(false);

	useEffect(() => {
		if (typeof IntersectionObserver === 'undefined') return;
		if (!enabled) return;

		const el = ref.current;
		if (!el) return;

		const observer = new IntersectionObserver((entries) => setIsIntersecting(entries.some((e) => e.isIntersecting)), {
			threshold: [0, 0.1],
		});

		observer.observe(el);
		return () => observer.disconnect();
	}, [enabled]);

	return {ref, isIntersecting};
}

function useTileContextMenuActive(tileElRef: React.RefObject<HTMLElement | null>) {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const disposer = autorun(() => {
			const cm = ContextMenuStore.contextMenu;
			const target = cm?.target?.target;
			const el = tileElRef.current;
			setOpen(Boolean(cm && target instanceof Node && el && el.contains(target)));
		});
		return () => disposer();
	}, [tileElRef]);

	return open;
}

function resolveAvatarSize(width: number, height: number, min: number, max: number): number {
	const base = Math.min(width, height);
	const raw = Math.max(min, Math.min(base * 0.32, max));
	return Math.round(raw / 2) * 2;
}

function useAvatarSize(tileElRef: React.RefObject<HTMLElement | null>, min = 80, max = 192) {
	const [avatarSize, setAvatarSize] = useState(min);

	useLayoutEffect(() => {
		if (typeof ResizeObserver === 'undefined') return;

		const el = tileElRef.current;
		if (!el) return;

		const computeFromDimensions = (width: number, height: number) => {
			const next = resolveAvatarSize(width, height, min, max);
			setAvatarSize((prev) => (prev !== next ? next : prev));
		};

		const computeFromRect = () => {
			const rect = el.getBoundingClientRect();
			computeFromDimensions(rect.width, rect.height);
		};

		computeFromRect();
		const ro = new ResizeObserver((entries) => {
			const first = entries[0];
			if (!first) return;
			const {width, height} = first.contentRect;
			computeFromDimensions(width, height);
		});
		ro.observe(el);
		return () => {
			ro.disconnect();
		};
	}, [tileElRef, min, max]);

	return avatarSize;
}

function useAutoVideoSubscription(opts: {
	enabled: boolean;
	trackRef: TrackReferenceOrPlaceholder;
	isIntersecting: boolean;
	videoLocallyDisabled: boolean;
	isLocalParticipant: boolean;
	isScreenShare: boolean;
}) {
	const {enabled, trackRef, isIntersecting, videoLocallyDisabled, isLocalParticipant, isScreenShare} = opts;
	const lastRequestedRef = useRef<{trackSid: string | null; desired: boolean | null}>({trackSid: null, desired: null});

	useEffect(() => {
		if (!enabled || isLocalParticipant || isScreenShare) {
			lastRequestedRef.current = {trackSid: null, desired: null};
			return;
		}
		if (!isTrackReference(trackRef)) {
			lastRequestedRef.current = {trackSid: null, desired: null};
			return;
		}

		const pub = trackRef.publication as RemoteTrackPublication | undefined;
		if (!pub || typeof pub.setSubscribed !== 'function') return;

		const shouldSubscribe = !videoLocallyDisabled;
		const trackSid = pub.trackSid ?? null;

		if (lastRequestedRef.current.trackSid !== trackSid) {
			lastRequestedRef.current = {trackSid, desired: null};
		}

		if (pub.isSubscribed === shouldSubscribe) {
			lastRequestedRef.current.desired = shouldSubscribe;
			return;
		}

		if (lastRequestedRef.current.desired === shouldSubscribe) return;

		try {
			lastRequestedRef.current.desired = shouldSubscribe;
			pub.setSubscribed(shouldSubscribe);
		} catch (err) {
			logger.error('setSubscribed failed', err);
		}
	}, [enabled, trackRef, isIntersecting, videoLocallyDisabled, isLocalParticipant, isScreenShare]);
}

interface ScreenShareAudioPublicationState {
	publication: RemoteTrackPublication | null;
	hasTrack: boolean;
}

function useScreenShareAudioPublication(participant: Participant, enabled: boolean): ScreenShareAudioPublicationState {
	const [publication, setPublication] = useState<RemoteTrackPublication | null>(null);
	const [hasTrack, setHasTrack] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setPublication(null);
			setHasTrack(false);
			return;
		}

		const update = () => {
			const next = participant.getTrackPublication(Track.Source.ScreenShareAudio) as RemoteTrackPublication | undefined;
			logger.debug('Resolved screen share audio publication', {
				participantIdentity: participant.identity,
				trackSid: next?.trackSid ?? null,
				hasTrack: Boolean(next?.track),
				isSubscribed: next?.isSubscribed ?? null,
			});
			setPublication((previousPublication) => {
				const nextPublication = next ?? null;
				return previousPublication === nextPublication ? previousPublication : nextPublication;
			});
			setHasTrack(Boolean(next?.track));
		};

		update();

		participant.on(ParticipantEvent.TrackPublished, update);
		participant.on(ParticipantEvent.TrackUnpublished, update);
		participant.on(ParticipantEvent.TrackSubscribed, update);
		participant.on(ParticipantEvent.TrackUnsubscribed, update);
		participant.on(ParticipantEvent.TrackMuted, update);
		participant.on(ParticipantEvent.TrackUnmuted, update);

		return () => {
			participant.off(ParticipantEvent.TrackPublished, update);
			participant.off(ParticipantEvent.TrackUnpublished, update);
			participant.off(ParticipantEvent.TrackSubscribed, update);
			participant.off(ParticipantEvent.TrackUnsubscribed, update);
			participant.off(ParticipantEvent.TrackMuted, update);
			participant.off(ParticipantEvent.TrackUnmuted, update);
		};
	}, [participant, enabled]);

	return {publication, hasTrack};
}

function useScreenshareWatchSubscription(opts: {
	isScreenShare: boolean;
	trackRef: TrackReferenceOrPlaceholder;
	userWantsToWatch: boolean;
	videoLocallyDisabled: boolean;
	isWindowFocused: boolean;
	isOwnScreenShare: boolean;
	audioPublication?: RemoteTrackPublication | null;
}) {
	const {
		isScreenShare,
		trackRef,
		userWantsToWatch,
		videoLocallyDisabled,
		isWindowFocused,
		isOwnScreenShare,
		audioPublication,
	} = opts;

	const publication = useMemo(() => {
		if (!isTrackReference(trackRef)) return undefined;
		return trackRef.publication as RemoteTrackPublication | undefined;
	}, [trackRef]);

	const publicationTrackSid = publication?.trackSid ?? null;
	const previousPublicationRef = useRef<RemoteTrackPublication | null>(null);
	const previousTrackSidRef = useRef<string | null>(null);
	const audioTrackSid = audioPublication?.trackSid ?? null;
	const previousAudioPublicationRef = useRef<RemoteTrackPublication | null>(null);
	const previousAudioTrackSidRef = useRef<string | null>(null);

	useEffect(() => {
		if (!isScreenShare) return;
		const pub = publication;
		if (!pub || typeof pub.setSubscribed !== 'function' || typeof pub.setEnabled !== 'function') {
			const previousPublication = previousPublicationRef.current;
			if (previousPublication?.isSubscribed) {
				try {
					previousPublication.setSubscribed(false);
				} catch (err) {
					logger.error('setSubscribed(false) failed for previous publication', err);
				}
			}
			previousPublicationRef.current = null;
			previousTrackSidRef.current = null;
			return;
		}

		const shouldSubscribe = userWantsToWatch && !videoLocallyDisabled;

		if (previousTrackSidRef.current && previousTrackSidRef.current !== publicationTrackSid) {
			const previousPublication = previousPublicationRef.current;
			if (previousPublication?.isSubscribed) {
				try {
					previousPublication.setSubscribed(false);
				} catch (err) {
					logger.error('setSubscribed(false) failed for previous publication', err);
				}
			}
		}

		previousPublicationRef.current = pub;
		previousTrackSidRef.current = publicationTrackSid;

		if (shouldSubscribe) {
			if (!pub.isSubscribed) {
				try {
					pub.setSubscribed(true);
				} catch (err) {
					logger.error('setSubscribed(true) failed', err);
				}
			}

			if (isOwnScreenShare) {
				try {
					pub.setEnabled(isWindowFocused);
				} catch (err) {
					logger.error('setEnabled failed', err);
				}
			}
		} else {
			if (pub.isSubscribed) {
				try {
					pub.setSubscribed(false);
				} catch (err) {
					logger.error('setSubscribed(false) failed', err);
				}
			}
		}
	}, [
		isScreenShare,
		publication,
		publicationTrackSid,
		userWantsToWatch,
		videoLocallyDisabled,
		isWindowFocused,
		isOwnScreenShare,
	]);

	useEffect(() => {
		if (!isScreenShare) return;
		const pub = audioPublication;
		if (!pub || typeof pub.setSubscribed !== 'function') {
			const previousPublication = previousAudioPublicationRef.current;
			if (previousPublication?.isSubscribed) {
				try {
					previousPublication.setSubscribed(false);
				} catch (err) {
					logger.error('setSubscribed(false) failed for previous audio publication', err);
				}
			}
			previousAudioPublicationRef.current = null;
			previousAudioTrackSidRef.current = null;
			return;
		}

		const shouldSubscribe = userWantsToWatch;
		logger.debug('Evaluating screen share audio subscription', {
			participantIdentity: trackRef.participant?.identity,
			trackSid: audioTrackSid,
			shouldSubscribe,
			isSubscribed: pub.isSubscribed,
			hasTrack: Boolean(pub.track),
		});

		if (previousAudioTrackSidRef.current && previousAudioTrackSidRef.current !== audioTrackSid) {
			const previousPublication = previousAudioPublicationRef.current;
			if (previousPublication?.isSubscribed) {
				try {
					previousPublication.setSubscribed(false);
				} catch (err) {
					logger.error('setSubscribed(false) failed for previous audio publication', err);
				}
			}
		}

		previousAudioPublicationRef.current = pub;
		previousAudioTrackSidRef.current = audioTrackSid;

		if (shouldSubscribe) {
			if (!pub.isSubscribed) {
				try {
					pub.setSubscribed(true);
				} catch (err) {
					logger.error('setSubscribed(true) failed for audio publication', err);
				}
			}
			if (typeof pub.setEnabled === 'function') {
				try {
					pub.setEnabled(true);
				} catch (err) {
					logger.error('setEnabled(true) failed for audio publication', err);
				}
			}
		} else if (pub.isSubscribed) {
			try {
				pub.setSubscribed(false);
			} catch (err) {
				logger.error('setSubscribed(false) failed for audio publication', err);
			}
		}
	}, [isScreenShare, audioPublication, audioTrackSid, userWantsToWatch]);
}

function useScreensharePreviewUploader(
	isOwnScreenShare: boolean,
	streamKey: string,
	channelId: string | undefined,
	videoRef: React.RefObject<HTMLVideoElement | null>,
	fallbackDataUrl: string | null,
) {
	const uploadInFlightRef = useRef(false);
	const initialUploadAttemptsRef = useRef(0);
	const hasUploadedPreviewRef = useRef(false);

	useEffect(() => {
		logger.debug('useScreensharePreviewUploader effect', {isOwnScreenShare, streamKey, channelId});
		if (!isOwnScreenShare || !channelId) return;

		initialUploadAttemptsRef.current = 0;
		hasUploadedPreviewRef.current = false;

		logger.debug('useScreensharePreviewUploader: starting upload schedule', {streamKey, channelId});

		const uploadPreview = async (): Promise<boolean> => {
			if (uploadInFlightRef.current) return false;

			if (PrivacyPreferencesStore.getDisableStreamPreviews()) {
				logger.debug('useScreensharePreviewUploader: stream previews disabled by user preference');
				return false;
			}

			uploadInFlightRef.current = true;

			try {
				if (!hasUploadedPreviewRef.current) {
					initialUploadAttemptsRef.current += 1;
				}

				const videoEl = videoRef.current;
				const base64Data =
					(videoEl ? await buildPreviewBase64FromVideo(videoEl) : null) ||
					(fallbackDataUrl ? await buildPreviewBase64FromDataUrl(fallbackDataUrl) : null);
				if (!base64Data) {
					logger.debug('useScreensharePreviewUploader: no preview payload', {streamKey});
					return false;
				}

				logger.debug('useScreensharePreviewUploader: uploading', {streamKey, dataLength: base64Data.length});

				const response = await HttpClient.post({
					url: Endpoints.STREAM_PREVIEW(streamKey),
					body: {
						channel_id: channelId,
						thumbnail: base64Data,
						content_type: STREAM_PREVIEW_CONTENT_TYPE_JPEG,
					},
				});

				logger.debug('useScreensharePreviewUploader: upload result', {ok: response.ok, status: response.status});
				if (response.ok) {
					hasUploadedPreviewRef.current = true;
				}
				return response.ok;
			} catch (err) {
				logger.error('Failed to upload screenshare preview', err);
				return false;
			} finally {
				uploadInFlightRef.current = false;
			}
		};

		let timeoutId: number | null = null;
		const scheduleNextUpload = () => {
			const shouldFastRetry =
				!hasUploadedPreviewRef.current && initialUploadAttemptsRef.current < STREAM_PREVIEW_INITIAL_UPLOAD_MAX_ATTEMPTS;
			const jitter = shouldFastRetry ? 0 : Math.round((Math.random() * 2 - 1) * STREAM_PREVIEW_UPLOAD_JITTER_MS);
			const delay =
				(shouldFastRetry ? STREAM_PREVIEW_INITIAL_UPLOAD_INTERVAL_MS : STREAM_PREVIEW_UPLOAD_INTERVAL_MS) + jitter;
			timeoutId = window.setTimeout(() => {
				void uploadPreview().finally(() => scheduleNextUpload());
			}, delay);
		};

		scheduleNextUpload();
		void uploadPreview();

		return () => {
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
			}
		};
	}, [isOwnScreenShare, streamKey, channelId, videoRef, fallbackDataUrl]);
}

export const VoiceParticipantTile = observer((props: VoiceParticipantTileProps) => {
	const {
		trackRef,
		guildId,
		channelId,
		onClick,
		isPinned,
		showFocusIndicator,
		allowAutoSubscribe = true,
		renderFocusedPlaceholder = false,
	} = props;

	const effectiveTrackRef = useEffectiveTrackRef(trackRef);
	const {elementProps} = useParticipantTile({
		trackRef: effectiveTrackRef ?? undefined,
		htmlProps: {},
	});

	if (!effectiveTrackRef) return null;

	return (
		<VoiceParticipantTileInner
			trackRef={effectiveTrackRef}
			elementProps={elementProps}
			guildId={guildId}
			channelId={channelId}
			onClick={onClick}
			isPinned={isPinned}
			showFocusIndicator={showFocusIndicator}
			allowAutoSubscribe={allowAutoSubscribe}
			renderFocusedPlaceholder={renderFocusedPlaceholder}
		/>
	);
});

const VoiceParticipantTileInner = observer(function VoiceParticipantTileInner({
	trackRef,
	elementProps,
	guildId,
	channelId,
	onClick,
	isPinned,
	showFocusIndicator,
	allowAutoSubscribe,
	renderFocusedPlaceholder,
}: VoiceParticipantTileInnerProps) {
	const {t} = useLingui();
	const participant = trackRef.participant;
	const identity = participant.identity;
	const {userId, connectionId} = useMemo(() => parseVoiceParticipantIdentity(identity), [identity]);

	const participantUser = UserStore.getUser(userId);
	const currentUser = UserStore.getCurrentUser();
	const isCurrentUser = currentUser?.id === participantUser?.id;

	const isSpeaking = useIsSpeaking(participant);

	const voiceState = MediaEngineStore.getVoiceStateByConnectionId(connectionId);
	const connectionParticipant = MediaEngineStore.getParticipantByUserIdAndConnectionId(userId, connectionId);

	const isSelfMuted =
		voiceState?.self_mute ?? (connectionParticipant ? !connectionParticipant.isMicrophoneEnabled : false);
	const isSelfDeafened = voiceState?.self_deaf ?? false;
	const isActuallySpeaking = isVoiceParticipantActuallySpeaking({
		isSpeaking,
		voiceState,
		isMicrophoneEnabled: participant.isMicrophoneEnabled,
	});

	const isMobileExperience = isMobileExperienceEnabled();
	const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

	const isLocalParticipant = Boolean((participant as Participant)?.isLocal);
	const isWindowFocused = useWindowFocus();
	const pauseOwnScreenSharePreviewOnUnfocus = VoiceSettingsStore.pauseOwnScreenSharePreviewOnUnfocus;

	const sourceAttr = getSourceDataAttr(trackRef.source);
	const isScreenShare = trackRef.source === Track.Source.ScreenShare;
	const isFocusedPlaceholderTile = renderFocusedPlaceholder;
	const isInteractiveScreenShareTile = isScreenShare && !isFocusedPlaceholderTile;
	const isOwnScreenShare = isScreenShare && isLocalParticipant;
	const isOwnContent = isLocalParticipant && isCurrentUser;
	const {isOwnScreenShareHidden, isOwnCameraHidden} = getOwnStreamHiddenState({
		isOwnContent,
		isScreenShare,
		showMyOwnCamera: VoiceSettingsStore.showMyOwnCamera,
		showMyOwnScreenShare: VoiceSettingsStore.showMyOwnScreenShare,
	});

	const callId = MediaEngineStore.connectionId ?? '';
	const streamKey = useMemo(() => getStreamKey(guildId, channelId, connectionId), [guildId, channelId, connectionId]);
	const {viewerUsers} = useStreamSpectators(isScreenShare ? streamKey : '');

	const cameraLocallyDisabled =
		callId !== '' &&
		isTrackReference(trackRef) &&
		isCameraSource(trackRef.source) &&
		CallMediaPrefsStore.isVideoDisabled(callId, identity);

	const publication = isTrackReference(trackRef)
		? (trackRef.publication as RemoteTrackPublication | undefined)
		: undefined;
	const {publication: screenShareAudioPublication, hasTrack: hasScreenShareAudioTrack} = useScreenShareAudioPublication(
		participant,
		isScreenShare,
	);
	const hasScreenShareAudio = Boolean(screenShareAudioPublication);

	const hasVideo = useMemo(() => {
		if (!isTrackReference(trackRef)) return false;
		const pub = trackRef.publication;
		return Boolean(pub?.track) && !pub?.isMuted && !cameraLocallyDisabled;
	}, [trackRef, cameraLocallyDisabled]);

	const streamVolume = StreamAudioPrefsStore.getVolume(streamKey);
	const isStreamMuted = StreamAudioPrefsStore.isMuted(streamKey);
	const isParticipantLocallyMuted = ParticipantVolumeStore.isLocalMuted(userId);
	const isLocalSelfDeafened = LocalVoiceStateStore.getSelfDeaf();
	const hasStreamAudioPrefsEntry = StreamAudioPrefsStore.hasEntry(streamKey);

	const isSubscribed = Boolean(publication?.isSubscribed);

	const shouldAutoSubscribe = allowAutoSubscribe && !isFocusedPlaceholderTile;
	const {ref: tileRef, isIntersecting} = useIntersection<HTMLDivElement>(shouldAutoSubscribe);
	useAutoVideoSubscription({
		enabled: shouldAutoSubscribe,
		trackRef,
		isIntersecting,
		videoLocallyDisabled: cameraLocallyDisabled,
		isLocalParticipant,
		isScreenShare,
	});

	const {
		isWatching,
		startWatching,
		addStream,
		stopWatching: stopWatchingStream,
	} = useStreamWatchState({
		streamKey,
		guildId,
		channelId,
	});

	const stopWatching = useCallback(() => {
		if (publication?.setSubscribed) {
			try {
				publication.setSubscribed(false);
			} catch (err) {
				logger.error('setSubscribed(false) failed', err);
			}
		}
		stopWatchingStream();
	}, [publication, stopWatchingStream]);

	useScreenshareWatchSubscription({
		isScreenShare: isInteractiveScreenShareTile,
		trackRef,
		userWantsToWatch: isWatching,
		videoLocallyDisabled: false,
		isWindowFocused: pauseOwnScreenSharePreviewOnUnfocus ? isWindowFocused : true,
		isOwnScreenShare,
		audioPublication: screenShareAudioPublication,
	});

	useEffect(() => {
		if (!isScreenShare || isOwnScreenShare || isFocusedPlaceholderTile) return;
		if (!isWatching) return;
		const pub = screenShareAudioPublication;
		if (!pub) return;

		const track = pub.track;
		if (isAudioTrackWithVolume(track)) {
			try {
				track.setVolume(voiceVolumePercentToTrackVolume(streamVolume));
			} catch (err) {
				logger.error('setVolume failed for stream audio', err);
			}
		}

		const shouldEnable = !isStreamMuted && !isParticipantLocallyMuted && !isLocalSelfDeafened;
		if (typeof pub.setEnabled === 'function') {
			try {
				logger.debug('Applying runtime screen share audio enabled state', {
					trackSid: pub.trackSid,
					isWatching,
					isStreamMuted,
					isParticipantLocallyMuted,
					isLocalSelfDeafened,
					shouldEnable,
				});
				pub.setEnabled(shouldEnable);
			} catch (err) {
				logger.error('setEnabled failed for stream audio', err);
			}
		}
		MediaEngineStore.applyLocalAudioPreferencesForUser(userId);
	}, [
		hasScreenShareAudioTrack,
		isScreenShare,
		isOwnScreenShare,
		isFocusedPlaceholderTile,
		isWatching,
		screenShareAudioPublication,
		streamVolume,
		isStreamMuted,
		isParticipantLocallyMuted,
		isLocalSelfDeafened,
		userId,
	]);

	useEffect(() => {
		if (!isScreenShare || isOwnScreenShare || isFocusedPlaceholderTile) return;
		if (!hasScreenShareAudio || !hasStreamAudioPrefsEntry) return;

		StreamAudioPrefsStore.touchStream(streamKey);
		const intervalId = window.setInterval(() => {
			StreamAudioPrefsStore.touchStream(streamKey);
		}, STREAM_AUDIO_PREFS_TOUCH_INTERVAL_MS);
		return () => {
			window.clearInterval(intervalId);
		};
	}, [
		isScreenShare,
		isOwnScreenShare,
		isFocusedPlaceholderTile,
		hasScreenShareAudio,
		hasStreamAudioPrefsEntry,
		streamKey,
	]);

	const [previewPopoverOpen, setPreviewPopoverOpen] = useState(false);
	const canFetchStreamPreview = canViewStreamPreview({
		guildId,
		channelId,
		hasConnectPermission: () =>
			PermissionStore.can(Permissions.CONNECT, {guildId: guildId ?? undefined, channelId: channelId ?? undefined}),
	});
	const previewEnabled =
		isTrackReference(trackRef) &&
		isScreenShare &&
		!isOwnScreenShare &&
		!isSubscribed &&
		!isFocusedPlaceholderTile &&
		canFetchStreamPreview;

	const {previewUrl, isPreviewLoading} = useStreamPreview(previewEnabled, streamKey);
	const trackInfo = useStreamTrackInfo(isScreenShare ? trackRef : null);

	const isStreamPlaceholder = isScreenShare && !isTrackReference(trackRef);
	const showStreamEnded = isStreamPlaceholder && isWatching && !isFocusedPlaceholderTile;

	const avatarSize = useAvatarSize(tileRef);
	const placeholderColor = useMemo(
		() => getPlaceholderAvatarColor(participantUser, DEFAULT_ACCENT_COLOR),
		[participantUser],
	);

	const placeholderBackgroundColor = useMemo(() => dimColor(placeholderColor), [placeholderColor]);

	const placeholderStyle = useMemo<React.CSSProperties>(
		() => ({backgroundColor: placeholderBackgroundColor}),
		[placeholderBackgroundColor],
	);

	const focusedCameraPlaceholderStyle = useMemo<React.CSSProperties>(
		() => ({...placeholderStyle, opacity: 1}),
		[placeholderStyle],
	);
	const screenSharePlaceholderStyle = useMemo<React.CSSProperties>(
		() => ({backgroundColor: placeholderBackgroundColor, opacity: 1}),
		[placeholderBackgroundColor],
	);

	const renderScreenSharePlaceholder = useCallback(
		(showLiveBadge: boolean) => (
			<>
				<div style={screenSharePlaceholderStyle} className={styles.focusedPlaceholderScreenSurface}>
					{participantUser && (
						<div className={clsx(styles.avatarRing, styles.focusedPlaceholderAvatarDimmed)}>
							<Avatar user={participantUser} size={avatarSize} className={styles.avatarFlexShrink} guildId={guildId} />
						</div>
					)}
				</div>
				<div className={styles.focusedPlaceholderCameraOverlay} />
				<div className={styles.focusedPlaceholderIconLayer}>
					<MonitorPlayIcon weight="fill" className={styles.focusedPlaceholderIcon} />
				</div>
				{showLiveBadge && (
					<div className={styles.focusedPlaceholderLiveBadge}>
						<LiveBadge showTooltip={false} />
					</div>
				)}
			</>
		),
		[avatarSize, guildId, participantUser, screenSharePlaceholderStyle],
	);

	const tileContextMenuOpen = useTileContextMenuActive(tileRef);

	const hasMultipleConnections = useMemo(() => {
		if (!guildId || !isCurrentUser) return false;

		const allStates = MediaEngineStore.getAllVoiceStates();
		let count = 0;

		Object.entries(allStates).forEach(([g, guildData]) => {
			if (g !== guildId) return;
			Object.values(guildData).forEach((channelData) => {
				Object.values(channelData).forEach((vs) => {
					if (vs.user_id === participantUser?.id) count += 1;
				});
			});
		});

		return count > 1;
	}, [guildId, participantUser?.id, isCurrentUser]);

	const participantDisplayName = useMemo(() => {
		return (
			(participantUser ? NicknameUtils.getNickname(participantUser, guildId, channelId) : participant.name) ||
			participantUser?.username ||
			'User'
		);
	}, [participantUser, guildId, channelId, participant.name]);

	const showStreamAudioControls = isScreenShare && !isOwnScreenShare && !isCurrentUser && hasScreenShareAudio;
	const streamAudioTooltip = isStreamMuted ? t`Unmute stream audio` : t`Mute stream audio`;
	const viewerStreamCount = LocalVoiceStateStore.getViewerStreamKeys().length;
	const addStreamTooltipText =
		viewerStreamCount === 1
			? t`Keep watching 1 stream and add this one`
			: t`Keep watching ${viewerStreamCount} streams and add this one`;

	const handleContextMenu = useCallback(
		(event: React.MouseEvent | MouseEvent) => {
			if (!participantUser) return;

			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<VoiceParticipantContextMenu
					user={participantUser}
					participantName={participantDisplayName}
					onClose={onClose}
					guildId={guildId}
					connectionId={connectionId}
					isGroupedItem={hasMultipleConnections && isCurrentUser}
					streamKey={streamKey}
					isScreenShare={isScreenShare}
					isWatching={isWatching}
					hasScreenShareAudio={hasScreenShareAudio}
					isOwnScreenShare={isOwnScreenShare}
					onStopWatching={stopWatching}
				/>
			));
		},
		[
			participantUser,
			participantDisplayName,
			guildId,
			connectionId,
			hasMultipleConnections,
			isCurrentUser,
			streamKey,
			isScreenShare,
			isWatching,
			hasScreenShareAudio,
			isOwnScreenShare,
			stopWatching,
		],
	);

	const pinnedParticipantSource = VoiceCallLayoutStore.pinnedParticipantSource;
	const isFocusedOnThisTile =
		VoiceCallLayoutStore.pinnedParticipantIdentity === identity &&
		(pinnedParticipantSource == null || pinnedParticipantSource === trackRef.source);

	const handleTileClick = useCallback(() => {
		const wasFocused =
			VoiceCallLayoutStore.pinnedParticipantIdentity === identity &&
			(pinnedParticipantSource == null || pinnedParticipantSource === trackRef.source);
		if (wasFocused) {
			VoiceCallLayoutActionCreators.setPinnedParticipant(null);
		} else {
			VoiceCallLayoutActionCreators.setPinnedParticipant(identity, trackRef.source);
			onClick?.(identity);
		}
		VoiceCallLayoutActionCreators.markUserOverride();
	}, [identity, onClick, pinnedParticipantSource, trackRef.source]);

	const handleTileKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			switch (event.key) {
				case 'Enter':
				case ' ':
					event.preventDefault();
					event.stopPropagation();
					handleTileClick();
					break;
				default:
					break;
			}
		},
		[handleTileClick],
	);

	const handleMenuButtonKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			switch (event.key) {
				case 'Enter':
				case ' ': {
					event.preventDefault();
					event.stopPropagation();
					const node = event.currentTarget as HTMLElement | null;
					if (!node) return;

					const rect = node.getBoundingClientRect();
					const x = rect.left + rect.width / 2 + (window.scrollX || window.pageXOffset);
					const y = rect.top + rect.height / 2 + (window.scrollY || window.pageYOffset);
					const syntheticEvent = new MouseEvent('contextmenu', {
						clientX: rect.left + rect.width / 2,
						clientY: rect.top + rect.height / 2,
						screenX: x,
						screenY: y,
						bubbles: true,
						cancelable: true,
					});
					handleContextMenu(syntheticEvent);
					break;
				}
				default:
					break;
			}
		},
		[handleContextMenu],
	);

	const handleStreamAudioToggle = useCallback(
		(event?: React.SyntheticEvent) => {
			event?.stopPropagation();
			StreamAudioPrefsStore.setMuted(streamKey, !isStreamMuted);
			MediaEngineStore.applyLocalAudioPreferencesForUser(userId);
		},
		[streamKey, isStreamMuted, userId],
	);

	const handleStreamAudioKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			switch (event.key) {
				case 'Enter':
				case ' ':
					event.preventDefault();
					event.stopPropagation();
					handleStreamAudioToggle();
					break;
				default:
					break;
			}
		},
		[handleStreamAudioToggle],
	);

	const handleWatch = useCallback(
		(e?: React.SyntheticEvent) => {
			e?.stopPropagation();
			startWatching();
			VoiceCallLayoutActionCreators.setPinnedParticipant(identity, Track.Source.ScreenShare);
		},
		[identity, startWatching],
	);

	const handleAddStream = useCallback(
		(event: React.SyntheticEvent) => {
			event.stopPropagation();
			addStream();
		},
		[addStream],
	);

	const handleRevealHiddenFeed = useCallback(
		(e: React.SyntheticEvent) => {
			e.stopPropagation();
			if (isOwnScreenShareHidden) {
				VoiceSettingsActionCreators.update({showMyOwnScreenShare: true});
			} else if (isOwnCameraHidden) {
				VoiceSettingsActionCreators.update({showMyOwnCamera: true});
			}
		},
		[isOwnScreenShareHidden, isOwnCameraHidden],
	);

	const handleMouseEnter = useCallback(() => {
		if (!previewEnabled) return;
		setPreviewPopoverOpen(true);
	}, [previewEnabled]);

	const handleMouseLeave = useCallback(() => setPreviewPopoverOpen(false), []);

	const videoRef = useRef<HTMLVideoElement | null>(null);

	const {frozenFrameUrl, isOwnStreamPreviewPaused, shouldHideOwnScreenShareVideo} = useOwnScreenSharePreviewState({
		isOwnScreenShare,
		pausePreviewOnUnfocus: pauseOwnScreenSharePreviewOnUnfocus,
		isWindowFocused,
		videoRef,
	});
	const hasVisibleMediaTile =
		!isFocusedPlaceholderTile && isTrackReference(trackRef) && hasVideo && !shouldHideOwnScreenShareVideo;
	const isAvatarOnlyTile = !hasVisibleMediaTile && !isScreenShare;
	const shouldShowTileSpeakingIndicator =
		!isFocusedPlaceholderTile && isActuallySpeaking && !isScreenShare && !isAvatarOnlyTile;

	useScreensharePreviewUploader(
		isOwnScreenShare && !isFocusedPlaceholderTile,
		streamKey,
		channelId,
		videoRef,
		frozenFrameUrl,
	);

	const mediaNode = useMemo(() => {
		if (isFocusedPlaceholderTile) {
			if (isScreenShare) {
				return renderScreenSharePlaceholder(true);
			}

			return (
				<>
					<div style={focusedCameraPlaceholderStyle} className={voiceCallStyles.lkParticipantPlaceholder}>
						{participantUser && (
							<div className={clsx(styles.avatarRing, styles.focusedPlaceholderAvatarDimmed)}>
								<Avatar
									user={participantUser}
									size={avatarSize}
									className={styles.avatarFlexShrink}
									guildId={guildId}
								/>
							</div>
						)}
					</div>
					<div className={styles.focusedPlaceholderCameraOverlay} />
					<div className={styles.focusedPlaceholderIconLayer}>
						<VideoCameraIcon weight="fill" className={styles.focusedPlaceholderIcon} />
					</div>
				</>
			);
		}

		if (isTrackReference(trackRef) && hasVideo && !shouldHideOwnScreenShareVideo) {
			return <VideoTrack ref={videoRef} trackRef={trackRef} manageSubscription={false} />;
		}

		if (shouldHideOwnScreenShareVideo && frozenFrameUrl) {
			return <img src={frozenFrameUrl} alt="" className={styles.frozenFrame} />;
		}

		if (isScreenShare && !isOwnScreenShare) {
			if (previewUrl) {
				return <img src={previewUrl} alt="" className={styles.screensharePreviewBackground} />;
			}
			return renderScreenSharePlaceholder(false);
		}

		if (isScreenShare) {
			return renderScreenSharePlaceholder(false);
		}

		return (
			<div style={placeholderStyle} className={voiceCallStyles.lkParticipantPlaceholder}>
				{participantUser && (
					<div className={isActuallySpeaking ? styles.avatarRingSpeaking : styles.avatarRing}>
						<Avatar user={participantUser} size={avatarSize} className={styles.avatarFlexShrink} guildId={guildId} />
					</div>
				)}
			</div>
		);
	}, [
		avatarSize,
		focusedCameraPlaceholderStyle,
		frozenFrameUrl,
		guildId,
		hasVideo,
		isActuallySpeaking,
		isFocusedPlaceholderTile,
		isOwnScreenShare,
		isScreenShare,
		participantUser,
		placeholderStyle,
		previewUrl,
		renderScreenSharePlaceholder,
		trackRef,
		shouldHideOwnScreenShareVideo,
	]);

	return (
		<>
			<FocusRing offset={-2}>
				<LongPressable
					ref={tileRef as React.Ref<HTMLDivElement>}
					{...elementProps}
					className={clsx(
						voiceCallStyles.lkParticipantTile,
						elementProps.className,
						isPinned && voiceCallStyles.pinnedParticipant,
						styles.cursorPointer,
						tileContextMenuOpen && voiceCallStyles.tileContextMenuActive,
					)}
					data-speaking={shouldShowTileSpeakingIndicator}
					data-video-muted={isFocusedPlaceholderTile || !hasVideo || (shouldHideOwnScreenShareVideo && !frozenFrameUrl)}
					data-source={sourceAttr}
					onContextMenu={handleContextMenu}
					onClick={handleTileClick}
					onKeyDown={handleTileKeyDown}
					onLongPress={() => {
						if (isMobileExperience && participantUser) setBottomSheetOpen(true);
					}}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					role="button"
					tabIndex={0}
				>
					{mediaNode}

					{isScreenShare &&
						isTrackReference(trackRef) &&
						!isWatching &&
						!cameraLocallyDisabled &&
						!isOwnScreenShare &&
						!isFocusedPlaceholderTile && (
							<div className={styles.watchStreamOverlay}>
								<div className={styles.watchStreamButtons}>
									<Button
										variant="secondary"
										fitContent
										leftIcon={<MonitorPlayIcon size={18} weight="fill" />}
										onClick={handleWatch}
										className={styles.watchStreamButton}
									>
										{t`Watch Stream`}
									</Button>
									{viewerStreamCount > 0 && (
										<Tooltip text={addStreamTooltipText}>
											<Button
												variant="secondary"
												fitContent
												leftIcon={<PlusIcon weight="bold" size={18} />}
												onClick={handleAddStream}
												className={styles.watchStreamButton}
											>
												{t`Add Stream`}
											</Button>
										</Tooltip>
									)}
								</div>
								<div className={styles.liveBadgeContainer}>
									{trackInfo ? (
										<StreamInfoPill info={trackInfo} tone="voice_tile" showLiveBadge />
									) : (
										<LiveBadge showTooltip={false} />
									)}
								</div>
							</div>
						)}

					{showStreamEnded && (
						<div className={styles.streamEndedOverlay}>
							<div className={styles.streamEndedContent}>
								<span className={styles.streamEndedTitle}>{t`Stream ended`}</span>
								<Button
									variant="secondary"
									compact
									fitContent
									onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
										event.stopPropagation();
										stopWatching();
									}}
									className={styles.streamEndedButton}
								>
									{t`Stop watching`}
								</Button>
							</div>
						</div>
					)}

					{isOwnScreenShareHidden && !isFocusedPlaceholderTile && (
						<FeedHiddenOverlay
							message={t`This stream has been hidden.`}
							buttonLabel={t`Watch Stream`}
							onReveal={handleRevealHiddenFeed}
						/>
					)}

					{isOwnCameraHidden && !isFocusedPlaceholderTile && (
						<FeedHiddenOverlay
							message={t`This feed has been hidden.`}
							buttonLabel={t`Show Camera`}
							onReveal={handleRevealHiddenFeed}
						/>
					)}

					{isOwnScreenShare &&
						!isOwnScreenShareHidden &&
						!isFocusedPlaceholderTile &&
						(isOwnStreamPreviewPaused || !isFocusedOnThisTile) && (
							<div className={clsx(styles.selfStreamOverlay, isOwnStreamPreviewPaused && styles.paused)}>
								{isOwnStreamPreviewPaused ? (
									<div className={styles.selfStreamPreviewPaused}>
										<PauseIcon weight="fill" className={styles.pausedIcon} />
										<span className={styles.pausedText}>{t`Preview paused to save resources`}</span>
										<span className={styles.pausedSubtext}>{t`Your stream is still being broadcast`}</span>
									</div>
								) : (
									<div className={styles.selfStreamPreviewActive}>
										{trackInfo ? (
											<StreamInfoPill info={trackInfo} tone="voice_tile" showLiveBadge />
										) : (
											<LiveBadge showTooltip={false} />
										)}
									</div>
								)}
							</div>
						)}

					{isScreenShare && previewEnabled && previewPopoverOpen && !isOwnScreenShare && !isFocusedPlaceholderTile && (
						<div className={styles.previewPopover}>
							<StreamWatchHoverCard
								variant="compact"
								previewUrl={previewUrl}
								isPreviewLoading={isPreviewLoading}
								watchLabel={t`Watch`}
								watchDisabled={false}
								onWatch={handleWatch}
							/>
						</div>
					)}

					{cameraLocallyDisabled && !isOwnCameraHidden && !isFocusedPlaceholderTile && (
						<div className={styles.videoDisabledOverlay}>
							<VideoCameraSlashIcon weight="fill" className={styles.videoDisabledIcon} />
						</div>
					)}

					{showFocusIndicator && isFocusedOnThisTile && !isFocusedPlaceholderTile && (
						<div className={styles.focusOverlay}>
							<EyeIcon weight="fill" className={styles.focusOverlayIcon} />
						</div>
					)}

					{isScreenShare && viewerUsers.length > 0 && !isFocusedPlaceholderTile && (
						<Tooltip text={t`${viewerUsers.length} watching`} position="top">
							<div className={styles.spectatorBadge}>
								<EyeIcon weight="fill" className={styles.spectatorIcon} />
								<span>{viewerUsers.length}</span>
							</div>
						</Tooltip>
					)}

					<div className={voiceCallStyles.lkParticipantMetadata}>
						<div className={voiceCallStyles.lkParticipantMetadataItem}>
							<div className={voiceCallStyles.lkParticipantIcons}>
								{((voiceState?.mute ?? false) || isSelfMuted) && (
									<Tooltip text={voiceState?.mute ? t`Community Muted` : t`Muted`} position="top">
										<MicrophoneSlashIcon
											weight="fill"
											className={voiceState?.mute ? styles.participantIconRed : styles.participantIconMuted}
										/>
									</Tooltip>
								)}

								{((voiceState?.deaf ?? false) || isSelfDeafened) && (
									<Tooltip text={voiceState?.deaf ? t`Community Deafened` : t`Deafened`} position="top">
										<SpeakerSlashIcon
											weight="fill"
											className={voiceState?.deaf ? styles.participantIconRed : styles.participantIconMuted}
										/>
									</Tooltip>
								)}

								<Tooltip text={voiceState?.is_mobile ? t`Mobile Device` : t`Desktop Device`} position="top">
									{voiceState?.is_mobile ? (
										<DeviceMobileIcon weight="regular" className={styles.participantIconWhite} />
									) : (
										<DesktopIcon weight="regular" className={styles.participantIconWhite} />
									)}
								</Tooltip>
							</div>

							<div className={voiceCallStyles.participantMetadataLabel}>
								<Tooltip text={participantDisplayName as string} position="top">
									<span className={clsx(styles.participantNameText, voiceCallStyles.participantName)}>
										{participantDisplayName}
									</span>
								</Tooltip>

								{connectionId && (
									<Tooltip text={t`Connection: ${connectionId}`} position="top">
										<span className={clsx(styles.participantConnectionText, voiceCallStyles.participantConn)}>
											({connectionId})
										</span>
									</Tooltip>
								)}
							</div>
						</div>

						{!isLocalParticipant && (
							<div
								className={clsx(
									voiceCallStyles.lkParticipantMetadataItem,
									voiceCallStyles.lkParticipantMetadataControls,
									styles.controlGroup,
								)}
							>
								{showStreamAudioControls && (
									<Tooltip text={streamAudioTooltip} position="top">
										<FocusRing offset={-2}>
											<div
												role="button"
												tabIndex={0}
												className={clsx(styles.streamAudioButton, isStreamMuted && styles.streamAudioButtonMuted)}
												onClick={handleStreamAudioToggle}
												onKeyDown={handleStreamAudioKeyDown}
											>
												{isStreamMuted ? (
													<SpeakerSlashIcon weight="fill" className={styles.streamAudioIcon} />
												) : (
													<SpeakerHighIcon weight="fill" className={styles.streamAudioIcon} />
												)}
											</div>
										</FocusRing>
									</Tooltip>
								)}
								<FocusRing offset={-2}>
									<div
										role="button"
										tabIndex={0}
										className={styles.menuButton}
										onClick={(e) => {
											e.stopPropagation();
											handleContextMenu(e);
										}}
										onKeyDown={handleMenuButtonKeyDown}
									>
										<DotsThreeIcon weight="bold" className={styles.menuButtonIcon} />
									</div>
								</FocusRing>
							</div>
						)}
					</div>
				</LongPressable>
			</FocusRing>

			{isMobileExperience && participantUser && (
				<VoiceParticipantBottomSheet
					isOpen={bottomSheetOpen}
					onClose={() => setBottomSheetOpen(false)}
					user={participantUser}
					participant={connectionParticipant}
					guildId={guildId}
					connectionId={connectionId}
					isConnectionItem
					streamKey={streamKey}
					isScreenShare={isScreenShare}
					isWatching={isWatching}
					hasScreenShareAudio={hasScreenShareAudio}
					isOwnScreenShare={isOwnScreenShare}
					onStopWatching={stopWatching}
				/>
			)}
		</>
	);
});
