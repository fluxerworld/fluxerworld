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

import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import ThemeStore from '@app/stores/ThemeStore';
import type {ThemeType} from '@fluxer/constants/src/UserConstants';
import {ThemeTypes} from '@fluxer/constants/src/UserConstants';

export function updateThemePreference(theme: ThemeType): void {
	if (theme === ThemeTypes.SYSTEM) {
		ThemeStore.setSyncAcrossDevices(false);
		ThemeStore.setTheme(theme);
		return;
	}

	if (ThemeStore.syncAcrossDevices) {
		void UserSettingsActionCreators.update({theme});
	} else {
		ThemeStore.setTheme(theme);
	}
}

export function setSyncAcrossDevices(sync: boolean): void {
	if (sync) {
		ThemeStore.setSyncAcrossDevices(true);
	} else {
		ThemeStore.setSyncAcrossDevices(false);
	}
}
