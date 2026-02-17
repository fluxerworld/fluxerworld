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
import {type ConfigObject, isPlainObject} from '@fluxer/config/src/config_loader/ConfigObjectMerge';
import {assertValidJsonConfig} from '@fluxer/config/src/JsonValidation';

export function loadJsonFile(path: string): ConfigObject {
	if (!existsSync(path)) {
		throw new Error(`Config file not found: ${path}`);
	}
	const content = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(content);
	if (!isPlainObject(parsed)) {
		throw new Error(`Invalid JSON: expected object at root`);
	}
	assertValidJsonConfig(parsed);
	return parsed;
}
