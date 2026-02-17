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

import {VOICE_CALL_FULLSCREEN_ENABLED} from '@app/components/voice/VoiceCallFullscreenFeatureFlag';
import {Logger} from '@app/lib/Logger';
import {
	getExtendedDocument,
	supportsMozRequestFullScreen,
	supportsMsRequestFullscreen,
	supportsWebkitRequestFullscreen,
} from '@app/types/Browser';
import type {ExtendedHTMLElement} from '@app/types/browser.d';
import type {RefObject} from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

const logger = new Logger('useVoiceCallAppFullscreen');

interface UseVoiceCallAppFullscreenOptions {
	containerRef: RefObject<HTMLElement | null> | RefObject<HTMLElement>;
}

interface UseVoiceCallAppFullscreenReturn {
	isFullscreen: boolean;
	supportsFullscreen: boolean;
	enterFullscreen: () => Promise<void>;
	exitFullscreen: () => Promise<void>;
	toggleFullscreen: () => Promise<void>;
}

function getFullscreenElement(): Element | null {
	const doc = getExtendedDocument();
	return (
		document.fullscreenElement ||
		doc.webkitFullscreenElement ||
		doc.mozFullScreenElement ||
		doc.msFullscreenElement ||
		null
	);
}

function supportsFullscreenAPI(): boolean {
	const doc = getExtendedDocument();
	return !!(
		document.fullscreenEnabled ||
		doc.webkitFullscreenEnabled ||
		doc.mozFullScreenEnabled ||
		doc.msFullscreenEnabled
	);
}

async function requestFullscreen(element: HTMLElement): Promise<void> {
	if (element.requestFullscreen) {
		await element.requestFullscreen();
		return;
	}

	if (supportsWebkitRequestFullscreen(element)) {
		const extendedElement = element as ExtendedHTMLElement;
		await extendedElement.webkitRequestFullscreen!();
		return;
	}

	if (supportsMozRequestFullScreen(element)) {
		const extendedElement = element as ExtendedHTMLElement;
		await extendedElement.mozRequestFullScreen!();
		return;
	}

	if (supportsMsRequestFullscreen(element)) {
		const extendedElement = element as ExtendedHTMLElement;
		await extendedElement.msRequestFullscreen!();
	}
}

async function exitFullscreenAPI(): Promise<void> {
	const doc = getExtendedDocument();
	if (document.exitFullscreen) {
		await document.exitFullscreen();
		return;
	}

	if (doc.webkitExitFullscreen) {
		await doc.webkitExitFullscreen();
		return;
	}

	if (doc.mozCancelFullScreen) {
		await doc.mozCancelFullScreen();
		return;
	}

	if (doc.msExitFullscreen) {
		await doc.msExitFullscreen();
	}
}

const VOICE_CALL_FULLSCREEN_ATTR = 'data-voice-call-fullscreen';

export function useVoiceCallAppFullscreen(options: UseVoiceCallAppFullscreenOptions): UseVoiceCallAppFullscreenReturn {
	const {containerRef} = options;
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [supportsFullscreen] = useState(() => VOICE_CALL_FULLSCREEN_ENABLED && supportsFullscreenAPI());
	const initiatedFullscreenRef = useRef(false);

	const handleFullscreenChange = useCallback(() => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) {
			setIsFullscreen(false);
			initiatedFullscreenRef.current = false;
			document.documentElement.removeAttribute(VOICE_CALL_FULLSCREEN_ATTR);
			return;
		}

		const fullscreenElement = getFullscreenElement();
		if (!fullscreenElement) {
			setIsFullscreen(false);
			initiatedFullscreenRef.current = false;
			document.documentElement.removeAttribute(VOICE_CALL_FULLSCREEN_ATTR);
			return;
		}
		const isDocumentFullscreen = fullscreenElement === document.documentElement;
		const active = initiatedFullscreenRef.current && isDocumentFullscreen;
		setIsFullscreen(active);
		if (!active) {
			document.documentElement.removeAttribute(VOICE_CALL_FULLSCREEN_ATTR);
		}
	}, []);

	useEffect(() => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('MSFullscreenChange', handleFullscreenChange);
		handleFullscreenChange();

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
		};
	}, [handleFullscreenChange]);

	const enterFullscreen = useCallback(async () => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;
		if (!supportsFullscreenAPI()) return;
		if (!containerRef.current) return;

		const fullscreenElement = getFullscreenElement();
		if (fullscreenElement === document.documentElement && initiatedFullscreenRef.current) {
			setIsFullscreen(true);
			return;
		}

		try {
			initiatedFullscreenRef.current = true;
			await requestFullscreen(document.documentElement);
			document.documentElement.setAttribute(VOICE_CALL_FULLSCREEN_ATTR, 'true');
			setIsFullscreen(true);
		} catch (error) {
			initiatedFullscreenRef.current = false;
			document.documentElement.removeAttribute(VOICE_CALL_FULLSCREEN_ATTR);
			logger.error('Failed to enter voice call view fullscreen:', error);
		}
	}, [containerRef]);

	const exitFullscreen = useCallback(async () => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;

		const fullscreenElement = getFullscreenElement();
		if (!fullscreenElement) {
			setIsFullscreen(false);
			return;
		}

		try {
			await exitFullscreenAPI();
		} catch (error) {
			logger.error('Failed to exit voice call view fullscreen:', error);
		} finally {
			setIsFullscreen(false);
		}
	}, []);

	const toggleFullscreen = useCallback(async () => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;

		if (isFullscreen) {
			await exitFullscreen();
			return;
		}
		await enterFullscreen();
	}, [enterFullscreen, exitFullscreen, isFullscreen]);

	useEffect(() => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;

		return () => {
			if (!initiatedFullscreenRef.current || getFullscreenElement() !== document.documentElement) {
				return;
			}

			void exitFullscreen();
		};
	}, [exitFullscreen]);

	return {
		isFullscreen,
		supportsFullscreen,
		enterFullscreen,
		exitFullscreen,
		toggleFullscreen,
	};
}
