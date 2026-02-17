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

import {z} from 'zod';

export const RelayInfoResponse = z.object({
	id: z.string().describe('Unique identifier for the relay'),
	name: z.string().describe('Human-readable name of the relay'),
	url: z.url().describe('Base URL of the relay service'),
	latitude: z.number().describe('Geographic latitude of the relay'),
	longitude: z.number().describe('Geographic longitude of the relay'),
	region: z.string().describe('Region identifier (e.g., eu-west, us-east)'),
	capacity: z.number().int().min(0).describe('Maximum number of connections this relay can handle'),
	current_connections: z.number().int().min(0).describe('Current number of active connections'),
	public_key: z.string().describe('Base64-encoded X25519 public key for E2E encryption'),
	registered_at: z.iso.datetime().describe('ISO 8601 timestamp when the relay was registered'),
	last_seen_at: z.iso.datetime().describe('ISO 8601 timestamp of the last health check or heartbeat'),
	healthy: z.boolean().describe('Whether the relay is currently healthy'),
});
export type RelayInfoResponse = z.infer<typeof RelayInfoResponse>;

export const RelayWithDistanceResponse = RelayInfoResponse.extend({
	distance_km: z.number().min(0).describe('Distance from client location in kilometres'),
});
export type RelayWithDistanceResponse = z.infer<typeof RelayWithDistanceResponse>;

export const RelayListResponse = z.object({
	relays: z.array(z.union([RelayInfoResponse, RelayWithDistanceResponse])).describe('List of available relays'),
	count: z.number().int().min(0).describe('Total number of relays returned'),
});
export type RelayListResponse = z.infer<typeof RelayListResponse>;

export const RelayStatusResponse = z.object({
	id: z.string().describe('Unique identifier for the relay'),
	name: z.string().describe('Human-readable name of the relay'),
	url: z.url().describe('Base URL of the relay service'),
	region: z.string().describe('Region identifier'),
	healthy: z.boolean().describe('Whether the relay is currently healthy'),
	current_connections: z.number().int().min(0).describe('Current number of active connections'),
	capacity: z.number().int().min(0).describe('Maximum connection capacity'),
	last_seen_at: z.iso.datetime().describe('ISO 8601 timestamp of the last health check or heartbeat'),
});
export type RelayStatusResponse = z.infer<typeof RelayStatusResponse>;

export const RelayHeartbeatResponse = z.object({
	status: z.literal('ok').describe('Confirmation that heartbeat was received'),
});
export type RelayHeartbeatResponse = z.infer<typeof RelayHeartbeatResponse>;

export const RelayDeletedResponse = z.object({
	status: z.literal('deleted').describe('Confirmation that relay was deleted'),
});
export type RelayDeletedResponse = z.infer<typeof RelayDeletedResponse>;

export const RegisterRelayRequest = z.object({
	name: z.string().min(1).max(100).describe('Human-readable name of the relay'),
	url: z.url().describe('Base URL of the relay service'),
	latitude: z.number().min(-90).max(90).describe('Geographic latitude of the relay'),
	longitude: z.number().min(-180).max(180).describe('Geographic longitude of the relay'),
	region: z.string().min(1).max(50).optional().default('unknown').describe('Region identifier'),
	capacity: z.number().int().min(1).optional().default(1000).describe('Maximum connection capacity'),
	public_key: z.string().min(1).describe('Base64-encoded X25519 public key for E2E encryption'),
});
export type RegisterRelayRequest = z.infer<typeof RegisterRelayRequest>;

export const RelayIdParam = z.object({
	id: z.string().uuid().describe('Relay UUID'),
});
export type RelayIdParam = z.infer<typeof RelayIdParam>;

export const RelayListQuery = z.object({
	lat: z.string().optional().describe('Client latitude for proximity sorting'),
	lon: z.string().optional().describe('Client longitude for proximity sorting'),
	limit: z.string().optional().describe('Maximum number of relays to return'),
});
export type RelayListQuery = z.infer<typeof RelayListQuery>;

export const HealthCheckResponse = z.object({
	status: z.literal('ok').describe('Health status'),
	timestamp: z.iso.datetime().describe('Current server timestamp'),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;
