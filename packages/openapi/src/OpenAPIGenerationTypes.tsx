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

import type {OpenAPIDocument} from '@fluxer/openapi/src/OpenAPITypes';

export interface OpenAPIGeneratorOptions {
	readonly basePath: string;
	readonly title?: string;
	readonly version?: string;
	readonly description?: string;
	readonly serverUrl?: string;
}

export interface OpenAPIGenerationStats {
	readonly controllerCount: number;
	readonly routeCount: number;
	readonly operationCount: number;
	readonly skippedRouteCount: number;
	readonly registeredSchemaCount: number;
	readonly publishedSchemaCount: number;
	readonly tagCount: number;
}

export interface OpenAPIGenerationResult {
	readonly document: OpenAPIDocument;
	readonly stats: OpenAPIGenerationStats;
}
