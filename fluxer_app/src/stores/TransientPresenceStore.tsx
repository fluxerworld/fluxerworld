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

import PresenceStore from '@app/stores/PresenceStore';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {makeAutoObservable, observable, runInAction} from 'mobx';

const PRESENCE_TTL_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

interface TransientPresence {
	status: StatusType;
	timestamp: number;
}

class TransientPresenceStoreClass {
	presences = observable.map<string, TransientPresence>();
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.startCleanup();
	}

	private startCleanup(): void {
		if (this.cleanupInterval) return;
		this.cleanupInterval = setInterval(() => {
			this.pruneStale();
		}, CLEANUP_INTERVAL_MS);
	}

	private pruneStale(): void {
		const now = Date.now();
		runInAction(() => {
			for (const [userId, presence] of this.presences) {
				if (now - presence.timestamp > PRESENCE_TTL_MS) {
					this.presences.delete(userId);
				}
			}
		});
	}

	updatePresence(userId: string, status: StatusType): void {
		this.presences.set(userId, {
			status,
			timestamp: Date.now(),
		});
	}

	updatePresences(presences: Array<{userId: string; status: StatusType}>): void {
		runInAction(() => {
			const now = Date.now();
			for (const {userId, status} of presences) {
				this.presences.set(userId, {status, timestamp: now});
			}
		});
	}

	getStatus(userId: string): StatusType {
		const presenceStoreStatus = PresenceStore.getStatus(userId);
		if (presenceStoreStatus !== StatusTypes.OFFLINE) {
			return presenceStoreStatus;
		}

		const transient = this.presences.get(userId);
		if (transient && Date.now() - transient.timestamp <= PRESENCE_TTL_MS) {
			return transient.status;
		}

		return StatusTypes.OFFLINE;
	}

	getTransientStatus(userId: string): StatusType | null {
		const transient = this.presences.get(userId);
		if (transient && Date.now() - transient.timestamp <= PRESENCE_TTL_MS) {
			return transient.status;
		}
		return null;
	}

	hasTransientPresence(userId: string): boolean {
		const transient = this.presences.get(userId);
		return transient != null && Date.now() - transient.timestamp <= PRESENCE_TTL_MS;
	}

	clear(): void {
		this.presences.clear();
	}

	cleanup(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.presences.clear();
	}
}

export default new TransientPresenceStoreClass();
