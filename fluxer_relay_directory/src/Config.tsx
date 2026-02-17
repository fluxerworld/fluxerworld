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

import {existsSync, readFileSync} from 'node:fs';
import {deepMerge, isPlainObject} from '@fluxer/config/src/config_loader/ConfigObjectMerge';
import {buildEnvOverrides} from '@fluxer/config/src/config_loader/EnvironmentOverrides';
import {z} from 'zod';

export const BootstrapRelayConfigSchema = z.object({
	id: z.string(),
	url: z.url(),
	lat: z.number(),
	lon: z.number(),
	region: z.string(),
	capacity: z.number().int().positive(),
	public_key: z.string().optional(),
});

export type BootstrapRelayConfig = z.infer<typeof BootstrapRelayConfigSchema>;

const ServerSchema = z.object({
	host: z.string().default('0.0.0.0'),
	port: z.number().int().positive().default(8080),
});

const DatabaseSchema = z.object({
	path: z.string().default('./data/relays.db'),
});

const HealthCheckSchema = z.object({
	interval_ms: z.number().int().positive().default(30000),
	timeout_ms: z.number().int().positive().default(5000),
	unhealthy_threshold: z.number().int().positive().default(3),
});

const DirectoryConfigSchema = z.object({
	server: ServerSchema.default(() => ServerSchema.parse({})),
	database: DatabaseSchema.default(() => DatabaseSchema.parse({})),
	health_check: HealthCheckSchema.default(() => HealthCheckSchema.parse({})),
	bootstrap_relays: z.array(BootstrapRelayConfigSchema).default([]),
});

export type DirectoryConfig = z.infer<typeof DirectoryConfigSchema>;

const CONFIG_PATHS = [
	process.env['RELAY_DIRECTORY_CONFIG'],
	'./config/directory.json',
	'/etc/fluxer-relay-directory/directory.json',
].filter((path): path is string => Boolean(path));

const ENV_OVERRIDE_PREFIX = 'RELAY_DIRECTORY__';

function loadConfigFile(): Record<string, unknown> {
	for (const configPath of CONFIG_PATHS) {
		if (existsSync(configPath)) {
			const content = readFileSync(configPath, 'utf-8');
			const parsed = JSON.parse(content);
			if (isPlainObject(parsed)) {
				return parsed;
			}
		}
	}
	return {};
}

function loadDirectoryConfig(): DirectoryConfig {
	const fileConfig = loadConfigFile();
	const envOverrides = buildEnvOverrides(process.env, ENV_OVERRIDE_PREFIX);
	const merged = deepMerge(fileConfig, envOverrides);
	return DirectoryConfigSchema.parse(merged);
}

export const Config = loadDirectoryConfig();
export type Config = typeof Config;
