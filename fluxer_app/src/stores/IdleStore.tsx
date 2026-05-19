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

import LocalPresenceStore from '@app/stores/LocalPresenceStore';
import PrivacyPreferencesStore from '@app/stores/PrivacyPreferencesStore';
import {makeAutoObservable} from 'mobx';

const IDLE_CHECK_INTERVAL_MS = 1000 * 15;

class IdleStore {
	idle = false;

	private lastActivityTime = Date.now();

	private checkInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.startIdleCheck();
	}

	private startIdleCheck(): void {
		if (typeof setInterval !== 'function') return;

		this.checkInterval = setInterval(() => {
			this.updateIdleState();
		}, IDLE_CHECK_INTERVAL_MS);
	}

	destroy(): void {
		if (this.checkInterval !== null) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
	}

	recordActivity(): void {
		this.lastActivityTime = Date.now();

		if (this.idle) {
			this.updateIdleState();
		}
	}

	markBackground(): void {
		this.lastActivityTime = 0;
		this.updateIdleState();
	}

	isIdle(): boolean {
		return this.idle;
	}

	getIdleSince(): number {
		return this.idle ? this.lastActivityTime : 0;
	}

	private updateIdleState(): void {
		const timeoutMinutes = PrivacyPreferencesStore.getIdleTimeoutMinutes();
		// 0 minutes = user disabled auto-idle entirely
		const shouldBeIdle =
			timeoutMinutes > 0 && Date.now() - this.lastActivityTime >= timeoutMinutes * 60 * 1000;
		if (shouldBeIdle !== this.idle) {
			this.idle = shouldBeIdle;
			LocalPresenceStore.updatePresence();
		}
	}
}

export default new IdleStore();
