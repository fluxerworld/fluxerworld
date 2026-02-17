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

import type {OpenAPIDocument} from '@fluxer/openapi/src/Types';

export interface ValidationResult {
	valid: boolean;
	errors: Array<ValidationError>;
	warnings: Array<ValidationWarning>;
}

export interface ValidationError {
	path: string;
	message: string;
}

export interface ValidationWarning {
	path: string;
	message: string;
}

export function validateSpec(spec: OpenAPIDocument): ValidationResult {
	const errors: Array<ValidationError> = [];
	const warnings: Array<ValidationWarning> = [];

	if (spec.openapi !== '3.1.0') {
		errors.push({path: 'openapi', message: `Expected "3.1.0", got "${spec.openapi}"`});
	}

	if (!spec.info?.title) {
		errors.push({path: 'info.title', message: 'Missing required field'});
	}

	if (!spec.info?.version) {
		errors.push({path: 'info.version', message: 'Missing required field'});
	}

	if (!spec.paths || Object.keys(spec.paths).length === 0) {
		warnings.push({path: 'paths', message: 'No paths defined'});
	}

	validateRefs(spec, errors);

	validateOperationIds(spec, errors);

	validatePaths(spec, errors, warnings);

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

function validateRefs(spec: OpenAPIDocument, errors: Array<ValidationError>): void {
	const definedSchemas = new Set(Object.keys(spec.components?.schemas ?? {}));

	const checkRefs = (obj: unknown, path: string): void => {
		if (obj === null || typeof obj !== 'object') {
			return;
		}

		if (Array.isArray(obj)) {
			obj.forEach((item, index) => checkRefs(item, `${path}[${index}]`));
			return;
		}

		const record = obj as Record<string, unknown>;
		if ('$ref' in record && typeof record.$ref === 'string') {
			const ref = record.$ref;
			if (ref.startsWith('#/components/schemas/')) {
				const schemaName = ref.replace('#/components/schemas/', '');
				if (!definedSchemas.has(schemaName)) {
					errors.push({path, message: `Reference to undefined schema: ${schemaName}`});
				}
			}
		}

		for (const [key, value] of Object.entries(record)) {
			checkRefs(value, `${path}.${key}`);
		}
	};

	checkRefs(spec.paths, 'paths');
}

function validateOperationIds(spec: OpenAPIDocument, errors: Array<ValidationError>): void {
	const operationIds = new Set<string>();

	for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
		for (const [method, operation] of Object.entries(pathItem)) {
			if (typeof operation === 'object' && operation !== null && 'operationId' in operation) {
				const op = operation as {operationId?: string};
				if (op.operationId) {
					if (operationIds.has(op.operationId)) {
						errors.push({
							path: `paths.${pathKey}.${method}.operationId`,
							message: `Duplicate operationId: ${op.operationId}`,
						});
					} else {
						operationIds.add(op.operationId);
					}
				}
			}
		}
	}
}

function validatePaths(
	spec: OpenAPIDocument,
	errors: Array<ValidationError>,
	warnings: Array<ValidationWarning>,
): void {
	for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
		if (!pathKey.startsWith('/')) {
			errors.push({path: `paths.${pathKey}`, message: 'Path must start with /'});
		}

		const pathParams = pathKey.match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) ?? [];

		for (const [method, operation] of Object.entries(pathItem)) {
			if (typeof operation !== 'object' || operation === null) {
				continue;
			}

			const op = operation as {
				operationId?: string;
				responses?: Record<string, unknown>;
				parameters?: Array<{name: string; in: string}>;
			};

			if (!op.operationId) {
				warnings.push({
					path: `paths.${pathKey}.${method}`,
					message: 'Missing operationId',
				});
			}

			if (!op.responses || Object.keys(op.responses).length === 0) {
				errors.push({
					path: `paths.${pathKey}.${method}.responses`,
					message: 'At least one response is required',
				});
			}

			const definedParams = new Set(op.parameters?.filter((p) => p.in === 'path').map((p) => p.name) ?? []);

			for (const param of pathParams) {
				if (!definedParams.has(param)) {
					warnings.push({
						path: `paths.${pathKey}.${method}`,
						message: `Path parameter "${param}" not defined in parameters`,
					});
				}
			}
		}
	}
}

export function printValidationResult(result: ValidationResult): void {
	if (result.valid) {
		console.log('Validation passed');
	} else {
		console.log('Validation failed');
	}

	if (result.errors.length > 0) {
		console.log('\nErrors:');
		for (const error of result.errors) {
			console.log(`  - [${error.path}] ${error.message}`);
		}
	}

	if (result.warnings.length > 0) {
		console.log('\nWarnings:');
		for (const warning of result.warnings) {
			console.log(`  - [${warning.path}] ${warning.message}`);
		}
	}
}
