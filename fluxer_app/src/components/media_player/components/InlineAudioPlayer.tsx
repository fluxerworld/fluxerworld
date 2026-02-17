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

import {MediaPlaybackRate} from '@app/components/media_player/components/MediaPlaybackRate';
import {MediaProgressBar} from '@app/components/media_player/components/MediaProgressBar';
import {MediaVerticalVolumeControl} from '@app/components/media_player/components/MediaVerticalVolumeControl';
import {useMediaPlayer} from '@app/components/media_player/hooks/useMediaPlayer';
import {useMediaProgress} from '@app/components/media_player/hooks/useMediaProgress';
import {useMediaVolume} from '@app/components/media_player/hooks/useMediaVolume';
import styles from '@app/components/media_player/InlineAudioPlayer.module.css';
import {AUDIO_PLAYBACK_RATES} from '@app/components/media_player/utils/MediaConstants';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {formatDuration} from '@fluxer/date_utils/src/DateDuration';
import {useLingui} from '@lingui/react/macro';
import {DownloadSimpleIcon, PauseIcon, PlayIcon, StarIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

interface InlineAudioPlayerProps {
	src: string;
	title?: string;
	fileSize?: number;
	duration?: number;
	extension?: string;
	isMobile?: boolean;
	isFavorited?: boolean;
	canFavorite?: boolean;
	onFavoriteClick?: (e: React.MouseEvent) => void;
	onDownloadClick?: (e: React.MouseEvent) => void;
	onContextMenu?: (e: React.MouseEvent) => void;
	className?: string;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(time: number): string {
	if (!Number.isFinite(time)) return '0:00';
	const minutes = Math.floor(time / 60);
	const seconds = Math.floor(time % 60);
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function splitFilename(filename: string): {name: string; extension: string} {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1 || lastDot === 0) {
		return {name: filename, extension: ''};
	}
	return {
		name: filename.substring(0, lastDot),
		extension: filename.substring(lastDot),
	};
}

export function InlineAudioPlayer({
	src,
	title = 'Audio',
	fileSize,
	duration: initialDuration,
	extension,
	isMobile = false,
	isFavorited = false,
	canFavorite = false,
	onFavoriteClick,
	onDownloadClick,
	onContextMenu,
	className,
}: InlineAudioPlayerProps) {
	const {t} = useLingui();
	const trackRef = useRef<HTMLDivElement>(null);
	const [hasStarted, setHasStarted] = useState(false);
	const pendingPlayRef = useRef(false);

	const {mediaRef, state, play, toggle, setPlaybackRate} = useMediaPlayer({
		persistVolume: true,
	});

	const {currentTime, duration, progress, buffered, seekToPercentage, startSeeking, endSeeking} = useMediaProgress({
		mediaRef,
		initialDuration,
	});

	const {volume, isMuted, setVolume, toggleMute} = useMediaVolume({
		mediaRef,
	});

	const displayDuration = initialDuration ?? duration;
	const isLoading = hasStarted && state.isBuffering;
	const isActive = state.isPlaying || isLoading;

	const {name: fileName, extension: fileExtension} = extension
		? {name: title, extension: `.${extension}`}
		: splitFilename(title);

	const fileSizeString = fileSize ? formatFileSize(fileSize) : '';

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

	const handleProgressClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (state.isBuffering) return;
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const percentage = (x / rect.width) * 100;
			seekToPercentage(Math.max(0, Math.min(100, percentage)));
		},
		[seekToPercentage, state.isBuffering],
	);

	const handleProgressKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (state.isBuffering) return;
			const step = 5;
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				seekToPercentage(Math.max(0, progress - step));
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				seekToPercentage(Math.min(100, progress + step));
			}
		},
		[seekToPercentage, state.isBuffering, progress],
	);

	const handleSeek = useCallback(
		(percentage: number) => {
			seekToPercentage(percentage);
		},
		[seekToPercentage],
	);

	if (isMobile) {
		return (
			<motion.div
				className={clsx(styles.mobileContainer, isActive && styles.mobileContainerActive, className)}
				onContextMenu={onContextMenu}
				role="group"
				aria-label={t`Audio player`}
				initial={false}
				animate={{
					backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--background-secondary)',
				}}
				transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
			>
				{/* biome-ignore lint/a11y/useMediaCaption: Audio player doesn't require captions */}
				<audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={hasStarted ? src : undefined} preload="none" />

				<motion.button
					type="button"
					onClick={handlePlayToggle}
					className={styles.mobilePlayButton}
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
							{state.isPlaying ? <PauseIcon size={20} weight="fill" /> : <PlayIcon size={20} weight="fill" />}
						</motion.div>
					</AnimatePresence>
				</motion.button>

				<div className={styles.mobileContent}>
					<motion.div
						className={styles.mobileFileInfo}
						initial={false}
						animate={{
							color: isActive
								? 'color-mix(in srgb, var(--text-on-brand-primary) 90%, transparent)'
								: 'var(--text-primary)',
						}}
						transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
					>
						<span className={styles.mobileFileName}>
							{fileName}
							{fileExtension}
						</span>
						{fileSizeString && <span className={styles.mobileFileMeta}> · {fileSizeString}</span>}
					</motion.div>

					<div
						ref={trackRef}
						className={styles.mobileProgressContainer}
						onClick={handleProgressClick}
						onKeyDown={handleProgressKeyDown}
						role="slider"
						tabIndex={0}
						aria-valuenow={Math.round(progress)}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={t`Audio progress`}
					>
						<div className={clsx(styles.mobileProgressTrack, isActive && styles.mobileProgressTrackActive)}>
							<div
								className={clsx(styles.mobileProgressFill, isActive && styles.mobileProgressFillActive)}
								style={{width: `${progress}%`}}
							/>
						</div>
					</div>
				</div>

				<motion.span
					className={styles.mobileTimestamp}
					initial={false}
					animate={{
						color: isActive
							? 'color-mix(in srgb, var(--text-on-brand-primary) 90%, transparent)'
							: 'var(--text-secondary)',
					}}
					transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: 'easeOut'}}
				>
					{state.isPlaying ? formatTime(currentTime) : formatTime(displayDuration)}
				</motion.span>
			</motion.div>
		);
	}

	return (
		<div
			className={clsx(styles.container, className)}
			onContextMenu={onContextMenu}
			role="group"
			aria-label={t`Audio player`}
		>
			{/* biome-ignore lint/a11y/useMediaCaption: Audio player doesn't require captions */}
			<audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={hasStarted ? src : undefined} preload="none" />

			<div className={styles.header}>
				<FocusRing offset={-2}>
					<button
						type="button"
						onClick={handlePlayToggle}
						className={styles.playButton}
						aria-label={state.isPlaying ? t`Pause` : t`Play`}
					>
						{isLoading && <span className={styles.loadingSpinnerDesktop} />}
						{state.isPlaying ? <PauseIcon size={20} weight="fill" /> : <PlayIcon size={20} weight="fill" />}
					</button>
				</FocusRing>

				<div className={styles.fileInfo}>
					<p className={styles.fileName}>
						<span className={styles.fileNameTruncate}>{fileName}</span>
						<span className={styles.fileExtension}>{fileExtension}</span>
					</p>
					<p className={styles.fileMeta}>
						{fileSizeString}
						{fileSizeString && displayDuration > 0 && ' · '}
						{displayDuration > 0 && formatDuration(displayDuration)}
					</p>
				</div>
			</div>

			<div className={styles.progressSection}>
				<MediaProgressBar
					progress={progress}
					buffered={buffered}
					currentTime={currentTime}
					duration={displayDuration}
					onSeek={handleSeek}
					onSeekStart={startSeeking}
					onSeekEnd={endSeeking}
					compact
					className={styles.progressBar}
				/>
				<span className={styles.time}>
					{formatDuration(currentTime)} / {formatDuration(displayDuration)}
				</span>
			</div>

			<div className={styles.controls}>
				<div className={styles.controlsLeft}>
					<MediaVerticalVolumeControl
						volume={volume}
						isMuted={isMuted}
						onVolumeChange={setVolume}
						onToggleMute={toggleMute}
						iconSize={18}
						className={styles.volumeControl}
					/>
				</div>

				<div className={styles.controlsRight}>
					<MediaPlaybackRate
						rate={state.playbackRate}
						onRateChange={setPlaybackRate}
						rates={AUDIO_PLAYBACK_RATES}
						size="small"
					/>

					{canFavorite && onFavoriteClick && (
						<Tooltip text={isFavorited ? t`Remove from favorites` : t`Add to favorites`} position="top">
							<FocusRing offset={-2}>
								<button
									type="button"
									onClick={(e) => onFavoriteClick(e)}
									className={styles.actionButton}
									aria-label={isFavorited ? t`Remove from favorites` : t`Add to favorites`}
								>
									<StarIcon size={18} weight={isFavorited ? 'fill' : 'regular'} />
								</button>
							</FocusRing>
						</Tooltip>
					)}

					{onDownloadClick && (
						<Tooltip text={t`Download`} position="top">
							<FocusRing offset={-2}>
								<button
									type="button"
									onClick={(e) => onDownloadClick(e)}
									className={styles.actionButton}
									aria-label={t`Download`}
								>
									<DownloadSimpleIcon size={18} weight="bold" />
								</button>
							</FocusRing>
						</Tooltip>
					)}
				</div>
			</div>
		</div>
	);
}
