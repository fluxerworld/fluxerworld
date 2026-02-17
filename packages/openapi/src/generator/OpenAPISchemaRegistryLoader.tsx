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

import {getRegisteredBitflagSchemas, getRegisteredInt32EnumSchemas} from '@fluxer/openapi/src/converters/ZodToOpenAPI';
import {OpenAPIGeneratorCatalog} from '@fluxer/openapi/src/generator/OpenAPIGeneratorCatalog';
import {type LoadedSchema, loadSchemas} from '@fluxer/openapi/src/registry/SchemaLoader';
import type {SchemaRegistry} from '@fluxer/openapi/src/registry/SchemaRegistry';
import {CustomSchemaType} from '@fluxer/openapi/src/schemas/CustomSchemaType';

export interface OpenAPISchemaRegistryLoadResult {
	readonly loadedSchemas: Map<string, LoadedSchema>;
	readonly totalRegisteredSchemas: number;
}

export async function loadSchemasIntoRegistry(
	basePath: string,
	schemaRegistry: SchemaRegistry,
): Promise<OpenAPISchemaRegistryLoadResult> {
	for (const [name, schema] of OpenAPIGeneratorCatalog.builtInSchemas) {
		schemaRegistry.register(name, schema);
	}

	for (const [name, schema] of Object.entries(CustomSchemaType.getAllSchemas())) {
		if (!schemaRegistry.has(name)) {
			schemaRegistry.register(name, schema);
		}
	}

	let loadedSchemas = new Map<string, LoadedSchema>();
	try {
		const dynamicSchemas = await loadSchemas(basePath);
		loadedSchemas = dynamicSchemas;
		for (const [name, schema] of dynamicSchemas) {
			if (!schemaRegistry.has(name)) {
				schemaRegistry.register(name, schema.openAPISchema);
			}
		}
	} catch (error) {
		console.warn('Warning: Could not load some schemas:', error);
	}

	for (const [name, schema] of Object.entries(getRegisteredBitflagSchemas())) {
		if (!schemaRegistry.has(name)) {
			schemaRegistry.register(name, schema);
		}
	}

	for (const [name, schema] of Object.entries(getRegisteredInt32EnumSchemas())) {
		if (!schemaRegistry.has(name)) {
			schemaRegistry.register(name, schema);
		}
	}

	return {
		loadedSchemas,
		totalRegisteredSchemas: Object.keys(schemaRegistry.getAllSchemas()).length,
	};
}
