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
import type {BaseMediaProps} from '@app/components/channel/embeds/media/MediaTypes';
import styles from '@app/components/channel/embeds/media/VoiceMessagePlayer.module.css';
import {MediaPlaybackRate} from '@app/components/media_player/components/MediaPlaybackRate';
import {MediaVerticalVolumeControl} from '@app/components/media_player/components/MediaVerticalVolumeControl';
import {useMediaPlayer} from '@app/components/media_player/hooks/useMediaPlayer';
import {useMediaProgress} from '@app/components/media_player/hooks/useMediaProgress';
import {useMediaVolume} from '@app/components/media_player/hooks/useMediaVolume';
import {AUDIO_PLAYBACK_RATES} from '@app/components/media_player/utils/MediaConstants';
import {MediaContextMenu} from '@app/components/uikit/context_menu/MediaContextMenu';
import {Logger} from '@app/lib/Logger';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {useLingui} from '@lingui/react/macro';
import {PauseIcon, PlayIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('VoiceMessagePlayer');

export interface VoiceMessagePlayerProps extends BaseMediaProps {
	src: string;
	title?: string;
	duration?: number;
	fileSize?: number;
	waveform: string;
	mediaAttachments?: ReadonlyArray<MessageAttachment>;
	isPreview?: boolean;
}

function decodeWaveform(waveform: string): Array<number> {
	try {
		const decoded = atob(waveform);
		const values: Array<number> = [];
		for (let i = 0; i < decoded.length; i++) {
			values.push(decoded.charCodeAt(i));
		}
		return values;
	} catch (error) {
		logger.warn({error, waveform}, 'Unable to decode waveform');
		return [];
	}
}

function normaliseWaveform(values: Array<number>): Array<number> {
	if (values.length === 0) return values;
	let maxValue = 0;
	for (let i = 0; i < values.length; i++) {
		if (values[i] > maxValue) {
			maxValue = values[i];
		}
	}
	if (maxValue <= 0) return values;
	return values.map((value) => Math.min(255, Math.round((value / maxValue) * 255)));
}

function formatTime(time: number): string {
	if (!Number.isFinite(time)) return '0:00';
	const minutes = Math.floor(time / 60);
	const seconds = Math.floor(time % 60);
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = observer(
	({
		src,
		title: _title,
		duration: initialDuration,
		channelId: _channelId,
		messageId: _messageId,
		attachmentId,
		message,
		contentHash,
		onDelete,
		waveform,
	}) => {
		const {t} = useLingui();
		const effectiveSrc = buildMediaProxyURL(src);
		const [hasStarted, setHasStarted] = useState(false);
		const [prePlayCurrentTime, setPrePlayCurrentTime] = useState(0);
		const pendingPlayRef = useRef(false);
		const pendingSeekPercentageRef = useRef<number | null>(null);

		const {mediaRef, state, play, toggle, setPlaybackRate} = useMediaPlayer({
			persistVolume: true,
		});

		const {currentTime, duration, progress, seekToPercentage} = useMediaProgress({
			mediaRef,
			initialDuration: initialDuration ?? 0,
		});

		const {volume, isMuted, setVolume, toggleMute} = useMediaVolume({
			mediaRef,
		});

		const handleContextMenu = useCallback(
			(e: React.MouseEvent) => {
				if (!message) return;
				e.preventDefault();
				e.stopPropagation();

				ContextMenuActionCreators.openFromEvent(e, ({onClose}) => (
					<MediaContextMenu
						message={message}
						originalSrc={src}
						type="audio"
						contentHash={contentHash}
						attachmentId={attachmentId}
						onClose={onClose}
						onDelete={onDelete || (() => {})}
					/>
				));
			},
			[message, src, contentHash, attachmentId, onDelete],
		);

		const waveformBars = useMemo(() => normaliseWaveform(decodeWaveform(waveform)), [waveform]);
		const waveformValues = waveformBars.length > 0 ? waveformBars : new Array(48).fill(128);

		const MAX_WAVEFORM_BARS = 32;
		const downsampledWaveform = useMemo(() => {
			if (waveformValues.length <= MAX_WAVEFORM_BARS) return waveformValues;
			const result: Array<number> = [];
			const step = waveformValues.length / MAX_WAVEFORM_BARS;
			for (let i = 0; i < MAX_WAVEFORM_BARS; i++) {
				const start = Math.floor(i * step);
				const end = Math.floor((i + 1) * step);
				let sum = 0;
				for (let j = start; j < end; j++) {
					sum += waveformValues[j];
				}
				result.push(Math.round(sum / (end - start)));
			}
			return result;
		}, [waveformValues]);

		const displayDuration = duration > 0 ? duration : (initialDuration ?? 0);
		const isLoading = hasStarted && state.isBuffering;
		const isActive = state.isPlaying || isLoading;

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

		const handlePlayToggle = useCallback(
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

		const handleWaveformClick = useCallback(
			(e: React.MouseEvent<HTMLDivElement>) => {
				if (state.isBuffering) return;
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const percentage = (x / rect.width) * 100;
				if (!hasStarted || duration <= 0) {
					if (!displayDuration || displayDuration <= 0) {
						return;
					}

					const clampedPercentage = Math.max(0, Math.min(100, percentage));
					const nextTime = (clampedPercentage / 100) * displayDuration;
					setPrePlayCurrentTime(nextTime);
					pendingSeekPercentageRef.current = clampedPercentage;
					return;
				}
				seekToPercentage(Math.max(0, Math.min(100, percentage)));
			},
			[displayDuration, duration, hasStarted, seekToPercentage, state.isBuffering],
		);

		const handleWaveformKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLDivElement>) => {
				if (state.isBuffering) return;
				const step = 5;
				if (e.key === 'ArrowLeft') {
					e.preventDefault();
					if (!hasStarted || duration <= 0) {
						if (!displayDuration || displayDuration <= 0) {
							return;
						}

						const nextTime = Math.max(0, prePlayCurrentTime - displayDuration * (step / 100));
						setPrePlayCurrentTime(nextTime);
						pendingSeekPercentageRef.current = (nextTime / displayDuration) * 100;
						return;
					}

					seekToPercentage(Math.max(0, progress - step));
				} else if (e.key === 'ArrowRight') {
					e.preventDefault();
					if (!hasStarted || duration <= 0) {
						if (!displayDuration || displayDuration <= 0) {
							return;
						}

						const nextTime = Math.min(displayDuration, prePlayCurrentTime + displayDuration * (step / 100));
						setPrePlayCurrentTime(nextTime);
						pendingSeekPercentageRef.current = (nextTime / displayDuration) * 100;
						return;
					}

					seekToPercentage(Math.min(100, progress + step));
				}
			},
			[displayDuration, duration, hasStarted, prePlayCurrentTime, progress, seekToPercentage, state.isBuffering],
		);

		const displayCurrentTime = !hasStarted && displayDuration > 0 ? prePlayCurrentTime : currentTime;
		const displayProgress =
			!hasStarted && displayDuration > 0 ? (prePlayCurrentTime / displayDuration) * 100 : progress;

		const waveformElements = useMemo(
			() =>
				downsampledWaveform.map((value, index) => {
					const height = Math.max(8, Math.round((value / 255) * 100));
					const barProgress = ((index + 0.5) / downsampledWaveform.length) * 100;
					const isPast = barProgress <= displayProgress;
					return (
						<span
							key={`waveform-${index}`}
							className={clsx(styles.waveformBar, isPast && styles.waveformBarPast)}
							style={{height: `${height}%`}}
						/>
					);
				}),
			[displayProgress, downsampledWaveform],
		);

		const isMobile = MobileLayoutStore.enabled;

		return (
			<motion.div
				className={clsx(styles.container, isActive && styles.containerActive)}
				onContextMenu={handleContextMenu}
				role="region"
				aria-label={t`Voice message player`}
				initial={false}
				animate={{
					backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--background-secondary)',
				}}
				transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
			>
				{/* biome-ignore lint/a11y/useMediaCaption: Decorative audio player */}
				<audio
					ref={mediaRef as React.RefObject<HTMLAudioElement>}
					src={hasStarted ? effectiveSrc : undefined}
					preload="none"
				/>

				<motion.button
					type="button"
					onClick={handlePlayToggle}
					className={styles.playButton}
					aria-label={state.isPlaying ? t`Pause` : t`Play`}
					whileTap={AccessibilityStore.useReducedMotion ? undefined : {scale: 0.9}}
					initial={false}
					animate={{
						backgroundColor: isActive ? 'var(--text-on-brand-primary)' : 'var(--brand-primary)',
						color: isActive ? 'var(--brand-primary)' : 'var(--text-on-brand-primary)',
					}}
					transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
				>
					{isLoading && <span className={styles.loadingSpinner} />}
					<AnimatePresence mode="wait">
						<motion.div
							key={state.isPlaying ? 'pause' : 'play'}
							className={styles.playButtonIcon}
							initial={AccessibilityStore.useReducedMotion ? {scale: 1, opacity: 1} : {scale: 0.5, opacity: 0}}
							animate={{scale: 1, opacity: 1}}
							exit={AccessibilityStore.useReducedMotion ? {scale: 1, opacity: 1} : {scale: 0.5, opacity: 0}}
							transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.1}}
						>
							{state.isPlaying ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
						</motion.div>
					</AnimatePresence>
				</motion.button>

				<div
					className={styles.waveformContainer}
					onClick={handleWaveformClick}
					onKeyDown={handleWaveformKeyDown}
					role="slider"
					tabIndex={0}
					aria-valuenow={Math.round(displayProgress)}
					aria-valuemin={0}
					aria-valuemax={100}
				>
					{waveformElements}
				</div>

				<motion.span
					className={styles.timestamp}
					initial={false}
					animate={{
						color: isActive
							? 'color-mix(in srgb, var(--text-on-brand-primary) 90%, transparent)'
							: 'var(--text-secondary)',
					}}
					transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
				>
					{formatTime(displayCurrentTime)} / {formatTime(displayDuration)}
				</motion.span>

				{!isMobile && (
					<>
						<MediaPlaybackRate
							rate={state.playbackRate}
							onRateChange={setPlaybackRate}
							rates={AUDIO_PLAYBACK_RATES}
							size="small"
							className={styles.speedControl}
						/>
						<MediaVerticalVolumeControl
							volume={volume}
							isMuted={isMuted}
							onVolumeChange={setVolume}
							onToggleMute={toggleMute}
							iconSize={16}
							className={styles.volumeControl}
						/>
					</>
				)}
			</motion.div>
		);
	},
);

export default VoiceMessagePlayer;
