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

import type {RelayDirectoryEnv} from '@app/middleware/ServiceMiddleware';
import {Validator} from '@app/middleware/Validator';
import {
	type HealthCheckResponse,
	RegisterRelayRequest,
	type RelayDeletedResponse,
	type RelayHeartbeatResponse,
	RelayIdParam,
	type RelayInfoResponse,
	RelayListQuery,
	type RelayListResponse,
	type RelayStatusResponse,
} from '@fluxer/schema/src/domains/relay/RelaySchemas';
import type {Hono} from 'hono';

export function RelayController(app: Hono<RelayDirectoryEnv>): void {
	app.get('/_health', (ctx) => {
		const response: typeof HealthCheckResponse._output = {
			status: 'ok',
			timestamp: new Date().toISOString(),
		};
		return ctx.json(response);
	});

	app.get('/v1/relays', Validator('query', RelayListQuery), async (ctx) => {
		const query = ctx.req.valid('query');
		const registryService = ctx.get('registryService');

		const clientLocation =
			query.lat && query.lon
				? {
						latitude: Number.parseFloat(query.lat),
						longitude: Number.parseFloat(query.lon),
					}
				: undefined;

		const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;

		const relays = registryService.listRelays(clientLocation, limit);

		const response: typeof RelayListResponse._output = {
			relays,
			count: relays.length,
		};

		return ctx.json(response);
	});

	app.post('/v1/relays/register', Validator('json', RegisterRelayRequest), async (ctx) => {
		const body = ctx.req.valid('json');
		const registryService = ctx.get('registryService');

		const relay = registryService.registerRelay({
			name: body.name,
			url: body.url,
			latitude: body.latitude,
			longitude: body.longitude,
			region: body.region ?? 'unknown',
			capacity: body.capacity ?? 1000,
			public_key: body.public_key,
		});

		const response: typeof RelayInfoResponse._output = relay;
		return ctx.json(response, 201);
	});

	app.get('/v1/relays/:id/status', Validator('param', RelayIdParam), async (ctx) => {
		const {id} = ctx.req.valid('param');
		const registryService = ctx.get('registryService');

		const relay = registryService.getRelayStatus(id);

		if (!relay) {
			return ctx.json({error: 'Relay not found', code: 'RELAY_NOT_FOUND'}, 404);
		}

		const response: typeof RelayStatusResponse._output = {
			id: relay.id,
			name: relay.name,
			url: relay.url,
			region: relay.region,
			healthy: relay.healthy,
			current_connections: relay.current_connections,
			capacity: relay.capacity,
			last_seen_at: relay.last_seen_at,
		};

		return ctx.json(response);
	});

	app.post('/v1/relays/:id/heartbeat', Validator('param', RelayIdParam), async (ctx) => {
		const {id} = ctx.req.valid('param');
		const registryService = ctx.get('registryService');

		const relay = registryService.getRelay(id);

		if (!relay) {
			return ctx.json({error: 'Relay not found', code: 'RELAY_NOT_FOUND'}, 404);
		}

		registryService.updateRelayHeartbeat(id);

		const response: typeof RelayHeartbeatResponse._output = {status: 'ok'};
		return ctx.json(response);
	});

	app.delete('/v1/relays/:id', Validator('param', RelayIdParam), async (ctx) => {
		const {id} = ctx.req.valid('param');
		const registryService = ctx.get('registryService');

		const relay = registryService.getRelay(id);

		if (!relay) {
			return ctx.json({error: 'Relay not found', code: 'RELAY_NOT_FOUND'}, 404);
		}

		registryService.removeRelay(id);

		const response: typeof RelayDeletedResponse._output = {status: 'deleted'};
		return ctx.json(response);
	});
}
