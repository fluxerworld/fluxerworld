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

import type {User} from '@fluxer/api/src/models/User';
import type {SearchableUser} from '@fluxer/schema/src/contracts/search/SearchDocumentTypes';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

export function convertToSearchableUser(user: User): SearchableUser {
	const createdAt = Math.floor(snowflakeToDate(BigInt(user.id)).getTime() / 1000);
	const lastActiveAt = user.lastActiveAt ? Math.floor(user.lastActiveAt.getTime() / 1000) : null;
	const tempBannedUntil = user.tempBannedUntil ? Math.floor(user.tempBannedUntil.getTime() / 1000) : null;
	const pendingDeletionAt = user.pendingDeletionAt ? Math.floor(user.pendingDeletionAt.getTime() / 1000) : null;

	return {
		id: user.id.toString(),
		username: user.username,
		discriminator: user.discriminator,
		email: user.email,
		phone: user.phone,
		isBot: user.isBot,
		isSystem: user.isSystem,
		flags: user.flags.toString(),
		premiumType: user.premiumType,
		emailVerified: user.emailVerified,
		emailBounced: user.emailBounced,
		suspiciousActivityFlags: user.suspiciousActivityFlags,
		acls: Array.from(user.acls),
		createdAt,
		lastActiveAt,
		tempBannedUntil,
		pendingDeletionAt,
		stripeSubscriptionId: user.stripeSubscriptionId,
		stripeCustomerId: user.stripeCustomerId,
	};
}
