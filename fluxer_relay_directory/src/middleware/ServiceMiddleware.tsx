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

import type {DatabaseSync} from 'node:sqlite';
import type {IRelayRepository} from '@app/repositories/RelayRepository';
import {RelayRepository} from '@app/repositories/RelayRepository';
import type {IGeoSelectionService} from '@app/services/GeoSelectionService';
import {GeoSelectionService} from '@app/services/GeoSelectionService';
import type {IRelayRegistryService} from '@app/services/RelayRegistryService';
import {RelayRegistryService} from '@app/services/RelayRegistryService';
import {createMiddleware} from 'hono/factory';

export interface RelayDirectoryEnv {
	Variables: {
		relayRepository: IRelayRepository;
		geoService: IGeoSelectionService;
		registryService: IRelayRegistryService;
	};
}

export interface ServiceMiddlewareOptions {
	db: DatabaseSync;
}

let _repository: RelayRepository | null = null;
let _geoService: GeoSelectionService | null = null;
let _registryService: RelayRegistryService | null = null;

export function initializeServices(options: ServiceMiddlewareOptions): {
	repository: RelayRepository;
	geoService: GeoSelectionService;
	registryService: RelayRegistryService;
} {
	_repository = new RelayRepository(options.db);
	_geoService = new GeoSelectionService();
	_registryService = new RelayRegistryService(_repository, _geoService);

	return {
		repository: _repository,
		geoService: _geoService,
		registryService: _registryService,
	};
}

export function getRepository(): RelayRepository {
	if (!_repository) {
		throw new Error('Services not initialized. Call initializeServices first.');
	}
	return _repository;
}

export const ServiceMiddleware = createMiddleware<RelayDirectoryEnv>(async (ctx, next) => {
	if (!_repository || !_geoService || !_registryService) {
		throw new Error('Services not initialized. Call initializeServices first.');
	}

	ctx.set('relayRepository', _repository);
	ctx.set('geoService', _geoService);
	ctx.set('registryService', _registryService);

	await next();
});
