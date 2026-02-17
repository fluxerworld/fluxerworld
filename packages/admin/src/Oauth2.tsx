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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {IOAuth2Client} from '@fluxer/oauth2/src/client/IOAuth2Client';
import {createOAuth2Client} from '@fluxer/oauth2/src/client/OAuth2Client';
import type {OAuth2ClientConfig} from '@fluxer/oauth2/src/config/OAuth2ClientConfig';

const ADMIN_OAUTH_SCOPE = 'identify email admin';

export function createAdminOAuth2Client(config: Config): IOAuth2Client {
	const oauth2Config: OAuth2ClientConfig = {
		clientId: config.oauthClientId,
		clientSecret: config.oauthClientSecret,
		redirectUri: config.oauthRedirectUri,
		scope: ADMIN_OAUTH_SCOPE,
		endpoints: {
			authorizeEndpoint: `${config.webAppEndpoint}/oauth2/authorize`,
			tokenEndpoint: `${config.apiEndpoint}/oauth2/token`,
			userInfoEndpoint: `${config.apiEndpoint}/users/@me`,
			revokeEndpoint: `${config.apiEndpoint}/oauth2/revoke`,
		},
	};

	return createOAuth2Client(oauth2Config);
}
