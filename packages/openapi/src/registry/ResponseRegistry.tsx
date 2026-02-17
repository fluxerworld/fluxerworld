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

import type {OpenAPIResponse, OpenAPISchema} from '@fluxer/openapi/src/Types';

export const ERROR_SCHEMA: OpenAPISchema = {
	type: 'object',
	properties: {
		code: {
			$ref: '#/components/schemas/APIErrorCode',
		},
		message: {
			type: 'string',
			description: 'Human-readable error message',
		},
		errors: {
			type: 'array',
			description: 'Field-specific validation errors',
			items: {
				$ref: '#/components/schemas/ValidationErrorItem',
			},
		},
	},
	required: ['code', 'message'],
};

export const RATE_LIMIT_HEADERS: Record<string, {description: string; schema: OpenAPISchema}> = {
	'X-RateLimit-Limit': {
		description: 'The number of requests that can be made in the current window',
		schema: {type: 'integer'},
	},
	'X-RateLimit-Remaining': {
		description: 'The number of remaining requests that can be made',
		schema: {type: 'integer'},
	},
	'X-RateLimit-Reset': {
		description: 'Unix timestamp when the rate limit resets',
		schema: {type: 'integer'},
	},
	'Retry-After': {
		description: 'Number of seconds to wait before retrying (only on 429)',
		schema: {type: 'integer'},
	},
};

export const COMMON_RESPONSES: Record<string, OpenAPIResponse> = {
	'400': {
		description: 'Bad Request - The request was malformed or contained invalid data',
		content: {
			'application/json': {
				schema: {$ref: '#/components/schemas/Error'},
			},
		},
	},
	'401': {
		description: 'Unauthorized - Authentication is required or the token is invalid',
		content: {
			'application/json': {
				schema: {$ref: '#/components/schemas/Error'},
			},
		},
	},
	'403': {
		description: 'Forbidden - You do not have permission to perform this action',
		content: {
			'application/json': {
				schema: {$ref: '#/components/schemas/Error'},
			},
		},
	},
	'404': {
		description: 'Not Found - The requested resource was not found',
		content: {
			'application/json': {
				schema: {$ref: '#/components/schemas/Error'},
			},
		},
	},
	'429': {
		description: 'Too Many Requests - You are being rate limited',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						code: {type: 'string', enum: ['RATE_LIMITED']},
						message: {type: 'string'},
						retry_after: {type: 'number', description: 'Seconds to wait before retrying'},
						global: {type: 'boolean', description: 'Whether this is a global rate limit'},
					},
					required: ['code', 'message', 'retry_after'],
				},
			},
		},
		headers: {
			'Retry-After': RATE_LIMIT_HEADERS['Retry-After'],
			'X-RateLimit-Limit': RATE_LIMIT_HEADERS['X-RateLimit-Limit'],
			'X-RateLimit-Remaining': RATE_LIMIT_HEADERS['X-RateLimit-Remaining'],
			'X-RateLimit-Reset': RATE_LIMIT_HEADERS['X-RateLimit-Reset'],
		},
	},
	'500': {
		description: 'Internal Server Error - An unexpected error occurred',
		content: {
			'application/json': {
				schema: {$ref: '#/components/schemas/Error'},
			},
		},
	},
};

export function getErrorResponses(requiresAuth: boolean): Record<string, OpenAPIResponse> {
	const responses: Record<string, OpenAPIResponse> = {
		'400': COMMON_RESPONSES['400'],
		'429': COMMON_RESPONSES['429'],
		'500': COMMON_RESPONSES['500'],
	};

	if (requiresAuth) {
		responses['401'] = COMMON_RESPONSES['401'];
		responses['403'] = COMMON_RESPONSES['403'];
	}

	return responses;
}

export function getSuccessResponse(schemaRef: string | null): OpenAPIResponse {
	if (!schemaRef) {
		return {
			description: 'Success',
		};
	}

	return {
		description: 'Success',
		content: {
			'application/json': {
				schema: {$ref: schemaRef},
			},
		},
	};
}

export function getNoContentResponse(): OpenAPIResponse {
	return {
		description: 'No Content',
	};
}
