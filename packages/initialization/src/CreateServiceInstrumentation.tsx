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

import {startServiceInitialization} from '@fluxer/initialization/src/Init';
import type {ShutdownFn} from '@fluxer/initialization/src/ServiceInitializationTypes';
import type {InstrumentationConfig} from '@fluxer/telemetry/src/Telemetry';

interface CreateServiceInstrumentationOptions {
	serviceName: string;
	config: {
		env: string;
		telemetry: {
			enabled: boolean;
			otlp_endpoint: string;
			api_key: string;
			trace_sampling_ratio: number;
		};
		sentry: {
			enabled: boolean;
			dsn: string;
		};
	};
	ignoreIncomingPaths?: Array<string>;
	instrumentations?: InstrumentationConfig;
}

export function createServiceInstrumentation(options: CreateServiceInstrumentationOptions): ShutdownFn {
	const {serviceName, config, ignoreIncomingPaths = ['/_health'], instrumentations = {fetch: true}} = options;

	return startServiceInitialization({
		serviceName,
		environment: config.env,
		telemetry: {
			enabled: config.telemetry.enabled,
			otlpEndpoint: config.telemetry.otlp_endpoint,
			apiKey: config.telemetry.api_key,
			traceSamplingRatio: config.telemetry.trace_sampling_ratio,
			ignoreIncomingPaths,
			instrumentations,
		},
		sentry: {
			enabled: config.sentry.enabled,
			dsn: config.sentry.dsn,
		},
	});
}
