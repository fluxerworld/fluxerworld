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

import type {OpenAPIRef, OpenAPISchema} from '@fluxer/openapi/src/Types';
import type {ZodTypeAny} from 'zod';

const FLUXER_CUSTOM_TYPE_KEY = '__fluxer_custom_type__';

export interface CustomSchemaTypeConfig<TName extends string = string> {
	readonly name: TName;
	readonly zodSchema: ZodTypeAny;
	readonly openApiSchema: OpenAPISchema;
}

const registry = new Map<string, CustomSchemaType>();

export class CustomSchemaType<TName extends string = string> {
	public readonly name: TName;
	public readonly zodSchema: ZodTypeAny;
	public readonly openApiSchema: OpenAPISchema;
	public readonly ref: OpenAPIRef;

	constructor(config: CustomSchemaTypeConfig<TName>) {
		this.name = config.name;
		this.openApiSchema = config.openApiSchema;
		this.ref = {$ref: `#/components/schemas/${config.name}`};
		this.zodSchema = markAsCustomType(config.zodSchema, config.name);
		registry.set(config.name, this);
	}

	public static get(name: string): CustomSchemaType | undefined {
		return registry.get(name);
	}

	public static getRef(name: string): OpenAPIRef | null {
		const type = registry.get(name);
		return type?.ref ?? null;
	}

	public static getAll(): ReadonlyMap<string, CustomSchemaType> {
		return registry;
	}

	public static getAllSchemas(): Record<string, OpenAPISchema> {
		const result: Record<string, OpenAPISchema> = {};
		for (const [name, type] of registry) {
			result[name] = type.openApiSchema;
		}
		return result;
	}
}

export function markAsCustomType<T extends ZodTypeAny>(schema: T, typeName: string): T {
	(schema as Record<string, unknown>)[FLUXER_CUSTOM_TYPE_KEY] = typeName;
	return schema;
}

export function defineCustomType<TName extends string>(
	config: CustomSchemaTypeConfig<TName>,
): CustomSchemaType<TName>['zodSchema'] {
	const type = new CustomSchemaType(config);
	return type.zodSchema;
}
