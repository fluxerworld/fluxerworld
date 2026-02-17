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

import type {
	BatchMetric,
	CounterParams,
	CrashParams,
	GaugeParams,
	HistogramParams,
	IMetricsService,
} from '@fluxer/api/src/infrastructure/IMetricsService';
import {isTelemetryEnabled, recordCounter, recordGauge, recordHistogram} from '@fluxer/api/src/Telemetry';

class MetricsService implements IMetricsService {
	counter(params: CounterParams): void {
		recordCounter({
			name: params.name,
			value: params.value,
			dimensions: params.dimensions,
		});
	}

	gauge(params: GaugeParams): void {
		recordGauge({
			name: params.name,
			value: params.value,
			dimensions: params.dimensions,
		});
	}

	histogram(params: HistogramParams): void {
		recordHistogram({
			name: params.name,
			valueMs: params.valueMs,
			dimensions: params.dimensions,
		});
	}

	crash({guildId}: CrashParams): void {
		recordCounter({
			name: 'app.crash',
			dimensions: {guild_id: guildId ?? 'unknown'},
			value: 1,
		});
	}

	batch(metrics: Array<BatchMetric>): void {
		for (const metric of metrics) {
			switch (metric.type) {
				case 'counter':
					recordCounter({
						name: metric.name,
						value: metric.value ?? 1,
						dimensions: metric.dimensions,
					});
					break;
				case 'gauge':
					recordGauge({
						name: metric.name,
						value: metric.value ?? 0,
						dimensions: metric.dimensions,
					});
					break;
				case 'histogram':
					if (metric.valueMs !== undefined) {
						recordHistogram({
							name: metric.name,
							valueMs: metric.valueMs,
							dimensions: metric.dimensions,
						});
					}
					break;
			}
		}
	}

	isEnabled(): boolean {
		return isTelemetryEnabled();
	}
}

let metricsServiceInstance: IMetricsService | null = null;

export function initializeMetricsService(): IMetricsService {
	if (!metricsServiceInstance) {
		metricsServiceInstance = new MetricsService();
	}
	return metricsServiceInstance;
}

export function getMetricsService(): IMetricsService {
	return initializeMetricsService();
}
