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

import {TextareaButton} from '@app/components/channel/textarea/TextareaButton';
import styles from '@app/components/channel/textarea/TextareaButtons.module.css';
import {Logger} from '@app/lib/Logger';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {computeVoiceWaveform} from '@app/utils/VoiceMessageRecordingUtils';
import {sendVoiceMessage} from '@app/utils/VoiceMessageSendUtils';
import {useLingui} from '@lingui/react/macro';
import {MicrophoneIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {motion, type Variants} from 'framer-motion';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';

const logger = new Logger('HoldToRecordButton');

const recordingVariants: Variants = {
	idle: {
		scale: 1,
		boxShadow: '0 0 0 0px rgba(252, 95, 105, 0)',
	},
	recording: {
		scale: [1, 1.05, 1],
		boxShadow: [
			'0 0 0 0px rgba(252, 95, 105, 0.35)',
			'0 0 0 8px rgba(252, 95, 105, 0.15)',
			'0 0 0 0px rgba(252, 95, 105, 0.35)',
		],
		transition: {
			duration: 1.2,
			repeat: Infinity,
			ease: 'easeInOut',
		},
	},
};

interface HoldToRecordButtonProps {
	channelId: string;
	disabled?: boolean;
	onFallback?: () => void;
}

const HoldToRecordButton: React.FC<HoldToRecordButtonProps> = ({channelId, disabled, onFallback}) => {
	const {t} = useLingui();
	const [status, setStatus] = useState<'idle' | 'recording' | 'sending'>('idle');
	const [error, setError] = useState<string | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Array<Blob>>([]);
	const pointerIdRef = useRef<number | null>(null);
	const maxTimerRef = useRef<number | null>(null);
	const maxRecordingSeconds = useMemo(
		() => LimitResolver.resolve({key: 'max_voice_message_duration', fallback: 1200}),
		[],
	);

	const clearMaxTimer = useCallback(() => {
		if (maxTimerRef.current) {
			clearTimeout(maxTimerRef.current);
			maxTimerRef.current = null;
		}
	}, []);

	const releaseStream = useCallback(() => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop());
			streamRef.current = null;
		}
	}, []);

	const cleanupRecording = useCallback(() => {
		clearMaxTimer();
		releaseStream();
		mediaRecorderRef.current = null;
	}, [clearMaxTimer, releaseStream]);

	const handleRecordingStop = useCallback(
		async (blob: Blob) => {
			if (blob.size === 0) {
				setStatus('idle');
				setError(t`Recording failed. Please try again.`);
				return;
			}
			setStatus('sending');
			try {
				const {duration, waveform} = await computeVoiceWaveform(blob);
				const file = new File([blob], `voice-message-${Date.now()}.ogg`, {
					type: blob.type || 'audio/ogg',
				});

				await sendVoiceMessage({
					channelId,
					file,
					waveform,
					duration,
					title: t`Voice Message`,
				});

				setStatus('idle');
				setError(null);
			} catch (err) {
				logger.error('Failed to send voice message', err);
				setError(t`Unable to send voice message. Please try again.`);
				setStatus('idle');
			}
		},
		[channelId, t],
	);

	const handleStopEvent = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (!recorder) {
			setStatus('idle');
			return;
		}

		const recordedChunks = chunksRef.current;
		const blob = new Blob(recordedChunks, {type: recorder.mimeType || 'audio/ogg'});
		chunksRef.current = [];
		cleanupRecording();

		if (recordedChunks.length === 0) {
			setError(t`Recording failed. Please try again.`);
			setStatus('idle');
			return;
		}

		void handleRecordingStop(blob);
	}, [cleanupRecording, handleRecordingStop, t]);

	const handleDataAvailable = useCallback((event: BlobEvent) => {
		if (event.data && event.data.size > 0) {
			chunksRef.current = [...chunksRef.current, event.data];
		}
	}, []);

	const stopRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (recorder && recorder.state !== 'inactive') {
			recorder.stop();
		}
	}, []);

	const startRecording = useCallback(async () => {
		if (status === 'recording' || status === 'sending') return;
		if (typeof navigator.mediaDevices === 'undefined' || typeof MediaRecorder === 'undefined') {
			setError(t`Voice recording is not supported in this browser.`);
			onFallback?.();
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({audio: true});
			const preferredType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
				? 'audio/ogg;codecs=opus'
				: 'audio/webm;codecs=opus';
			const recorder = new MediaRecorder(stream, {mimeType: preferredType});
			chunksRef.current = [];
			recorder.addEventListener('dataavailable', handleDataAvailable);
			recorder.addEventListener('stop', handleStopEvent, {once: true});
			recorder.start();
			mediaRecorderRef.current = recorder;
			streamRef.current = stream;
			setStatus('recording');
			setError(null);

			clearMaxTimer();
			maxTimerRef.current = window.setTimeout(() => {
				stopRecording();
			}, maxRecordingSeconds * 1000);
		} catch (err) {
			logger.error('Failed to start voice recording', err);
			setError(t`Unable to start recording. Please allow microphone access.`);
		}
	}, [clearMaxTimer, handleDataAvailable, handleStopEvent, maxRecordingSeconds, status, t]);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (disabled || status === 'sending') return;
			event.preventDefault();
			pointerIdRef.current = event.pointerId;
			event.currentTarget.setPointerCapture(event.pointerId);
			void startRecording();
		},
		[disabled, startRecording, status],
	);

	const handlePointerUp = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (pointerIdRef.current !== event.pointerId) return;
			event.preventDefault();
			try {
				event.currentTarget.releasePointerCapture(event.pointerId);
			} catch {}
			pointerIdRef.current = null;
			stopRecording();
		},
		[stopRecording],
	);

	const handlePointerCancel = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (pointerIdRef.current !== event.pointerId) return;
			event.preventDefault();
			pointerIdRef.current = null;
			stopRecording();
		},
		[stopRecording],
	);

	const indicatorText = useMemo(() => {
		if (error) return error;
		if (status === 'recording') return t`Release to send`;
		return t`Hold to send voice message`;
	}, [error, status, t]);

	return (
		<motion.div
			className={styles.holdButtonWrapper}
			variants={recordingVariants}
			animate={status === 'recording' ? 'recording' : 'idle'}
		>
			<TextareaButton
				icon={MicrophoneIcon}
				label={t`Voice message`}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerCancel}
				onPointerLeave={handlePointerCancel}
				disabled={disabled || status === 'sending'}
				className={clsx(styles.holdButton, status === 'recording' && styles.holdButtonRecording)}
			/>
			<motion.span
				key={indicatorText}
				className={clsx(
					styles.holdIndicator,
					status === 'recording' && styles.holdIndicatorRecording,
					error && styles.holdIndicatorError,
				)}
				initial={AccessibilityStore.useReducedMotion ? {opacity: 1, y: 0} : {opacity: 0, y: 5}}
				animate={{opacity: 1, y: 0}}
				transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.15}}
			>
				{indicatorText}
			</motion.span>
		</motion.div>
	);
};

export default HoldToRecordButton;
