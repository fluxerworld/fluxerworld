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

import type {InstrumentationConfig, TelemetryConfig} from '@fluxer/telemetry/src/Telemetry';
import type {ITelemetryInitLogger} from '@fluxer/telemetry/src/telemetry_runtime/TelemetryLogger';
import type {Instrumentation} from '@opentelemetry/instrumentation';
import {HttpInstrumentation} from '@opentelemetry/instrumentation-http';
import {PinoInstrumentation} from '@opentelemetry/instrumentation-pino';

interface InstrumentationModule {
	[key: string]: new (...args: Array<unknown>) => Instrumentation;
}

interface OptionalInstrumentationDefinition {
	enabled: boolean;
	moduleName: string;
	className: string;
	config?: Record<string, unknown>;
}

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function getOptionalInstrumentationDefinitions(
	config: InstrumentationConfig,
): Array<OptionalInstrumentationDefinition> {
	return [
		{
			enabled: config.fetch !== false,
			moduleName: '@opentelemetry/instrumentation-fetch',
			className: 'FetchInstrumentation',
		},
		{
			enabled: config.cassandra === true,
			moduleName: '@opentelemetry/instrumentation-cassandra-driver',
			className: 'CassandraDriverInstrumentation',
		},
		{
			enabled: config.aws === true,
			moduleName: '@opentelemetry/instrumentation-aws-sdk',
			className: 'AwsInstrumentation',
			config: {suppressInternalInstrumentation: true},
		},
	];
}

async function loadOptionalInstrumentation(
	definition: OptionalInstrumentationDefinition,
	logger: ITelemetryInitLogger,
): Promise<Instrumentation | null> {
	try {
		const module = (await import(definition.moduleName)) as InstrumentationModule;
		const InstrumentationClass = module[definition.className];
		if (typeof InstrumentationClass !== 'function') {
			logger.info(
				{moduleName: definition.moduleName, className: definition.className},
				'Optional instrumentation class not found',
			);
			return null;
		}
		if (definition.config === undefined) {
			return new (InstrumentationClass as new () => Instrumentation)();
		}
		return new (InstrumentationClass as new (config: Record<string, unknown>) => Instrumentation)(definition.config);
	} catch (error) {
		logger.info(
			{moduleName: definition.moduleName, className: definition.className, error: formatError(error)},
			'Optional instrumentation not available',
		);
		return null;
	}
}

export async function createTelemetryInstrumentations(
	config: TelemetryConfig,
	logger: ITelemetryInitLogger,
): Promise<Array<Instrumentation>> {
	const ignoredIncomingPaths = new Set(config.ignoreIncomingPaths);
	const instrumentations: Array<Instrumentation> = [
		new HttpInstrumentation({
			ignoreIncomingRequestHook: (request) => {
				const path = request.url?.split('?')[0];
				if (path === undefined) {
					return false;
				}
				return ignoredIncomingPaths.has(path);
			},
		}),
		new PinoInstrumentation(),
	];

	const optionalInstrumentationConfig = config.instrumentations ?? {};
	const optionalInstrumentationDefinitions = getOptionalInstrumentationDefinitions(optionalInstrumentationConfig);
	for (const definition of optionalInstrumentationDefinitions) {
		if (!definition.enabled) {
			continue;
		}
		const instrumentation = await loadOptionalInstrumentation(definition, logger);
		if (instrumentation !== null) {
			instrumentations.push(instrumentation);
		}
	}

	return instrumentations;
}
