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

import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import {
	extractBaseServiceConfig,
	extractBuildInfoConfig,
	extractKVClientConfig,
	extractRateLimit,
} from '@fluxer/config/src/ServiceConfigSlices';
import {ADMIN_OAUTH2_APPLICATION_ID} from '@fluxer/constants/src/Core';

const master = await loadConfig();
const adminOAuthRedirectUri = `${master.endpoints.admin}/oauth2_callback`;

export const Config = {
	...extractBaseServiceConfig(master),
	...extractKVClientConfig(master),
	...extractBuildInfoConfig(),
	secretKeyBase: master.services.admin.secret_key_base,
	apiEndpoint: master.endpoints.api,
	mediaEndpoint: master.endpoints.media,
	staticCdnEndpoint: master.endpoints.static_cdn,
	adminEndpoint: master.endpoints.admin,
	webAppEndpoint: master.endpoints.app,
	oauthClientId: ADMIN_OAUTH2_APPLICATION_ID.toString(),
	oauthClientSecret: master.services.admin.oauth_client_secret,
	oauthRedirectUri: adminOAuthRedirectUri,
	port: master.services.admin.port,
	basePath: master.services.admin.base_path,
	selfHosted: master.instance.self_hosted,
	rateLimit: extractRateLimit(master.services.admin.rate_limit),
};

export type Config = typeof Config;
