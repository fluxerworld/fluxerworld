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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {User} from '@fluxer/api/src/models/User';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {ms, seconds} from 'itty-time';

export class UserDeletionEligibilityService {
	private readonly INACTIVITY_WARNING_TTL_DAYS = 30;
	private readonly INACTIVITY_WARNING_PREFIX = 'inactivity_warning_sent';

	constructor(private kvClient: IKVProvider) {}

	async isEligibleForInactivityDeletion(user: User): Promise<boolean> {
		if (user.isBot) {
			return false;
		}

		if (user.isSystem) {
			return false;
		}

		if (this.isAppStoreReviewer(user)) {
			return false;
		}

		if (user.pendingDeletionAt !== null) {
			return false;
		}

		if (user.lastActiveAt === null) {
			return false;
		}

		const inactivityThresholdMs = this.getInactivityThresholdMs();
		const timeSinceLastActiveMs = Date.now() - user.lastActiveAt.getTime();

		if (timeSinceLastActiveMs < inactivityThresholdMs) {
			return false;
		}

		return true;
	}

	async isEligibleForWarningEmail(user: User): Promise<boolean> {
		const isEligibleForDeletion = await this.isEligibleForInactivityDeletion(user);
		if (!isEligibleForDeletion) {
			return false;
		}

		const alreadySentWarning = await this.hasWarningSent(user.id);
		if (alreadySentWarning) {
			return false;
		}

		return true;
	}

	async markWarningSent(userId: UserID): Promise<void> {
		const key = this.getWarningKey(userId);
		const ttlSeconds = seconds(`${this.INACTIVITY_WARNING_TTL_DAYS + 5} days`);
		const timestamp = Date.now().toString();

		await this.kvClient.setex(key, ttlSeconds, timestamp);
	}

	async hasWarningSent(userId: UserID): Promise<boolean> {
		const key = this.getWarningKey(userId);
		const exists = await this.kvClient.exists(key);
		return exists === 1;
	}

	async getWarningSentTimestamp(userId: UserID): Promise<number | null> {
		const key = this.getWarningKey(userId);
		const value = await this.kvClient.get(key);
		if (!value) {
			return null;
		}
		const timestamp = parseInt(value, 10);
		return Number.isNaN(timestamp) ? null : timestamp;
	}

	async hasWarningGracePeriodExpired(userId: UserID): Promise<boolean> {
		const timestamp = await this.getWarningSentTimestamp(userId);
		if (timestamp === null) {
			return false;
		}

		const timeSinceWarningMs = Date.now() - timestamp;
		const gracePeriodMs = this.INACTIVITY_WARNING_TTL_DAYS * ms('1 day');

		return timeSinceWarningMs >= gracePeriodMs;
	}

	private getInactivityThresholdMs(): number {
		const thresholdDays = Config.inactivityDeletionThresholdDays ?? 365 * 2;
		return thresholdDays * ms('1 day');
	}

	private getWarningKey(userId: UserID): string {
		return `${this.INACTIVITY_WARNING_PREFIX}:${userId}`;
	}

	private isAppStoreReviewer(user: User): boolean {
		return (user.flags & UserFlags.APP_STORE_REVIEWER) !== 0n;
	}
}
