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

import {Logger} from '@app/lib/Logger';
import WindowStore from '@app/stores/WindowStore';
import {autorun} from 'mobx';
import type React from 'react';
import {useEffect, useRef, useState} from 'react';

const logger = new Logger('OwnStreamPreviewState');

interface OwnStreamHiddenStateOptions {
	isOwnContent: boolean;
	isScreenShare: boolean;
	showMyOwnCamera: boolean;
	showMyOwnScreenShare: boolean;
}

interface OwnStreamHiddenState {
	isOwnScreenShareHidden: boolean;
	isOwnCameraHidden: boolean;
}

export function getOwnStreamHiddenState({
	isOwnContent,
	isScreenShare,
	showMyOwnCamera,
	showMyOwnScreenShare,
}: OwnStreamHiddenStateOptions): OwnStreamHiddenState {
	return {
		isOwnScreenShareHidden: isOwnContent && isScreenShare && !showMyOwnScreenShare,
		isOwnCameraHidden: isOwnContent && !isScreenShare && !showMyOwnCamera,
	};
}

interface OwnScreenSharePreviewStateOptions {
	isOwnScreenShare: boolean;
	pausePreviewOnUnfocus: boolean;
	isWindowFocused: boolean;
	videoRef: React.RefObject<HTMLVideoElement | null>;
}

interface OwnScreenSharePreviewState {
	frozenFrameUrl: string | null;
	isPreviewPaused: boolean;
	isOwnStreamPreviewPaused: boolean;
	shouldHideOwnScreenShareVideo: boolean;
}

export function useOwnScreenSharePreviewState({
	isOwnScreenShare,
	pausePreviewOnUnfocus,
	isWindowFocused,
	videoRef,
}: OwnScreenSharePreviewStateOptions): OwnScreenSharePreviewState {
	const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
	const [isPreviewPaused, setPreviewPaused] = useState(false);
	const prevWindowFocusedRef = useRef(isWindowFocused);

	useEffect(() => {
		if (!isOwnScreenShare || !pausePreviewOnUnfocus) {
			if (isPreviewPaused) setPreviewPaused(false);
			if (frozenFrameUrl) setFrozenFrameUrl(null);
			prevWindowFocusedRef.current = isWindowFocused;
			return;
		}

		const wasFocused = prevWindowFocusedRef.current;
		prevWindowFocusedRef.current = isWindowFocused;

		if (wasFocused && !isWindowFocused) {
			const videoEl = videoRef.current;
			if (videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
				try {
					const canvas = document.createElement('canvas');
					canvas.width = videoEl.videoWidth;
					canvas.height = videoEl.videoHeight;
					const ctx = canvas.getContext('2d');
					if (ctx) {
						ctx.drawImage(videoEl, 0, 0);
						const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
						setFrozenFrameUrl(dataUrl);
					}
				} catch (err) {
					logger.error('Failed to capture frozen frame', err);
				}
			} else {
				logger.warn('Screen share preview frame not ready for capture');
			}
			setPreviewPaused(true);
		} else if (!wasFocused && isWindowFocused) {
			setPreviewPaused(false);
			setFrozenFrameUrl(null);
		}
	}, [isOwnScreenShare, pausePreviewOnUnfocus, isWindowFocused, frozenFrameUrl, isPreviewPaused, videoRef]);

	const isOwnStreamPreviewPaused = isOwnScreenShare && pausePreviewOnUnfocus && !isWindowFocused;
	const shouldHideOwnScreenShareVideo = isOwnScreenShare && isPreviewPaused;

	return {frozenFrameUrl, isPreviewPaused, isOwnStreamPreviewPaused, shouldHideOwnScreenShareVideo};
}

export function useWindowFocus(): boolean {
	const [isFocused, setIsFocused] = useState(() => WindowStore.isFocused());

	useEffect(() => {
		const disposer = autorun(() => {
			setIsFocused(WindowStore.isFocused());
		});
		return () => disposer();
	}, []);

	return isFocused;
}
