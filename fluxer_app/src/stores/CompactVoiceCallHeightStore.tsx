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

import AppStorage from '@app/lib/AppStorage';
import {makeAutoObservable} from 'mobx';

interface CompactVoiceCallHeightState {
	defaultHeight: number | null;
	heightsByKey: Record<string, number>;
}

const COMPACT_VOICE_CALL_HEIGHT_STORAGE_KEY = 'compact_voice_call_heights';
const COMPACT_VOICE_CALL_HEIGHT_MIN = 320;
const COMPACT_VOICE_CALL_HEIGHT_MAX = 1049;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function clampCompactVoiceCallHeight(value: number): number {
	return Math.max(COMPACT_VOICE_CALL_HEIGHT_MIN, Math.min(Math.round(value), COMPACT_VOICE_CALL_HEIGHT_MAX));
}

function parseCompactVoiceCallHeight(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return clampCompactVoiceCallHeight(value);
}

function parseHeightMap(value: unknown): Record<string, number> {
	if (!isRecord(value)) {
		return {};
	}

	const result: Record<string, number> = {};
	for (const [key, rawHeight] of Object.entries(value)) {
		const parsed = parseCompactVoiceCallHeight(rawHeight);
		if (parsed == null) {
			continue;
		}
		result[key] = parsed;
	}
	return result;
}

function getInitialState(): CompactVoiceCallHeightState {
	const raw = AppStorage.getJSON<unknown>(COMPACT_VOICE_CALL_HEIGHT_STORAGE_KEY);
	if (!isRecord(raw)) {
		return {
			defaultHeight: null,
			heightsByKey: {},
		};
	}

	return {
		defaultHeight: parseCompactVoiceCallHeight(raw.defaultHeight),
		heightsByKey: parseHeightMap(raw.heightsByKey),
	};
}

class CompactVoiceCallHeightStore {
	defaultHeight: number | null = null;
	heightsByKey: Record<string, number> = {};

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		const initialState = getInitialState();
		this.defaultHeight = initialState.defaultHeight;
		this.heightsByKey = initialState.heightsByKey;
	}

	getStartingHeight(heightKey: string): number | null {
		return this.heightsByKey[heightKey] ?? this.defaultHeight;
	}

	setHeightForKey(heightKey: string, height: number): number {
		const normalizedHeight = clampCompactVoiceCallHeight(height);
		this.defaultHeight = normalizedHeight;
		this.heightsByKey = {
			...this.heightsByKey,
			[heightKey]: normalizedHeight,
		};
		this.persist();
		return normalizedHeight;
	}

	private persist(): void {
		const state: CompactVoiceCallHeightState = {
			defaultHeight: this.defaultHeight,
			heightsByKey: this.heightsByKey,
		};
		AppStorage.setJSON(COMPACT_VOICE_CALL_HEIGHT_STORAGE_KEY, state);
	}
}

export {COMPACT_VOICE_CALL_HEIGHT_MAX, COMPACT_VOICE_CALL_HEIGHT_MIN};
export default new CompactVoiceCallHeightStore();
