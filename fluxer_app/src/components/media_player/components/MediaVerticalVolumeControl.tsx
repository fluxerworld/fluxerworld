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

import styles from '@app/components/media_player/MediaVerticalVolumeControl.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useLingui} from '@lingui/react/macro';
import {SpeakerHighIcon, SpeakerLowIcon, SpeakerNoneIcon, SpeakerXIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

interface MediaVerticalVolumeControlProps {
	volume: number;
	isMuted: boolean;
	onVolumeChange: (volume: number) => void;
	onToggleMute: () => void;
	iconSize?: number;
	className?: string;
}

function getVolumeIcon(volume: number, isMuted: boolean) {
	if (isMuted || volume === 0) {
		return SpeakerXIcon;
	}
	if (volume < 0.33) {
		return SpeakerNoneIcon;
	}
	if (volume < 0.67) {
		return SpeakerLowIcon;
	}
	return SpeakerHighIcon;
}

const POPOUT_GAP = 8;

export function MediaVerticalVolumeControl({
	volume,
	isMuted,
	onVolumeChange,
	onToggleMute,
	iconSize = 18,
	className,
}: MediaVerticalVolumeControlProps) {
	const {t} = useLingui();
	const buttonRef = useRef<HTMLButtonElement>(null);
	const popoutRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const [isHovered, setIsHovered] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const rafRef = useRef<number | null>(null);
	const [popoutPosition, setPopoutPosition] = useState<{top: number; left: number; width: number} | null>(null);

	const Icon = getVolumeIcon(volume, isMuted);
	const displayVolume = isMuted ? 0 : volume;
	const isOpen = isHovered || isDragging;

	const updatePopoutPosition = useCallback(() => {
		const button = buttonRef.current;
		if (!button) return;
		const rect = button.getBoundingClientRect();
		setPopoutPosition({
			top: rect.top,
			left: rect.left,
			width: rect.width,
		});
	}, []);

	useLayoutEffect(() => {
		if (isOpen) {
			updatePopoutPosition();
		}
	}, [isOpen, updatePopoutPosition]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleReposition = () => {
			updatePopoutPosition();
		};

		window.addEventListener('resize', handleReposition);
		window.addEventListener('scroll', handleReposition, true);

		return () => {
			window.removeEventListener('resize', handleReposition);
			window.removeEventListener('scroll', handleReposition, true);
		};
	}, [isOpen, updatePopoutPosition]);

	const cancelClose = useCallback(() => {
		if (closeTimerRef.current !== null) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const scheduleClose = useCallback(() => {
		cancelClose();
		closeTimerRef.current = setTimeout(() => {
			if (!isDragging) {
				setIsHovered(false);
			}
			closeTimerRef.current = null;
		}, 200);
	}, [cancelClose, isDragging]);

	const handleButtonMouseEnter = useCallback(() => {
		cancelClose();
		setIsHovered(true);
	}, [cancelClose]);

	const handleButtonMouseLeave = useCallback(() => {
		if (!isDragging) {
			scheduleClose();
		}
	}, [isDragging, scheduleClose]);

	const handlePopoutMouseEnter = useCallback(() => {
		cancelClose();
	}, [cancelClose]);

	const handlePopoutMouseLeave = useCallback(() => {
		if (!isDragging) {
			scheduleClose();
		}
	}, [isDragging, scheduleClose]);

	const getVolumeFromEvent = useCallback((clientY: number): number => {
		const track = trackRef.current;
		if (!track) return 0;
		const rect = track.getBoundingClientRect();
		const y = rect.bottom - clientY;
		return Math.max(0, Math.min(1, y / rect.height));
	}, []);

	const handleTrackMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(true);
			const newVolume = getVolumeFromEvent(e.clientY);
			onVolumeChange(newVolume);
		},
		[getVolumeFromEvent, onVolumeChange],
	);

	const handleMuteClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			onToggleMute();
		},
		[onToggleMute],
	);

	const handleButtonKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const step = 0.1;
			let newVolume = volume;

			switch (e.key) {
				case 'ArrowUp':
				case 'ArrowRight':
					e.preventDefault();
					e.stopPropagation();
					newVolume = Math.min(1, volume + step);
					break;
				case 'ArrowDown':
				case 'ArrowLeft':
					e.preventDefault();
					e.stopPropagation();
					newVolume = Math.max(0, volume - step);
					break;
				case 'm':
				case 'M':
					e.preventDefault();
					e.stopPropagation();
					onToggleMute();
					return;
				default:
					return;
			}

			onVolumeChange(newVolume);
		},
		[volume, onVolumeChange, onToggleMute],
	);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
			rafRef.current = requestAnimationFrame(() => {
				const newVolume = getVolumeFromEvent(e.clientY);
				onVolumeChange(newVolume);
				rafRef.current = null;
			});
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);

		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isDragging, getVolumeFromEvent, onVolumeChange]);

	useEffect(() => {
		return () => {
			cancelClose();
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [cancelClose]);

	const muteLabel = isMuted ? t`Unmute` : t`Mute`;
	const fillHeight = `${displayVolume * 100}%`;
	const thumbBottom = `calc(${displayVolume * 100}% - 6px)`;

	const popoutElement =
		isOpen &&
		popoutPosition &&
		createPortal(
			// biome-ignore lint/a11y/noStaticElementInteractions: mouse tracking for popout dismiss behaviour
			<div
				ref={popoutRef}
				className={styles.popout}
				style={{
					position: 'fixed',
					top: popoutPosition.top - POPOUT_GAP,
					left: popoutPosition.left,
					width: popoutPosition.width,
					transform: 'translateY(-100%)',
					zIndex: 'var(--z-index-popout, 3000)' as unknown as number,
				}}
				onMouseEnter={handlePopoutMouseEnter}
				onMouseLeave={handlePopoutMouseLeave}
			>
				<div
					ref={trackRef}
					className={clsx(styles.sliderTrackWrapper, isDragging && styles.isDragging)}
					onMouseDown={handleTrackMouseDown}
					role="slider"
					aria-label={t`Volume`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(displayVolume * 100)}
					aria-valuetext={`${Math.round(displayVolume * 100)}%`}
					aria-orientation="vertical"
					tabIndex={0}
				>
					<div className={styles.sliderTrack}>
						<div className={styles.sliderFill} style={{height: fillHeight}} />
					</div>
					<div className={styles.sliderThumb} style={{bottom: thumbBottom}} />
				</div>
			</div>,
			document.body,
		);

	return (
		<div className={clsx(styles.container, className)} role="group" aria-label={t`Volume Control`}>
			{popoutElement}

			<FocusRing offset={-2}>
				<button
					ref={buttonRef}
					type="button"
					onClick={handleMuteClick}
					onKeyDown={handleButtonKeyDown}
					onMouseEnter={handleButtonMouseEnter}
					onMouseLeave={handleButtonMouseLeave}
					className={styles.muteButton}
					aria-label={muteLabel}
				>
					<Icon size={iconSize} weight="fill" />
				</button>
			</FocusRing>
		</div>
	);
}
