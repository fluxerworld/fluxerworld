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

import type {OpenAPIPathItem, OpenAPISchema} from '@fluxer/openapi/src/OpenAPITypes';

const OPENAPI_SCHEMA_REF_PATTERN = /#\/components\/schemas\/([A-Za-z0-9_]+)/;

export function collectReferencedSchemaNames(
	paths: Record<string, OpenAPIPathItem>,
	allSchemas: Record<string, OpenAPISchema>,
): Set<string> {
	const referenced = new Set<string>();

	function extractRefs(value: unknown): void {
		if (value == null || typeof value !== 'object') {
			return;
		}

		if ('$ref' in value && typeof (value as {$ref: string}).$ref === 'string') {
			const ref = (value as {$ref: string}).$ref;
			const match = ref.match(OPENAPI_SCHEMA_REF_PATTERN);

			if (match) {
				const schemaName = match[1];
				if (!referenced.has(schemaName)) {
					referenced.add(schemaName);
					if (allSchemas[schemaName]) {
						extractRefs(allSchemas[schemaName]);
					}
				}
			}
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				extractRefs(item);
			}
			return;
		}

		for (const nested of Object.values(value as Record<string, unknown>)) {
			extractRefs(nested);
		}
	}

	extractRefs(paths);
	referenced.add('Error');

	return referenced;
}
