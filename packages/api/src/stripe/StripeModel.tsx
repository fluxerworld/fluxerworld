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

import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {GiftCode} from '@fluxer/api/src/models/GiftCode';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import type {GiftCodeMetadataResponse, GiftCodeResponse} from '@fluxer/schema/src/domains/premium/GiftCodeSchemas';

interface MapGiftCodeToResponseParams {
	giftCode: GiftCode;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
	includeCreator?: boolean;
}

interface MapGiftCodeToMetadataResponseParams {
	giftCode: GiftCode;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}

export async function mapGiftCodeToResponse({
	giftCode,
	userCacheService,
	requestCache,
	includeCreator = false,
}: MapGiftCodeToResponseParams): Promise<GiftCodeResponse> {
	let createdBy = null;
	if (includeCreator) {
		createdBy = await getCachedUserPartialResponse({
			userId: giftCode.createdByUserId,
			userCacheService,
			requestCache,
		});
	}

	return {
		code: giftCode.code,
		duration_months: giftCode.durationMonths,
		redeemed: !!giftCode.redeemedAt,
		created_by: createdBy,
	};
}

export async function mapGiftCodeToMetadataResponse({
	giftCode,
	userCacheService,
	requestCache,
}: MapGiftCodeToMetadataResponseParams): Promise<GiftCodeMetadataResponse> {
	const [createdBy, redeemedBy] = await Promise.all([
		getCachedUserPartialResponse({
			userId: giftCode.createdByUserId,
			userCacheService,
			requestCache,
		}),
		giftCode.redeemedByUserId
			? getCachedUserPartialResponse({
					userId: giftCode.redeemedByUserId,
					userCacheService,
					requestCache,
				})
			: null,
	]);

	return {
		code: giftCode.code,
		duration_months: giftCode.durationMonths,
		created_at: giftCode.createdAt.toISOString(),
		created_by: createdBy,
		redeemed_at: giftCode.redeemedAt?.toISOString() ?? null,
		redeemed_by: redeemedBy,
	};
}
