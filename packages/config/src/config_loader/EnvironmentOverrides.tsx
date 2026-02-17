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

import {type ConfigObject, isPlainObject} from '@fluxer/config/src/config_loader/ConfigObjectMerge';

function toChildObject(value: unknown): ConfigObject {
	if (isPlainObject(value)) {
		return value;
	}
	return {};
}

export function parseEnvValue(raw: string): unknown {
	const trimmed = raw.trim();
	if (trimmed === 'true') {
		return true;
	}
	if (trimmed === 'false') {
		return false;
	}
	if (/^-?\d+$/.test(trimmed)) {
		return Number.parseInt(trimmed, 10);
	}
	if (/^-?\d+\.\d+$/.test(trimmed)) {
		return Number.parseFloat(trimmed);
	}
	if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return raw;
		}
	}
	return raw;
}

export function setNestedValue(target: ConfigObject, keys: Array<string>, value: unknown): void {
	if (keys.length === 0) {
		return;
	}
	const [first, ...rest] = keys;
	if (rest.length === 0) {
		target[first] = value;
		return;
	}
	if (!isPlainObject(target[first])) {
		target[first] = {};
	}
	setNestedValue(toChildObject(target[first]), rest, value);
}

export function buildEnvOverrides(env: NodeJS.ProcessEnv, prefix: string): ConfigObject {
	const overrides: ConfigObject = {};
	for (const [envKey, envValue] of Object.entries(env)) {
		if (!envKey.startsWith(prefix) || envValue === undefined) {
			continue;
		}
		const remainder = envKey.slice(prefix.length);
		if (remainder === '') {
			continue;
		}
		const path = remainder.split('__').map((segment) => segment.toLowerCase());
		setNestedValue(overrides, path, parseEnvValue(envValue));
	}
	return overrides;
}
