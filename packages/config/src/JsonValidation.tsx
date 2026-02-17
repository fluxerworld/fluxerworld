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

import ConfigSchema from '@fluxer/config/src/ConfigSchema.json';
import {type ConfigObject, isPlainObject} from '@fluxer/config/src/config_loader/ConfigObjectMerge';
import Ajv from 'ajv/dist/2020';

const ajv = new Ajv({allErrors: true, allowUnionTypes: true, strict: false, strictTypes: false, useDefaults: true});
const validate = ajv.compile(ConfigSchema);

interface JsonSchema {
	type?: string;
	properties?: Record<string, JsonSchema>;
	items?: JsonSchema;
	$ref?: string;
	$defs?: Record<string, JsonSchema>;
	anyOf?: Array<JsonSchema>;
	allOf?: Array<JsonSchema>;
	oneOf?: Array<JsonSchema>;
	additionalProperties?: boolean | JsonSchema;
}

const CONFIG_SCHEMA_ROOT = ConfigSchema as unknown as JsonSchema;

function formatErrorPaths(errors: Array<{instancePath?: string; message?: string}>): string {
	return errors
		.map((error) => {
			const path = error.instancePath && error.instancePath.length > 0 ? error.instancePath : '/';
			const message = error.message ?? 'is invalid';
			return `${path} ${message}`;
		})
		.join('; ');
}

function extractRefName(ref: string): string {
	const match = ref.match(/#\/\$defs\/(.+)/);
	if (match) {
		return match[1];
	}
	throw new Error(`Invalid $ref format: ${ref}`);
}

function resolveSchema(schema: JsonSchema): JsonSchema {
	if (!schema.$ref) {
		return schema;
	}
	const defs = CONFIG_SCHEMA_ROOT.$defs;
	if (!defs) {
		return schema;
	}
	const refName = extractRefName(schema.$ref);
	const resolved = defs[refName];
	return resolved ?? schema;
}

function formatJsonPointer(segments: Array<string>): string {
	if (segments.length === 0) {
		return '/';
	}
	return `/${segments.map((s) => s.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

function collectKnownProperties(
	schema: JsonSchema,
	out: Map<string, Array<JsonSchema>>,
	visited: Set<JsonSchema>,
): void {
	const resolved = resolveSchema(schema);
	if (visited.has(resolved)) {
		return;
	}
	visited.add(resolved);

	if (resolved.properties) {
		for (const [key, propSchema] of Object.entries(resolved.properties)) {
			const existing = out.get(key) ?? [];
			existing.push(propSchema);
			out.set(key, existing);
		}
	}

	// For unknown-key warnings we treat combinators as "any of these keys might be valid".
	for (const sub of resolved.anyOf ?? []) {
		collectKnownProperties(sub, out, visited);
	}
	for (const sub of resolved.oneOf ?? []) {
		collectKnownProperties(sub, out, visited);
	}
	for (const sub of resolved.allOf ?? []) {
		collectKnownProperties(sub, out, visited);
	}
}

function collectUnknownConfigKeys(
	value: unknown,
	schema: JsonSchema,
	segments: Array<string>,
	warnings: Array<string>,
): void {
	const resolved = resolveSchema(schema);

	if (Array.isArray(value)) {
		const itemSchema = resolved.items;
		if (!itemSchema) {
			return;
		}
		for (let i = 0; i < value.length; i += 1) {
			collectUnknownConfigKeys(value[i], itemSchema, [...segments, String(i)], warnings);
		}
		return;
	}

	if (!isPlainObject(value)) {
		return;
	}

	// If this object schema doesn't have an explicit property set, we can't reliably warn
	// (it may be intended as a map/dictionary).
	const known = new Map<string, Array<JsonSchema>>();
	collectKnownProperties(resolved, known, new Set());
	if (known.size === 0) {
		return;
	}

	// If the schema explicitly models "free-form" additionalProperties, don't warn.
	if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
		return;
	}

	for (const key of Object.keys(value)) {
		if (!known.has(key)) {
			const pointer = formatJsonPointer(segments);
			warnings.push(`${pointer} has unknown property "${key}"`);
		}
	}

	for (const [key, schemas] of known.entries()) {
		if (!(key in value)) {
			continue;
		}
		const nextSchema = schemas[0];
		if (!nextSchema) {
			continue;
		}
		collectUnknownConfigKeys(value[key], nextSchema, [...segments, key], warnings);
	}
}

function warnOnUnknownConfigKeys(config: ConfigObject): void {
	const warnings: Array<string> = [];
	collectUnknownConfigKeys(config, CONFIG_SCHEMA_ROOT, [], warnings);

	if (warnings.length === 0) {
		return;
	}

	// Keep this bounded in case a user has a large extra subtree.
	const max = 25;
	const shown = warnings.slice(0, max);
	const remainder = warnings.length - shown.length;
	const extra = remainder > 0 ? ` (+${remainder} more)` : '';

	console.warn(
		[
			`Config JSON contains unknown properties; they are ignored by Fluxer.${extra}`,
			...shown.map((w) => `- ${w}`),
		].join('\n'),
	);
}

export function assertValidJsonConfig(config: ConfigObject): void {
	const valid = validate(config);

	if (!valid) {
		const errors = validate.errors ? formatErrorPaths(validate.errors) : 'unknown schema error';
		throw new Error(`Invalid config JSON: ${errors}`);
	}

	warnOnUnknownConfigKeys(config);
}
