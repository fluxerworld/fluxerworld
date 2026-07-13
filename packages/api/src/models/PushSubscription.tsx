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
import type {PushSubscriptionRow} from '@fluxer/api/src/database/types/UserTypes';

export type PushType = 'web' | 'expo' | 'fcm' | 'apns';

export class PushSubscription {
	readonly userId: UserID;
	readonly subscriptionId: string;
	readonly endpoint: string;
	readonly p256dhKey: string;
	readonly authKey: string;
	readonly userAgent: string | null;
	readonly pushType: PushType;
	readonly expoToken: string | null;
	readonly deviceToken: string | null;

	constructor(row: PushSubscriptionRow) {
		this.userId = row.user_id;
		this.subscriptionId = row.subscription_id;
		this.endpoint = row.endpoint;
		this.p256dhKey = row.p256dh_key;
		this.authKey = row.auth_key;
		this.userAgent = row.user_agent ?? null;
		this.pushType = (row.push_type as PushType) ?? 'web';
		this.expoToken = row.expo_token ?? null;
		this.deviceToken = row.device_token ?? null;
	}

	toRow(): PushSubscriptionRow {
		return {
			user_id: this.userId,
			subscription_id: this.subscriptionId,
			endpoint: this.endpoint,
			p256dh_key: this.p256dhKey,
			auth_key: this.authKey,
			user_agent: this.userAgent,
			push_type: this.pushType,
			expo_token: this.expoToken,
			device_token: this.deviceToken,
		};
	}
}
