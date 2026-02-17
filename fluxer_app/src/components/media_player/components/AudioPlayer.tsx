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

import styles from '@app/components/media_player/AudioPlayer.module.css';
import {MediaPlaybackRate} from '@app/components/media_player/components/MediaPlaybackRate';
import {MediaProgressBar} from '@app/components/media_player/components/MediaProgressBar';
import {MediaVolumeControl} from '@app/components/media_player/components/MediaVolumeControl';
import {useMediaPlayer} from '@app/components/media_player/hooks/useMediaPlayer';
import {useMediaProgress} from '@app/components/media_player/hooks/useMediaProgress';
import {AUDIO_PLAYBACK_RATES, DEFAULT_SEEK_AMOUNT} from '@app/components/media_player/utils/MediaConstants';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import AudioVolumeStore from '@app/stores/AudioVolumeStore';
import {formatDuration} from '@fluxer/date_utils/src/DateDuration';
import {useLingui} from '@lingui/react/macro';
import {ClockClockwiseIcon, ClockCounterClockwiseIcon, PauseIcon, PlayIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

interface AudioPlayerProps {
	src: string;
	title?: string;
	duration?: number;
	autoPlay?: boolean;
	isMobile?: boolean;
	className?: string;
}

export function AudioPlayer({
	src,
	title,
	duration: initialDuration,
	autoPlay = false,
	isMobile = false,
	className,
}: AudioPlayerProps) {
	const {t} = useLingui();
	const containerRef = useRef<HTMLDivElement>(null);
	const [hasStarted, setHasStarted] = useState(autoPlay);
	const [prePlayCurrentTime, setPrePlayCurrentTime] = useState(0);
	const pendingPlayRef = useRef(false);
	const pendingSeekPercentageRef = useRef<number | null>(null);

	const [volume, setVolumeState] = useState(AudioVolumeStore.volume);
	const [isMuted, setIsMutedState] = useState(AudioVolumeStore.isMuted);

	const {mediaRef, state, play, toggle, seekRelative, setPlaybackRate} = useMediaPlayer({
		autoPlay,
		persistVolume: false,
		persistPlaybackRate: true,
	});

	const {currentTime, duration, progress, buffered, seekToPercentage, startSeeking, endSeeking} = useMediaProgress({
		mediaRef,
		initialDuration,
	});

	useEffect(() => {
		const media = mediaRef.current;
		if (!media) return;
		media.volume = volume;
		media.muted = isMuted;
	}, [mediaRef, volume, isMuted]);

	const setVolume = useCallback(
		(newVolume: number) => {
			const clamped = Math.max(0, Math.min(1, newVolume));
			setVolumeState(clamped);
			AudioVolumeStore.setVolume(clamped);
			if (isMuted && clamped > 0) {
				setIsMutedState(false);
			}
		},
		[isMuted],
	);

	const toggleMute = useCallback(() => {
		setIsMutedState((prev) => !prev);
		AudioVolumeStore.toggleMute();
	}, []);

	useEffect(() => {
		if (hasStarted && pendingPlayRef.current) {
			const timer = setTimeout(() => {
				if (pendingPlayRef.current) {
					pendingPlayRef.current = false;
					play();
				}
			}, 0);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [hasStarted, play]);

	useEffect(() => {
		if (!hasStarted || pendingSeekPercentageRef.current === null) {
			return;
		}

		const media = mediaRef.current;
		if (!media) {
			return;
		}

		const applyPendingSeek = () => {
			if (pendingSeekPercentageRef.current === null || !Number.isFinite(media.duration) || media.duration <= 0) {
				return;
			}

			const seekTime = (pendingSeekPercentageRef.current / 100) * media.duration;
			media.currentTime = seekTime;
			setPrePlayCurrentTime(seekTime);
			pendingSeekPercentageRef.current = null;
		};

		applyPendingSeek();
		media.addEventListener('loadedmetadata', applyPendingSeek);
		media.addEventListener('durationchange', applyPendingSeek);

		return () => {
			media.removeEventListener('loadedmetadata', applyPendingSeek);
			media.removeEventListener('durationchange', applyPendingSeek);
		};
	}, [hasStarted, mediaRef]);

	const handlePlayClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (!hasStarted) {
				pendingPlayRef.current = true;
				setHasStarted(true);
				return;
			}
			pendingPlayRef.current = false;
			toggle();
		},
		[hasStarted, toggle],
	);

	const handleSeekBackward = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (!hasStarted || duration <= 0) {
				if (!initialDuration || initialDuration <= 0) {
					return;
				}

				const nextTime = Math.max(0, prePlayCurrentTime - DEFAULT_SEEK_AMOUNT);
				setPrePlayCurrentTime(nextTime);
				pendingSeekPercentageRef.current = (nextTime / initialDuration) * 100;
				return;
			}

			seekRelative(-DEFAULT_SEEK_AMOUNT);
		},
		[duration, hasStarted, initialDuration, prePlayCurrentTime, seekRelative],
	);

	const handleSeekForward = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (!hasStarted || duration <= 0) {
				if (!initialDuration || initialDuration <= 0) {
					return;
				}

				const nextTime = Math.min(initialDuration, prePlayCurrentTime + DEFAULT_SEEK_AMOUNT);
				setPrePlayCurrentTime(nextTime);
				pendingSeekPercentageRef.current = (nextTime / initialDuration) * 100;
				return;
			}

			seekRelative(DEFAULT_SEEK_AMOUNT);
		},
		[duration, hasStarted, initialDuration, prePlayCurrentTime, seekRelative],
	);

	const handleSeek = useCallback(
		(percentage: number) => {
			if (!hasStarted || duration <= 0) {
				if (!initialDuration || initialDuration <= 0) {
					return;
				}

				const clampedPercentage = Math.max(0, Math.min(100, percentage));
				const nextTime = (clampedPercentage / 100) * initialDuration;
				setPrePlayCurrentTime(nextTime);
				pendingSeekPercentageRef.current = clampedPercentage;
				return;
			}

			seekToPercentage(percentage);
		},
		[duration, hasStarted, initialDuration, seekToPercentage],
	);

	const playButtonSize = isMobile ? 28 : 24;
	const seekButtonSize = isMobile ? 24 : 20;
	const displayDuration = duration > 0 ? duration : (initialDuration ?? 0);
	const displayCurrentTime = !hasStarted && initialDuration ? prePlayCurrentTime : currentTime;
	const displayProgress =
		!hasStarted && initialDuration && initialDuration > 0 ? (prePlayCurrentTime / initialDuration) * 100 : progress;

	return (
		<div ref={containerRef} className={clsx(styles.container, isMobile && styles.mobile, className)}>
			{/* biome-ignore lint/a11y/useMediaCaption: Audio player doesn't require captions */}
			<audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={hasStarted ? src : undefined} preload="none" />

			{title && <h3 className={styles.fileName}>{title}</h3>}

			<div className={styles.progressSection}>
				<MediaProgressBar
					progress={displayProgress}
					buffered={buffered}
					currentTime={displayCurrentTime}
					duration={displayDuration}
					onSeek={handleSeek}
					onSeekStart={startSeeking}
					onSeekEnd={endSeeking}
					className={styles.progressBar}
				/>
				<span className={styles.timeDisplay}>
					{formatDuration(displayCurrentTime)} / {formatDuration(displayDuration)}
				</span>
			</div>

			<div className={styles.controls}>
				<div className={styles.mainControls}>
					<Tooltip text={t`Rewind ${DEFAULT_SEEK_AMOUNT} seconds`} position="top">
						<FocusRing offset={-2}>
							<button
								type="button"
								onClick={handleSeekBackward}
								className={styles.seekButton}
								aria-label={t`Rewind ${DEFAULT_SEEK_AMOUNT} seconds`}
							>
								<ClockCounterClockwiseIcon size={seekButtonSize} weight="bold" />
							</button>
						</FocusRing>
					</Tooltip>

					<FocusRing offset={-2}>
						<button
							type="button"
							onClick={handlePlayClick}
							className={styles.playButton}
							aria-label={state.isPlaying ? t`Pause` : t`Play`}
						>
							{state.isPlaying ? (
								<PauseIcon size={playButtonSize} weight="fill" />
							) : (
								<PlayIcon size={playButtonSize} weight="fill" />
							)}
						</button>
					</FocusRing>

					<Tooltip text={t`Forward ${DEFAULT_SEEK_AMOUNT} seconds`} position="top">
						<FocusRing offset={-2}>
							<button
								type="button"
								onClick={handleSeekForward}
								className={styles.seekButton}
								aria-label={t`Forward ${DEFAULT_SEEK_AMOUNT} seconds`}
							>
								<ClockClockwiseIcon size={seekButtonSize} weight="bold" />
							</button>
						</FocusRing>
					</Tooltip>
				</div>
			</div>

			<div className={styles.secondaryControls}>
				<MediaVolumeControl
					volume={volume}
					isMuted={isMuted}
					onVolumeChange={setVolume}
					onToggleMute={toggleMute}
					iconSize={18}
					className={styles.volumeControl}
				/>

				<MediaPlaybackRate
					rate={state.playbackRate}
					onRateChange={setPlaybackRate}
					rates={AUDIO_PLAYBACK_RATES}
					isAudio
					className={styles.playbackRate}
				/>
			</div>
		</div>
	);
}
