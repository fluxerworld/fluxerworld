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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import {Logger} from '@app/lib/Logger';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {supportsDesktopScreenShareAudioCapture} from '@app/utils/NativeUtils';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useCallback, useMemo, useState} from 'react';

const logger = new Logger('ScreenShareSettingsModal');

export interface ScreenShareSettingsModalSharedProps {
	onStartShare: (
		resolution: 'low' | 'medium' | 'high' | 'ultra' | '4k',
		frameRate: number,
		includeAudio: boolean,
	) => Promise<void>;
}

interface ResolutionOption {
	value: 'low' | 'medium' | 'high' | 'ultra' | '4k';
	label: MessageDescriptor;
	isPremium: boolean;
}

interface FramerateOption {
	value: number;
	label: MessageDescriptor;
	isPremium: boolean;
}

const BASE_RESOLUTION_OPTIONS: Array<Omit<ResolutionOption, 'isPremium'>> = [
	{value: 'low', label: msg`480p`},
	{value: 'medium', label: msg`720p`},
	{value: 'high', label: msg`1080p`},
	{value: 'ultra', label: msg`1440p`},
	{value: '4k', label: msg`4K`},
];

const BASE_FRAMERATE_OPTIONS: Array<Omit<FramerateOption, 'isPremium'>> = [
	{value: 15, label: msg`15 FPS`},
	{value: 24, label: msg`24 FPS`},
	{value: 30, label: msg`30 FPS`},
	{value: 60, label: msg`60 FPS`},
];

const PREMIUM_RESOLUTION_VALUES: Set<ResolutionOption['value']> = new Set(['high', 'ultra', '4k']);
const PREMIUM_FRAMERATE_VALUES: Set<number> = new Set([60]);

const getResolutionOptions = (_hasHigherQuality: boolean): Array<ResolutionOption> => {
	return BASE_RESOLUTION_OPTIONS.map((option) => ({
		...option,
		isPremium: PREMIUM_RESOLUTION_VALUES.has(option.value),
	}));
};

const getFramerateOptions = (_hasHigherQuality: boolean): Array<FramerateOption> => {
	return BASE_FRAMERATE_OPTIONS.map((option) => ({
		...option,
		isPremium: PREMIUM_FRAMERATE_VALUES.has(option.value),
	}));
};

export function useScreenShareSettingsModal({onStartShare}: ScreenShareSettingsModalSharedProps) {
	const voiceSettings = VoiceSettingsStore;
	const hasHigherQuality = useMemo(
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

	const resolutionOptions = useMemo(() => getResolutionOptions(hasHigherQuality), [hasHigherQuality]);
	const framerateOptions = useMemo(() => getFramerateOptions(hasHigherQuality), [hasHigherQuality]);
	const supportsScreenShareAudio = useMemo(() => supportsDesktopScreenShareAudioCapture(), []);

	const [isSharing, setIsSharing] = useState(false);
	const [selectedResolution, setSelectedResolution] = useState<'low' | 'medium' | 'high' | 'ultra' | '4k'>(
		!hasHigherQuality &&
			(voiceSettings.screenshareResolution === 'high' ||
				voiceSettings.screenshareResolution === 'ultra' ||
				voiceSettings.screenshareResolution === '4k')
			? 'medium'
			: voiceSettings.screenshareResolution,
	);
	const [selectedFrameRate, setSelectedFrameRate] = useState<number>(
		!hasHigherQuality && voiceSettings.videoFrameRate > 30 ? 30 : voiceSettings.videoFrameRate,
	);
	const [includeAudio, setIncludeAudioState] = useState<boolean>(
		supportsScreenShareAudio && LocalVoiceStateStore.getSelfStreamAudio(),
	);
	const setIncludeAudio = useCallback(
		(value: boolean) => {
			if (!supportsScreenShareAudio) {
				setIncludeAudioState(false);
				return;
			}
			setIncludeAudioState(value);
		},
		[supportsScreenShareAudio],
	);

	const handleStartShare = useCallback(async () => {
		setIsSharing(true);
		try {
			const includeAudioForRequest = supportsScreenShareAudio ? includeAudio : false;
			LocalVoiceStateStore.updateSelfStreamAudio(includeAudioForRequest);
			VoiceSettingsActionCreators.update({
				screenshareResolution: selectedResolution,
				videoFrameRate: selectedFrameRate,
			});
			await onStartShare(selectedResolution, selectedFrameRate, includeAudioForRequest);
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Failed to start screen share', error);
			setIsSharing(false);
		}
	}, [selectedResolution, selectedFrameRate, includeAudio, onStartShare, supportsScreenShareAudio]);

	const handleCancel = useCallback(() => {
		ModalActionCreators.pop();
	}, []);

	const handleResolutionClick = useCallback(
		(value: 'low' | 'medium' | 'high' | 'ultra' | '4k', isPremium: boolean) => {
			if (isPremium && !hasHigherQuality) {
				PremiumModalActionCreators.open();
				return;
			}
			setSelectedResolution(value);
		},
		[hasHigherQuality],
	);

	const handleFrameRateClick = useCallback(
		(value: number, isPremium: boolean) => {
			if (isPremium && !hasHigherQuality) {
				PremiumModalActionCreators.open();
				return;
			}
			setSelectedFrameRate(value);
		},
		[hasHigherQuality],
	);

	return {
		hasPremium: hasHigherQuality,
		isSharing,
		supportsScreenShareAudio,
		selectedResolution,
		selectedFrameRate,
		includeAudio,
		setIncludeAudio,
		handleStartShare,
		handleCancel,
		handleResolutionClick,
		handleFrameRateClick,
		RESOLUTION_OPTIONS: resolutionOptions,
		FRAMERATE_OPTIONS: framerateOptions,
	};
}
