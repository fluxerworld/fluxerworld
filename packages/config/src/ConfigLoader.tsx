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

import {existsSync} from 'node:fs';
import {deepMerge} from '@fluxer/config/src/config_loader/ConfigObjectMerge';
import {buildEnvOverrides} from '@fluxer/config/src/config_loader/EnvironmentOverrides';
import {loadJsonFile} from '@fluxer/config/src/config_loader/JsonConfigReader';
import {deriveEndpointsFromDomain} from '@fluxer/config/src/EndpointDerivation';
import {type MasterConfig, MasterConfigSchema} from '@fluxer/config/src/MasterZodSchema.generated';

const DEFAULT_CONFIG_PATHS = [process.env['FLUXER_CONFIG']].filter((path): path is string => Boolean(path));

let cachedConfig: MasterConfig | null = null;

export async function loadConfig(configPaths: Array<string> = DEFAULT_CONFIG_PATHS): Promise<MasterConfig> {
	if (cachedConfig) {
		return cachedConfig;
	}

	if (configPaths.length === 0) {
		throw new Error('FLUXER_CONFIG must be set to a JSON config path.');
	}

	const configPath = configPaths.find((path) => existsSync(path));

	if (!configPath) {
		throw new Error(`No config file found. Checked FLUXER_CONFIG paths: ${configPaths.join(', ')}`);
	}

	const raw = loadJsonFile(configPath);
	const envOverrides = buildEnvOverrides(process.env, 'FLUXER_CONFIG__');
	const merged = deepMerge(raw, envOverrides);
	delete merged['$schema'];

	const parsedConfig = MasterConfigSchema.parse(merged);
	const derived = deriveEndpointsFromDomain(parsedConfig.domain);
	const overrides = parsedConfig.endpoint_overrides ?? {};
	const endpoints = {...derived, ...overrides};

	cachedConfig = {...parsedConfig, endpoints} as MasterConfig;
	return cachedConfig;
}

export function getConfig(): MasterConfig {
	if (!cachedConfig) {
		throw new Error('Config not loaded. Call loadConfig() first.');
	}
	return cachedConfig;
}

export function resetConfig(): void {
	cachedConfig = null;
}
