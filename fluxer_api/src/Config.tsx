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

import {buildAPIConfigFromMaster} from '@fluxer/api/src/Config';
import type {APIConfig} from '@fluxer/api/src/config/APIConfig';
import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import type {SentryConfig, TelemetryConfig} from '@fluxer/config/src/MasterZodSchema';

const master = await loadConfig();

const apiConfig = buildAPIConfigFromMaster(master);

export interface ExtendedAPIConfig extends APIConfig {
	env: string;
	telemetry: TelemetryConfig;
	sentry: SentryConfig;
}

export const Config: ExtendedAPIConfig = {
	env: master.env,
	...apiConfig,
	telemetry: master.telemetry,
	sentry: master.sentry,
};

export type Config = typeof Config;
