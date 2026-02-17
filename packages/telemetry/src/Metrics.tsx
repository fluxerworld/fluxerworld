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

import {type Attributes, type Counter, type Histogram, type Meter, metrics} from '@opentelemetry/api';

const METER_NAME = 'fluxer.telemetry';

export interface CounterMetric {
	name: string;
	value?: number;
	dimensions?: Record<string, string>;
}

export interface HistogramMetric {
	name: string;
	valueMs: number;
	dimensions?: Record<string, string>;
}

export interface GaugeMetric {
	name: string;
	value: number;
	dimensions?: Record<string, string>;
}

interface IMetricRegistry {
	getCounter(name: string, description?: string): Counter<Attributes>;
	getHistogram(name: string, description?: string): Histogram<Attributes>;
}

class TelemetryMetricRegistry implements IMetricRegistry {
	private readonly counters = new Map<string, Counter<Attributes>>();
	private readonly histograms = new Map<string, Histogram<Attributes>>();
	private readonly meter: Meter;

	public constructor() {
		this.meter = metrics.getMeter(METER_NAME);
	}

	public getCounter(name: string, description?: string): Counter<Attributes> {
		const existingCounter = this.counters.get(name);
		if (existingCounter !== undefined) {
			return existingCounter;
		}
		const counter = this.meter.createCounter(name, {
			description: description ?? `Counter for ${name}`,
		});
		this.counters.set(name, counter);
		return counter;
	}

	public getHistogram(name: string, description?: string): Histogram<Attributes> {
		const existingHistogram = this.histograms.get(name);
		if (existingHistogram !== undefined) {
			return existingHistogram;
		}
		const histogram = this.meter.createHistogram(name, {
			description: description ?? `Histogram for ${name}`,
		});
		this.histograms.set(name, histogram);
		return histogram;
	}
}

const metricRegistry = new TelemetryMetricRegistry();

function toAttributes(dimensions?: Record<string, string>): Attributes {
	if (dimensions === undefined) {
		return {};
	}
	return {...dimensions};
}

export function createCounter(name: string, description?: string): Counter<Attributes> {
	return metricRegistry.getCounter(name, description);
}

export function createHistogram(name: string, description?: string): Histogram<Attributes> {
	return metricRegistry.getHistogram(name, description);
}

export function recordCounter(name: string, value?: number, attributes?: Attributes): void;
export function recordCounter(metric: CounterMetric): void;
export function recordCounter(nameOrMetric: string | CounterMetric, value: number = 1, attributes?: Attributes): void {
	if (typeof nameOrMetric === 'string') {
		createCounter(nameOrMetric).add(value, attributes);
		return;
	}
	createCounter(nameOrMetric.name).add(nameOrMetric.value ?? 1, toAttributes(nameOrMetric.dimensions));
}

export function recordHistogram(name: string, value: number, attributes?: Attributes): void;
export function recordHistogram(metric: HistogramMetric): void;
export function recordHistogram(nameOrMetric: string | HistogramMetric, value?: number, attributes?: Attributes): void {
	if (typeof nameOrMetric === 'string') {
		if (value === undefined) {
			throw new Error(`Histogram metric "${nameOrMetric}" requires a numeric value`);
		}
		createHistogram(nameOrMetric).record(value, attributes);
		return;
	}
	createHistogram(nameOrMetric.name).record(nameOrMetric.valueMs, toAttributes(nameOrMetric.dimensions));
}

export function recordGauge(metric: GaugeMetric): void {
	createHistogram(metric.name).record(metric.value, toAttributes(metric.dimensions));
}
