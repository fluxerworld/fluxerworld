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

export interface HttpClientMetrics {
	counter(params: {name: string; dimensions?: Record<string, string>; value?: number}): void;
	histogram(params: {name: string; dimensions?: Record<string, string>; valueMs: number}): void;
}

export interface HttpClientTracing {
	withSpan<T>(options: {name: string; attributes?: Record<string, unknown>}, fn: () => Promise<T>): Promise<T>;
}

export interface HttpClientTelemetry {
	metrics?: HttpClientMetrics;
	tracing?: HttpClientTracing;
}
