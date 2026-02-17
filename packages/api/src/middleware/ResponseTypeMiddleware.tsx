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

import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {InternalServerError} from '@fluxer/errors/src/domains/core/InternalServerError';
import {createLogger} from '@fluxer/logger/src/Logger';
import {captureException} from '@fluxer/sentry/src/Sentry';
import type {MiddlewareHandler} from 'hono';
import type {ZodType} from 'zod';

export const RESPONSE_SCHEMA_KEY = Symbol('responseSchema');

export class MissingResponseTypeError extends Error {
	constructor(method: string, path: string) {
		super(
			`Missing ResponseType middleware for ${method.toUpperCase()} ${path}. All endpoints must define a response schema.`,
		);
		this.name = 'MissingResponseTypeError';
	}
}

const responseValidationLogger = createLogger('response_validation');

export class ResponseValidationError extends InternalServerError {
	constructor(public readonly validationErrors: Array<{path: string; message: string}>) {
		const errorsDescription = validationErrors.map((e) => `${e.path}: ${e.message}`).join(', ');
		super({
			code: APIErrorCodes.RESPONSE_VALIDATION_ERROR,
			messageVariables: {errors: errorsDescription},
		});
	}
}

export function ResponseType<T extends ZodType>(
	schema: T,
	options?: {
		skipValidation?: boolean;
		allowNoContent?: boolean;
	},
): MiddlewareHandler<HonoEnv> {
	const {skipValidation = false, allowNoContent = false} = options ?? {};

	return async (ctx, next) => {
		ctx.set('responseSchema' as keyof HonoEnv['Variables'], schema);

		await next();

		if (skipValidation) {
			return;
		}

		const response = ctx.res;

		if (allowNoContent && response.status === 204) {
			return;
		}

		const contentType = response.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return;
		}

		if (response.status >= 400) {
			return;
		}

		const clonedResponse = response.clone();
		let body: unknown;
		try {
			body = await clonedResponse.json();
		} catch {
			return;
		}

		const result = schema.safeParse(body);

		if (!result.success) {
			const validationErrors = result.error.issues.map((issue) => ({
				path: issue.path.join('.') || 'root',
				message: issue.message,
			}));

			const errorContext = {
				method: ctx.req.method,
				path: ctx.req.path,
				status: response.status,
				validationErrors,
				body,
			};
			const responseValidationError = new ResponseValidationError(validationErrors);

			responseValidationLogger.error(errorContext, 'Response validation failed');
			captureException(responseValidationError, errorContext);

			throw responseValidationError;
		}

		ctx.res = new Response(JSON.stringify(result.data), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
}

export function NoContent(): MiddlewareHandler<HonoEnv> {
	return async (ctx, next) => {
		ctx.set('responseSchema' as keyof HonoEnv['Variables'], null);
		await next();
	};
}

export type ResponseTypeOf<T extends ZodType> = T['_output'];

export const OPENAPI_METADATA_KEY = Symbol('openapiMetadata');

export interface OpenAPIMetadata {
	operationId: string;
	summary: string;
	description: string;
	responseSchema: ZodType | null;
	statusCode?: number | Array<number>;
	security?: SecurityScheme | Array<SecurityScheme>;
	tags: string | Array<string>;
	deprecated?: boolean;
	externalDocs?: {url: string; description?: string};
}

export type SecurityScheme = 'botToken' | 'oauth2Token' | 'bearerToken' | 'sessionToken' | 'adminApiKey';

export interface OpenAPIRouteMetadata {
	operationId: string;
	summary: string;
	description: string;
	responseSchema: ZodType | null;
	statusCode?: number | Array<number>;
	security?: SecurityScheme | Array<SecurityScheme>;
	tags: string | Array<string>;
	deprecated?: boolean;
	externalDocs?: {url: string; description?: string};
}

export interface OpenAPIOptions {
	description: string;
}

function validateOperationId(operationId: string): void {
	if (!/^[a-z][a-z0-9_]*$/.test(operationId)) {
		throw new Error(
			`Invalid operationId "${operationId}". Must be snake_case (lowercase letters, numbers, and underscores only, starting with a letter).`,
		);
	}
}

function normalizeSecurityToArray(
	security?: SecurityScheme | Array<SecurityScheme>,
): Array<SecurityScheme> | undefined {
	if (!security) return undefined;
	return Array.isArray(security) ? security : [security];
}

function normalizeTagsToArray(tags: string | Array<string>): Array<string> {
	return Array.isArray(tags) ? tags : [tags];
}

function normalizeStatusCodeToArray(statusCode?: number | Array<number>): Array<number> | undefined {
	if (!statusCode) return undefined;
	return Array.isArray(statusCode) ? statusCode : [statusCode];
}

export function OpenAPI(metadata: OpenAPIRouteMetadata): MiddlewareHandler<HonoEnv>;
export function OpenAPI(
	operationId: string,
	summary: string,
	responseSchema: ZodType | null,
	options: OpenAPIOptions,
): MiddlewareHandler<HonoEnv>;
export function OpenAPI(
	operationIdOrMetadata: string | OpenAPIRouteMetadata,
	summary?: string,
	responseSchema?: ZodType | null,
	options?: OpenAPIOptions,
): MiddlewareHandler<HonoEnv> {
	let metadata: OpenAPIRouteMetadata;

	if (typeof operationIdOrMetadata === 'string') {
		if (!options?.description) {
			throw new Error(
				`Missing description for OpenAPI route ${operationIdOrMetadata}. The description field is required.`,
			);
		}
		if (responseSchema === undefined) {
			throw new Error(
				`Missing responseSchema for OpenAPI route ${operationIdOrMetadata}. The responseSchema field is required (use null for no-content responses).`,
			);
		}
		metadata = {
			operationId: operationIdOrMetadata,
			summary: summary!,
			description: options.description,
			responseSchema,
			tags: [],
		};
	} else {
		metadata = operationIdOrMetadata;
	}

	validateOperationId(metadata.operationId);
	const {statusCode, security, tags, deprecated, externalDocs} = metadata;
	const schema = metadata.responseSchema;

	return async (ctx, next) => {
		const fullMetadata: OpenAPIMetadata = {
			operationId: metadata.operationId,
			summary: metadata.summary,
			description: metadata.description,
			responseSchema: schema,
			statusCode: statusCode ? normalizeStatusCodeToArray(statusCode) : undefined,
			security: security ? normalizeSecurityToArray(security) : undefined,
			tags: normalizeTagsToArray(tags),
			deprecated,
			externalDocs,
		};

		ctx.set('openapiMetadata' as keyof HonoEnv['Variables'], fullMetadata);
		ctx.set('responseSchema' as keyof HonoEnv['Variables'], schema);

		await next();

		if (!schema) {
			return;
		}

		const response = ctx.res;

		const contentType = response.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return;
		}

		if (response.status >= 400) {
			return;
		}

		const clonedResponse = response.clone();
		let body: unknown;
		try {
			body = await clonedResponse.json();
		} catch {
			return;
		}

		const result = schema.safeParse(body);

		if (!result.success) {
			const validationErrors = result.error.issues.map((issue) => ({
				path: issue.path.join('.') || 'root',
				message: issue.message,
			}));

			const errorContext = {
				method: ctx.req.method,
				path: ctx.req.path,
				status: response.status,
				validationErrors,
				body,
			};
			const responseValidationError = new ResponseValidationError(validationErrors);

			responseValidationLogger.error(errorContext, 'Response validation failed');
			captureException(responseValidationError, errorContext);

			throw responseValidationError;
		}

		ctx.res = new Response(JSON.stringify(result.data), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
}
