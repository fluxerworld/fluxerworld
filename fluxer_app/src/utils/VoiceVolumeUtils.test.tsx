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

import {clampVoiceVolumePercent, voiceVolumePercentToTrackVolume} from '@app/utils/VoiceVolumeUtils';
import {describe, expect, test} from 'vitest';

describe('VoiceVolumeUtils', () => {
	describe('clampVoiceVolumePercent', () => {
		test('returns default value for non-finite input', () => {
			expect(clampVoiceVolumePercent(Number.NaN)).toBe(100);
		});

		test('clamps to lower bound', () => {
			expect(clampVoiceVolumePercent(-20)).toBe(0);
		});

		test('clamps to upper bound', () => {
			expect(clampVoiceVolumePercent(250)).toBe(200);
		});

		test('keeps values in range', () => {
			expect(clampVoiceVolumePercent(143.2)).toBe(143.2);
		});
	});

	describe('voiceVolumePercentToTrackVolume', () => {
		test('maps 100% to full track volume', () => {
			expect(voiceVolumePercentToTrackVolume(100)).toBe(1);
		});

		test('never exceeds 1 for boosted percentages', () => {
			expect(voiceVolumePercentToTrackVolume(142.867)).toBe(1);
		});

		test('maps invalid input to safe default', () => {
			expect(voiceVolumePercentToTrackVolume(Number.NaN)).toBe(1);
		});
	});
});
