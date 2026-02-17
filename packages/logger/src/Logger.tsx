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

import {createRequire} from 'node:module';
import {context, trace} from '@opentelemetry/api';
import pino, {type LogFn, type Logger as PinoLogger} from 'pino';

export interface LoggerOptions {
	level?: pino.Level;

	environment?: string;

	telemetryEnabled?: boolean;

	otlpEndpoint?: string;

	apiKey?: string;

	serviceVersion?: string;

	baseProperties?: Record<string, unknown>;
}

interface PinoTransportOptions {
	target: string;
	options?: Record<string, unknown>;
	caller?: Array<string>;
	worker?: {
		autoEnd?: boolean;
		endTimeout?: number;
	};
}

interface PinoTransportWithEvents {
	write(msg: string): void;
	on?(event: string, handler: (error: unknown) => void): void;
}

function isDevelopment(environment: string): boolean {
	return environment === 'development';
}

function injectTraceContext(args: Array<unknown>): Array<unknown> {
	const span = trace.getSpan(context.active());
	if (!span) {
		return args;
	}

	const spanContext = span.spanContext();
	if (!spanContext || !spanContext.traceId) {
		return args;
	}

	const traceInfo = {
		trace_id: spanContext.traceId,
		span_id: spanContext.spanId,
	};

	const [first, ...rest] = args;
	if (typeof first === 'object' && first !== null) {
		return [{...first, ...traceInfo}, ...rest];
	}

	return [traceInfo, ...args];
}

function createPinoLogger(serviceName: string, options: LoggerOptions = {}): PinoLogger {
	const environment = options.environment ?? 'production';
	const isDev = isDevelopment(environment);
	const telemetryEnabled = options.telemetryEnabled ?? false;
	const otlpEndpoint = options.otlpEndpoint;
	const apiKey = options.apiKey;
	const level = options.level ?? (isDev ? 'debug' : 'info');

	const streams: Array<pino.StreamEntry> = [];

	if (isDev) {
		try {
			const require = createRequire(import.meta.url);
			const pinoPrettyTarget = require.resolve('pino-pretty');
			streams.push({
				level: 'trace',
				stream: pino.transport({
					target: pinoPrettyTarget,
					options: {
						colorize: true,
						translateTime: 'HH:MM:ss.l',
						ignore: 'pid,hostname',
						messageFormat: '{msg}',
					},
					sync: true,
				} as PinoTransportOptions),
			});
		} catch (error) {
			console.warn('pino-pretty not available, falling back to stdout', error);
			streams.push({
				level: 'trace',
				stream: pino.destination({dest: 1, sync: true}),
			});
		}
	} else {
		streams.push({
			level: 'trace',
			stream: pino.destination({dest: 1, sync: false}),
		});
	}

	if (telemetryEnabled && otlpEndpoint) {
		try {
			const baseEndpoint = otlpEndpoint.replace(/\/+$/, '');
			let otlpDisabled = false;

			const otlpTransport = pino.transport({
				target: 'pino-opentelemetry-transport',
				options: {
					loggerName: serviceName,
					serviceVersion: options.serviceVersion ?? 'dev',
					resourceAttributes: {
						'service.name': serviceName,
						'service.namespace': 'fluxer',
						'deployment.environment': environment,
					},
					logRecordProcessorOptions: {
						recordProcessorType: 'batch',
						exporterOptions: {
							protocol: 'http/protobuf',
							protobufExporterOptions: {
								url: `${baseEndpoint}/v1/logs`,
								headers: apiKey ? {Authorization: `Bearer ${apiKey}`} : undefined,
							},
						},
					},
				},
				caller: [import.meta.url],
			} as PinoTransportOptions);

			const transportWithEvents = otlpTransport as PinoTransportWithEvents;

			if (transportWithEvents.on) {
				transportWithEvents.on('error', (error) => {
					otlpDisabled = true;
					console.warn('pino-opentelemetry transport error; disabling OTLP log export', error);
				});
			}

			streams.push({
				level: isDev ? 'debug' : 'info',
				stream: {
					write(msg: string) {
						if (otlpDisabled) return;
						try {
							otlpTransport.write(msg);
						} catch (error) {
							console.warn('pino-opentelemetry write error; disabling OTLP log export', error);
							otlpDisabled = true;
						}
					},
				},
			});
		} catch (error) {
			console.warn('Failed to initialize pino-opentelemetry transport', error);
		}
	}

	const destination =
		streams.length === 1 && streams[0] ? streams[0].stream : pino.multistream(streams, {dedupe: true});

	const pinoOptions: pino.LoggerOptions = {
		level,
		formatters: {
			level: (label) => ({level: label}),
		},
		errorKey: 'error',
		serializers: {
			reason: (value) => {
				if (value instanceof Error) {
					return pino.stdSerializers.err(value);
				}
				return value;
			},
			err: pino.stdSerializers.err,
			error: pino.stdSerializers.err,
		},
		timestamp: pino.stdTimeFunctions.isoTime,
		base: {
			service: serviceName,
			env: environment,
			...options.baseProperties,
		},
		hooks: {
			logMethod(args, method: LogFn) {
				const tuned = injectTraceContext(args as Array<unknown>);
				method.apply(this, tuned as Parameters<LogFn>);
			},
		},
	};

	return pino(pinoOptions, destination);
}

export class Logger {
	private logger: PinoLogger;

	constructor(serviceName: string, options: LoggerOptions = {}) {
		this.logger = createPinoLogger(serviceName, options);
	}

	getPinoLogger(): PinoLogger {
		return this.logger;
	}

	setPinoLogger(logger: PinoLogger): void {
		this.logger = logger;
	}

	static createWithLogger(logger: PinoLogger): Logger {
		const childLogger = new Logger('', {});
		childLogger.setPinoLogger(logger);
		return childLogger;
	}

	trace(obj: Record<string, unknown>, msg?: string): void;
	trace(msg: string): void;
	trace(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.trace(objOrMsg);
		} else if (msg) {
			this.logger.trace(objOrMsg, msg);
		} else {
			this.logger.trace(objOrMsg);
		}
	}

	debug(obj: Record<string, unknown>, msg?: string): void;
	debug(msg: string): void;
	debug(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.debug(objOrMsg);
		} else if (msg) {
			this.logger.debug(objOrMsg, msg);
		} else {
			this.logger.debug(objOrMsg);
		}
	}

	info(obj: Record<string, unknown>, msg?: string): void;
	info(msg: string): void;
	info(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.info(objOrMsg);
		} else if (msg) {
			this.logger.info(objOrMsg, msg);
		} else {
			this.logger.info(objOrMsg);
		}
	}

	warn(obj: Record<string, unknown>, msg?: string): void;
	warn(msg: string): void;
	warn(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.warn(objOrMsg);
		} else if (msg) {
			this.logger.warn(objOrMsg, msg);
		} else {
			this.logger.warn(objOrMsg);
		}
	}

	error(obj: Record<string, unknown>, msg?: string): void;
	error(msg: string): void;
	error(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.error(objOrMsg);
		} else if (msg) {
			this.logger.error(objOrMsg, msg);
		} else {
			this.logger.error(objOrMsg);
		}
	}

	fatal(obj: Record<string, unknown>, msg?: string): void;
	fatal(msg: string): void;
	fatal(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			this.logger.fatal(objOrMsg);
		} else if (msg) {
			this.logger.fatal(objOrMsg, msg);
		} else {
			this.logger.fatal(objOrMsg);
		}
	}

	child(bindings: Record<string, unknown>): Logger {
		const childPinoLogger = this.logger.child(bindings);
		return Logger.createWithLogger(childPinoLogger);
	}

	get pino(): PinoLogger {
		return this.logger;
	}
}

export function createLogger(serviceName: string, options?: LoggerOptions): Logger {
	return new Logger(serviceName, options);
}
