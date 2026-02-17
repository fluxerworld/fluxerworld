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

import type {OAuth2TokenResponse} from '@fluxer/oauth2/src/models/OAuth2TokenResponse';
import type {OAuth2UserInfo} from '@fluxer/oauth2/src/models/OAuth2UserInfo';

export interface IOAuth2Client {
	generateState(): string;
	createAuthorizationUrl(state: string): string;
	exchangeCodeForToken(code: string): Promise<OAuth2TokenResponse | null>;
	fetchCurrentUser(accessToken: string): Promise<OAuth2UserInfo | null>;
	revokeAccessToken(accessToken: string): Promise<void>;
}
