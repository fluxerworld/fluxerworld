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

import AccessibilityStore from '@app/stores/AccessibilityStore';

const DEFAULT_MAX_LENGTH = 200;
const URL_PATTERN = /https?:\/\/([^/\s]+)[^\s]*/g;

const synthesisSupported = window.speechSynthesis != null;

export function isSupported(): boolean {
	return synthesisSupported;
}

function stripUrlsToDomain(text: string): string {
	return text.replace(URL_PATTERN, (_match, domain) => domain);
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	const truncated = text.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');

	if (lastSpace > maxLength * 0.5) {
		return truncated.slice(0, lastSpace);
	}

	return truncated;
}

function normaliseText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function createUtterance(text: string, maxLength: number = DEFAULT_MAX_LENGTH): SpeechSynthesisUtterance | null {
	if (!synthesisSupported) {
		return null;
	}

	let processed = stripUrlsToDomain(text);
	processed = normaliseText(processed);

	if (!processed) {
		return null;
	}

	processed = truncateAtWordBoundary(processed, maxLength);

	const utterance = new SpeechSynthesisUtterance(processed);
	utterance.rate = AccessibilityStore.ttsRate;

	return utterance;
}

export function speak(utterance: SpeechSynthesisUtterance, voice: SpeechSynthesisVoice | null): void {
	if (!synthesisSupported) {
		return;
	}

	if (voice) {
		utterance.voice = voice;
	}

	window.speechSynthesis.speak(utterance);
}

export function cancel(): void {
	if (!synthesisSupported) {
		return;
	}

	window.speechSynthesis.cancel();
}

export function getVoices(): Array<SpeechSynthesisVoice> {
	if (!synthesisSupported) {
		return [];
	}

	return window.speechSynthesis.getVoices();
}
