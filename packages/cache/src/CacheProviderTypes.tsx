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

export interface CacheLogger {
	error(obj: unknown, message: string): void;
}

export interface CacheTelemetry {
	recordCounter(metric: {name: string; dimensions?: Record<string, string>}): void;
	recordHistogram(metric: {name: string; valueMs: number; dimensions?: Record<string, string>}): void;
}

export type CacheKeyClassifier = (key: string) => string;
