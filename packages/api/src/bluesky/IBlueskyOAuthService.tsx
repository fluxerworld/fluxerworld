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

export interface BlueskyAuthorizeResult {
	authorizeUrl: string;
}

export interface BlueskyCallbackResult {
	userId: UserID;
	did: string;
	handle: string;
}

export interface IBlueskyOAuthService {
	readonly clientMetadata: Record<string, unknown>;
	readonly jwks: Record<string, unknown>;
	authorize(handle: string, userId: UserID): Promise<BlueskyAuthorizeResult>;
	callback(params: URLSearchParams): Promise<BlueskyCallbackResult>;
	restoreAndVerify(did: string): Promise<{handle: string} | null>;
	revoke(did: string): Promise<void>;
}
