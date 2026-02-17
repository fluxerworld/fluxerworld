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

import {
	getFiniteTimeWindowPresets,
	minutesToMs,
	TIME_WINDOW_FOR_LABEL_MESSAGES,
	type TimeWindowKey,
	type TimeWindowPreset,
} from '@app/constants/TimeWindowPresets';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export interface MuteDurationOption {
	label: string;
	value: number | null;
}

interface MuteDurationOptionDescriptor {
	label: MessageDescriptor;
	value: number | null;
}

const FINITE_MUTE_DURATION_DESCRIPTORS: ReadonlyArray<MuteDurationOptionDescriptor> = getFiniteTimeWindowPresets({
	includeDeveloperOptions: false,
}).map((preset: TimeWindowPreset) => {
	const key = preset.key as Exclude<TimeWindowKey, 'never'>;
	return {
		label: TIME_WINDOW_FOR_LABEL_MESSAGES[key],
		value: minutesToMs(preset.minutes),
	};
});

const INDEFINITE_MUTE_DURATION_DESCRIPTOR: MuteDurationOptionDescriptor = {
	label: msg`Until I turn it back on`,
	value: null,
};

const MUTE_DURATION_OPTION_DESCRIPTORS: ReadonlyArray<MuteDurationOptionDescriptor> = [
	...FINITE_MUTE_DURATION_DESCRIPTORS,
	INDEFINITE_MUTE_DURATION_DESCRIPTOR,
];

export const getMuteDurationOptions = (i18n: I18n): Array<MuteDurationOption> => {
	return MUTE_DURATION_OPTION_DESCRIPTORS.map((opt) => ({
		...opt,
		label: i18n._(opt.label),
	}));
};

export const createMuteConfig = (value: number | null) =>
	value == null
		? null
		: {
				selected_time_window: value,
				end_time: new Date(Date.now() + value).toISOString(),
			};
