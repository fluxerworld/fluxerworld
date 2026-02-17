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

export class SchemaRegistry {
	private schemas: Map<string, OpenAPISchema> = new Map();
	private references: Set<string> = new Set();

	register(name: string, schema: OpenAPISchema): void {
		this.schemas.set(name, schema);
	}

	getRef(name: string): OpenAPIRef {
		this.references.add(name);
		return {$ref: `#/components/schemas/${name}`};
	}

	has(name: string): boolean {
		return this.schemas.has(name);
	}

	get(name: string): OpenAPISchema | undefined {
		return this.schemas.get(name);
	}

	getAllSchemas(): Record<string, OpenAPISchema> {
		const result: Record<string, OpenAPISchema> = {};
		for (const [name, schema] of this.schemas) {
			result[name] = schema;
		}
		return result;
	}

	getReferencedSchemas(): Record<string, OpenAPISchema> {
		const result: Record<string, OpenAPISchema> = {};
		for (const name of this.references) {
			const schema = this.schemas.get(name);
			if (schema) {
				result[name] = schema;
			}
		}
		return result;
	}

	getUnreferencedSchemas(): Array<string> {
		const unreferenced: Array<string> = [];
		for (const name of this.schemas.keys()) {
			if (!this.references.has(name)) {
				unreferenced.push(name);
			}
		}
		return unreferenced;
	}

	clear(): void {
		this.schemas.clear();
		this.references.clear();
	}
}

export const globalSchemaRegistry = new SchemaRegistry();
