#!/usr/bin/env tsx

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

import * as fs from 'node:fs';
import * as path from 'node:path';
import {zodToOpenAPISchema} from '@fluxer/openapi/src/converters/ZodToOpenAPI';
import {
	HealthCheckResponse,
	RegisterRelayRequest,
	RelayDeletedResponse,
	RelayHeartbeatResponse,
	RelayIdParam,
	RelayInfoResponse,
	RelayListQuery,
	RelayListResponse,
	RelayStatusResponse,
	RelayWithDistanceResponse,
} from '@fluxer/schema/src/domains/relay/RelaySchemas';
import type {ZodTypeAny} from 'zod';

interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description: string;
		contact?: {
			name?: string;
			url?: string;
			email?: string;
		};
		license?: {
			name: string;
			url?: string;
		};
	};
	servers: Array<{
		url: string;
		description: string;
	}>;
	paths: Record<string, PathItem>;
	components: {
		schemas: Record<string, unknown>;
	};
}

interface PathItem {
	get?: Operation;
	post?: Operation;
	put?: Operation;
	patch?: Operation;
	delete?: Operation;
}

interface Operation {
	operationId: string;
	summary: string;
	description?: string;
	tags?: Array<string>;
	parameters?: Array<Parameter>;
	requestBody?: RequestBody;
	responses: Record<string, Response>;
}

interface Parameter {
	name: string;
	in: 'query' | 'path' | 'header' | 'cookie';
	description?: string;
	required?: boolean;
	schema: unknown;
}

interface RequestBody {
	description?: string;
	required?: boolean;
	content: {
		'application/json': {
			schema: unknown;
		};
	};
}

interface Response {
	description: string;
	content?: {
		'application/json': {
			schema: unknown;
		};
	};
}

function convertZodSchema(schema: ZodTypeAny): unknown {
	return zodToOpenAPISchema(schema);
}

function generateSpec(): OpenAPISpec {
	const schemas: Record<string, unknown> = {
		HealthCheckResponse: convertZodSchema(HealthCheckResponse),
		RelayInfoResponse: convertZodSchema(RelayInfoResponse),
		RelayWithDistanceResponse: convertZodSchema(RelayWithDistanceResponse),
		RelayListResponse: convertZodSchema(RelayListResponse),
		RelayStatusResponse: convertZodSchema(RelayStatusResponse),
		RelayHeartbeatResponse: convertZodSchema(RelayHeartbeatResponse),
		RelayDeletedResponse: convertZodSchema(RelayDeletedResponse),
		RegisterRelayRequest: convertZodSchema(RegisterRelayRequest),
		RelayIdParam: convertZodSchema(RelayIdParam),
		RelayListQuery: convertZodSchema(RelayListQuery),
		RelayNotFoundError: {
			type: 'object',
			properties: {
				error: {type: 'string', description: 'Error message'},
				code: {type: 'string', enum: ['RELAY_NOT_FOUND'], description: 'Error code'},
			},
			required: ['error', 'code'],
		},
	};

	const spec: OpenAPISpec = {
		openapi: '3.1.0',
		info: {
			title: 'Fluxer Relay Directory API',
			version: '1.0.0',
			description:
				'API for discovering and managing Fluxer relay servers. ' +
				'The relay directory service maintains a registry of available relay servers ' +
				'that clients can use to connect to Fluxer instances through encrypted tunnels.',
			contact: {
				name: 'Fluxer Developers',
				email: 'developers@fluxer.app',
			},
			license: {
				name: 'AGPL-3.0',
				url: 'https://www.gnu.org/licenses/agpl-3.0.html',
			},
		},
		servers: [
			{
				url: 'https://relay.fluxer.app',
				description: 'Production relay directory',
			},
		],
		paths: {
			'/_health': {
				get: {
					operationId: 'getHealth',
					summary: 'Health check',
					description: 'Returns the health status of the relay directory service.',
					tags: ['Health'],
					responses: {
						'200': {
							description: 'Service is healthy',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/HealthCheckResponse'},
								},
							},
						},
					},
				},
			},
			'/v1/relays': {
				get: {
					operationId: 'listRelays',
					summary: 'List available relays',
					description:
						'Returns a list of available relay servers. ' +
						'Optionally, provide client coordinates to sort relays by proximity.',
					tags: ['Relays'],
					parameters: [
						{
							name: 'lat',
							in: 'query',
							description: 'Client latitude for proximity-based sorting',
							required: false,
							schema: {type: 'string'},
						},
						{
							name: 'lon',
							in: 'query',
							description: 'Client longitude for proximity-based sorting',
							required: false,
							schema: {type: 'string'},
						},
						{
							name: 'limit',
							in: 'query',
							description: 'Maximum number of relays to return',
							required: false,
							schema: {type: 'string'},
						},
					],
					responses: {
						'200': {
							description: 'List of available relays',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayListResponse'},
								},
							},
						},
					},
				},
			},
			'/v1/relays/register': {
				post: {
					operationId: 'registerRelay',
					summary: 'Register a new relay',
					description:
						'Registers a new relay server with the directory. ' +
						'The relay must provide its public key for E2E encryption.',
					tags: ['Relays'],
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {$ref: '#/components/schemas/RegisterRelayRequest'},
							},
						},
					},
					responses: {
						'201': {
							description: 'Relay registered successfully',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayInfoResponse'},
								},
							},
						},
					},
				},
			},
			'/v1/relays/{id}/status': {
				get: {
					operationId: 'getRelayStatus',
					summary: 'Get relay status',
					description: 'Returns the current status of a specific relay server.',
					tags: ['Relays'],
					parameters: [
						{
							name: 'id',
							in: 'path',
							description: 'Relay UUID',
							required: true,
							schema: {type: 'string', format: 'uuid'},
						},
					],
					responses: {
						'200': {
							description: 'Relay status',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayStatusResponse'},
								},
							},
						},
						'404': {
							description: 'Relay not found',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayNotFoundError'},
								},
							},
						},
					},
				},
			},
			'/v1/relays/{id}/heartbeat': {
				post: {
					operationId: 'sendHeartbeat',
					summary: 'Send relay heartbeat',
					description:
						'Sends a heartbeat to indicate the relay is still alive. ' +
						'Relays should send heartbeats periodically to maintain their healthy status.',
					tags: ['Relays'],
					parameters: [
						{
							name: 'id',
							in: 'path',
							description: 'Relay UUID',
							required: true,
							schema: {type: 'string', format: 'uuid'},
						},
					],
					responses: {
						'200': {
							description: 'Heartbeat received',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayHeartbeatResponse'},
								},
							},
						},
						'404': {
							description: 'Relay not found',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayNotFoundError'},
								},
							},
						},
					},
				},
			},
			'/v1/relays/{id}': {
				delete: {
					operationId: 'deleteRelay',
					summary: 'Unregister a relay',
					description: 'Removes a relay server from the directory.',
					tags: ['Relays'],
					parameters: [
						{
							name: 'id',
							in: 'path',
							description: 'Relay UUID',
							required: true,
							schema: {type: 'string', format: 'uuid'},
						},
					],
					responses: {
						'200': {
							description: 'Relay deleted',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayDeletedResponse'},
								},
							},
						},
						'404': {
							description: 'Relay not found',
							content: {
								'application/json': {
									schema: {$ref: '#/components/schemas/RelayNotFoundError'},
								},
							},
						},
					},
				},
			},
		},
		components: {
			schemas,
		},
	};

	return spec;
}

function main(): void {
	console.log('Fluxer Relay Directory OpenAPI Generator');
	console.log('========================================');
	console.log('');

	const spec = generateSpec();

	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	const outputPath = path.resolve(scriptDir, '../../fluxer_docs/relay-api/openapi.json');
	const outputDir = path.dirname(outputPath);

	console.log(`Output path: ${outputPath}`);
	console.log('');

	fs.mkdirSync(outputDir, {recursive: true});
	fs.writeFileSync(outputPath, JSON.stringify(spec, null, '\t'));

	const pathCount = Object.keys(spec.paths).length;
	let operationCount = 0;
	for (const pathItem of Object.values(spec.paths)) {
		operationCount += Object.keys(pathItem).length;
	}
	const schemaCount = Object.keys(spec.components.schemas).length;

	console.log('Summary');
	console.log('-------');
	console.log(`Paths: ${pathCount}`);
	console.log(`Operations: ${operationCount}`);
	console.log(`Schemas: ${schemaCount}`);
	console.log('');
	console.log('OpenAPI specification generated successfully.');
}

main();
