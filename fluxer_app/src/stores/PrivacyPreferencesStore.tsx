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

import {makePersistent} from '@app/lib/MobXPersistence';
import {makeAutoObservable} from 'mobx';

// 0 disables the auto-idle transition entirely (status stays online no
// matter how long since the last input event). The non-zero choices match
// the radio group in CommunicationTab so the persisted value is always one
// of the rendered options — no edge cases where a saved-but-no-longer-
// shown value lingers.
export const IDLE_TIMEOUT_CHOICES_MIN = [0, 5, 10, 15, 30, 60] as const;
export type IdleTimeoutChoice = (typeof IDLE_TIMEOUT_CHOICES_MIN)[number];
const DEFAULT_IDLE_TIMEOUT_MIN: IdleTimeoutChoice = 5;

class PrivacyPreferencesStore {
	disableStreamPreviews = false;
	showActiveNow = true;
	idleTimeoutMinutes: IdleTimeoutChoice = DEFAULT_IDLE_TIMEOUT_MIN;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'PrivacyPreferencesStore', [
			'disableStreamPreviews',
			'showActiveNow',
			'idleTimeoutMinutes',
		]);
	}

	getDisableStreamPreviews(): boolean {
		return this.disableStreamPreviews;
	}

	getShowActiveNow(): boolean {
		return this.showActiveNow;
	}

	getIdleTimeoutMinutes(): IdleTimeoutChoice {
		// Guard against an old persisted value that's no longer in the
		// allowed set (e.g., we removed a choice in a later release).
		if ((IDLE_TIMEOUT_CHOICES_MIN as ReadonlyArray<number>).includes(this.idleTimeoutMinutes)) {
			return this.idleTimeoutMinutes;
		}
		return DEFAULT_IDLE_TIMEOUT_MIN;
	}

	setDisableStreamPreviews(value: boolean): void {
		this.disableStreamPreviews = value;
	}

	setShowActiveNow(value: boolean): void {
		this.showActiveNow = value;
	}

	setIdleTimeoutMinutes(value: IdleTimeoutChoice): void {
		this.idleTimeoutMinutes = value;
	}
}

export default new PrivacyPreferencesStore();
