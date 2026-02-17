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

import type {I18nConfig} from '@fluxer/i18n/src/runtime/I18nTypes';

export function buildTemplates<TKey extends string, TValue, TVariables>(
	record: Record<string, unknown>,
	config: I18nConfig<TKey, TValue, TVariables>,
	filePath: string,
): Map<TKey, TValue> {
	const templates = new Map<TKey, TValue>();

	for (const [key, value] of Object.entries(record)) {
		const template = config.parseTemplate(value, key);
		if (template !== null) {
			templates.set(key as TKey, template);
		} else {
			config.onWarning?.(`Skipping invalid template in ${filePath}: ${key}`);
		}
	}

	return templates;
}
