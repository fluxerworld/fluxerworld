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

const master = await loadConfig();

if (!master.internal) {
	throw new Error('internal configuration is required for fluxer_server');
}

export const Config = {
	...master,
	internal: master.internal,
	port: master.services.server.port,
	host: master.services.server.host,
	deploymentMode: master.instance.deployment_mode,
	isMonolith: master.instance.deployment_mode === 'monolith',
	healthCheck: {
		latencyThresholdMs: 1000,
		rpcTimeoutMs: 30000,
	},
	proxy: {
		trust_cf_connecting_ip: master.proxy.trust_cf_connecting_ip,
	},
};

export type Config = typeof Config;
