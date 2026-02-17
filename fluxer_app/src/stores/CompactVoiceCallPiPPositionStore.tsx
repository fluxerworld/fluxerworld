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

interface CompactVoiceCallPiPPositionState {
	x: number;
	y: number;
}

const COMPACT_VOICE_CALL_PIP_POSITION_KEY = 'compact_voice_call_pip_position';
const DEFAULT_COMPACT_PIP_POSITION: CompactVoiceCallPiPPositionState = {
	x: 1,
	y: 0,
};

function clampNormalizedValue(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(0, Math.min(1, value));
}

function parseCompactVoiceCallPiPPosition(value: unknown): CompactVoiceCallPiPPositionState {
	if (typeof value !== 'object' || value == null || Array.isArray(value)) {
		return DEFAULT_COMPACT_PIP_POSITION;
	}
	const state = value as Record<string, unknown>;
	return {
		x: clampNormalizedValue(state.x, DEFAULT_COMPACT_PIP_POSITION.x),
		y: clampNormalizedValue(state.y, DEFAULT_COMPACT_PIP_POSITION.y),
	};
}

class CompactVoiceCallPiPPositionStore {
	x = DEFAULT_COMPACT_PIP_POSITION.x;
	y = DEFAULT_COMPACT_PIP_POSITION.y;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		const initialState = parseCompactVoiceCallPiPPosition(
			AppStorage.getJSON<unknown>(COMPACT_VOICE_CALL_PIP_POSITION_KEY),
		);
		this.x = initialState.x;
		this.y = initialState.y;
	}

	getPosition(): CompactVoiceCallPiPPositionState {
		return {
			x: this.x,
			y: this.y,
		};
	}

	setPosition(position: CompactVoiceCallPiPPositionState): void {
		this.x = clampNormalizedValue(position.x, DEFAULT_COMPACT_PIP_POSITION.x);
		this.y = clampNormalizedValue(position.y, DEFAULT_COMPACT_PIP_POSITION.y);
		AppStorage.setJSON(COMPACT_VOICE_CALL_PIP_POSITION_KEY, {
			x: this.x,
			y: this.y,
		});
	}
}

export default new CompactVoiceCallPiPPositionStore();
