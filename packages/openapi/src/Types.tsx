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

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type ValidatorTarget = 'json' | 'query' | 'param' | 'form' | 'header' | 'cookie';

export interface ExtractedValidator {
	target: ValidatorTarget;
	schemaName: string | null;
	inlineSchema: string | null;
}

export interface ExtractedRoute {
	method: HttpMethod;
	path: string;
	controllerFile: string;
	lineNumber: number;
	validators: Array<ExtractedValidator>;
	middlewares: Array<string>;
	hasLoginRequired: boolean;
	hasDefaultUserOnly: boolean;
	hasLoginRequiredAllowSuspicious: boolean;
	hasSudoMode: boolean;
	rateLimitConfig: string | null;
	handlerSource: string | null;
	responseMapperName: string | null;
	responseSchemaName: string | null;
	hasNoContent: boolean;
	successStatusCodes: Array<number>;
	explicitSummary: string | null;
	explicitOperationId: string | null;
	explicitDescription: string | null;
	explicitStatusCodes: Array<number> | null;
	explicitSecurity: Array<string> | null;
	oauth2RequiredScopes: Array<string> | null;
	oauth2ScopeMode: 'all' | 'any' | null;
	oauth2BearerTokenRequired: boolean;
	explicitTags: Array<string> | null;
	explicitDeprecated: boolean;
	explicitExternalDocs: {url: string; description?: string} | null;
}

export interface OpenAPIPathItem {
	[method: string]: OpenAPIOperation;
}

export interface MintlifyMetadata {
	title?: string;
	description?: string;
}

export interface MintlifyExtension {
	metadata?: MintlifyMetadata;
}

export interface OpenAPIOperation {
	operationId: string;
	tags: Array<string>;
	summary?: string;
	description?: string;
	security?: Array<Record<string, Array<string>>>;
	parameters?: Array<OpenAPIParameter>;
	requestBody?: OpenAPIRequestBody;
	responses: Record<string, OpenAPIResponse>;
	deprecated?: boolean;
	externalDocs?: {url: string; description?: string};
	'x-mint'?: MintlifyExtension;
}

export interface OpenAPIParameter {
	name: string;
	in: 'path' | 'query' | 'header' | 'cookie';
	required: boolean;
	schema: OpenAPISchemaOrRef;
	description?: string;
}

export interface OpenAPIRequestBody {
	required?: boolean;
	content: {
		'application/json'?: {
			schema: OpenAPISchema | OpenAPIRef;
		};
		'multipart/form-data'?: {
			schema: OpenAPISchema | OpenAPIRef;
		};
	};
}

export interface OpenAPIResponse {
	description: string;
	content?: {
		'application/json'?: {
			schema: OpenAPISchema | OpenAPIRef;
		};
	};
	headers?: Record<string, OpenAPIHeaderObject>;
}

export interface OpenAPIHeaderObject {
	description?: string;
	schema: OpenAPISchemaOrRef;
}

export interface OpenAPIRef {
	$ref: string;
}

export type OpenAPISchemaOrRef = OpenAPISchema | OpenAPIRef;

export interface OpenAPISchema {
	type?: string;
	format?: string;
	items?: OpenAPISchemaOrRef | boolean;
	prefixItems?: Array<OpenAPISchemaOrRef>;
	properties?: Record<string, OpenAPISchemaOrRef>;
	additionalProperties?: boolean | OpenAPISchemaOrRef;
	required?: Array<string>;
	enum?: Array<string | number | boolean>;
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	multipleOf?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	pattern?: string;
	default?: unknown;
	nullable?: boolean;
	oneOf?: Array<OpenAPISchemaOrRef>;
	anyOf?: Array<OpenAPISchemaOrRef>;
	allOf?: Array<OpenAPISchemaOrRef>;
	not?: OpenAPISchemaOrRef;
	description?: string;
	discriminator?: {
		propertyName: string;
		mapping?: Record<string, string>;
	};
	patternProperties?: Record<string, OpenAPISchemaOrRef | boolean>;
}

export interface OpenAPIDocument {
	openapi: '3.1.0';
	info: {
		title: string;
		version: string;
		description?: string;
		contact?: {
			name?: string;
			email?: string;
			url?: string;
		};
		license?: {
			name: string;
			url?: string;
		};
	};
	servers?: Array<{
		url: string;
		description?: string;
	}>;
	paths: Record<string, OpenAPIPathItem>;
	components: {
		schemas: Record<string, OpenAPISchema>;
		securitySchemes: Record<string, OpenAPISecurityScheme>;
	};
	tags?: Array<{
		name: string;
		description?: string;
	}>;
}

export interface OpenAPISecurityScheme {
	type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
	scheme?: string;
	bearerFormat?: string;
	name?: string;
	in?: 'header' | 'query' | 'cookie';
	description?: string;
	flows?: {
		authorizationCode?: {
			authorizationUrl: string;
			tokenUrl: string;
			refreshUrl?: string;
			scopes: Record<string, string>;
		};
		clientCredentials?: {
			tokenUrl: string;
			scopes: Record<string, string>;
		};
	};
}
