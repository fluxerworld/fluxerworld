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

import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const BASE_PRESETS = [
	{key: '15m', minutes: 15},
	{key: '30m', minutes: 30},
	{key: '1h', minutes: 60},
	{key: '3h', minutes: 3 * 60},
	{key: '4h', minutes: 4 * 60},
	{key: '8h', minutes: 8 * 60},
	{key: '24h', minutes: 24 * 60},
	{key: '3d', minutes: 3 * 24 * 60},
	{key: 'never', minutes: null},
] as const;

const DEVELOPER_PRESETS = [{key: '10s', minutes: 10 / 60}] as const;
const ALL_PRESETS = [...BASE_PRESETS, ...DEVELOPER_PRESETS] as const;

const BASE_TIME_WINDOW_KEYS: ReadonlyArray<(typeof BASE_PRESETS)[number]['key']> = BASE_PRESETS.map(
	(preset) => preset.key,
);
const DEVELOPER_TIME_WINDOW_KEYS: ReadonlyArray<(typeof DEVELOPER_PRESETS)[number]['key']> = DEVELOPER_PRESETS.map(
	(preset) => preset.key,
);

export type TimeWindowKey = (typeof ALL_PRESETS)[number]['key'];
export type TimeWindowPreset = (typeof ALL_PRESETS)[number];

const PRESET_MAP = new Map<TimeWindowKey, TimeWindowPreset>(ALL_PRESETS.map((preset) => [preset.key, preset]));

export const TIME_WINDOW_PRESETS: ReadonlyArray<TimeWindowPreset> = BASE_PRESETS;
export const DEFAULT_TIME_WINDOW_KEY: TimeWindowKey = '24h';

export const TIME_WINDOW_LABEL_MESSAGES: Record<TimeWindowKey, MessageDescriptor> = {
	'10s': msg`10 seconds`,
	'15m': msg`15 minutes`,
	'30m': msg`30 minutes`,
	'1h': msg`1 hour`,
	'3h': msg`3 hours`,
	'4h': msg`4 hours`,
	'8h': msg`8 hours`,
	'24h': msg`24 hours`,
	'3d': msg`3 days`,
	never: msg`Don't clear`,
};

export const TIME_WINDOW_FOR_LABEL_MESSAGES: Record<Exclude<TimeWindowKey, 'never'>, MessageDescriptor> = {
	'10s': msg`For 10 seconds`,
	'15m': msg`For 15 minutes`,
	'30m': msg`For 30 minutes`,
	'1h': msg`For 1 hour`,
	'3h': msg`For 3 hours`,
	'4h': msg`For 4 hours`,
	'8h': msg`For 8 hours`,
	'24h': msg`For 24 hours`,
	'3d': msg`For 3 days`,
};

export const minutesToMs = (minutes: number | null): number | null => (minutes == null ? null : minutes * 60 * 1000);

export const getTimeWindowPreset = (key: TimeWindowKey): TimeWindowPreset | undefined => PRESET_MAP.get(key);

const getTimeWindowKeys = (includeDeveloperOptions: boolean): ReadonlyArray<TimeWindowKey> => {
	if (!includeDeveloperOptions) return BASE_TIME_WINDOW_KEYS;
	return [...DEVELOPER_TIME_WINDOW_KEYS, ...BASE_TIME_WINDOW_KEYS];
};

export const createTimeWindowOptionList = (keys: ReadonlyArray<TimeWindowKey>): ReadonlyArray<TimeWindowPreset> => {
	const list = keys.map((key) => {
		const preset = PRESET_MAP.get(key);
		if (!preset) {
			throw new Error(`Unknown time window key: ${key}`);
		}
		return preset;
	});

	const neverIndex = list.findIndex((preset) => preset.key === 'never');
	if (neverIndex <= 0) return list;

	const neverPreset = list[neverIndex];
	const withoutNever = list.filter((_, index) => index !== neverIndex);
	return [neverPreset, ...withoutNever];
};

export const getTimeWindowPresets = (options?: {
	includeDeveloperOptions?: boolean;
	includeNever?: boolean;
}): ReadonlyArray<TimeWindowPreset> => {
	const includeDeveloperOptions = options?.includeDeveloperOptions ?? DeveloperModeStore.isDeveloper;
	const includeNever = options?.includeNever ?? true;
	const keys = getTimeWindowKeys(includeDeveloperOptions);
	const filteredKeys = includeNever ? keys : keys.filter((key) => key !== 'never');
	return createTimeWindowOptionList(filteredKeys);
};

export const getFiniteTimeWindowPresets = (options?: {
	includeDeveloperOptions?: boolean;
}): ReadonlyArray<TimeWindowPreset> =>
	getTimeWindowPresets({includeDeveloperOptions: options?.includeDeveloperOptions, includeNever: false});
