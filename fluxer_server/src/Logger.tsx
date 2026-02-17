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

import {createLogger, type Logger as FluxerLogger} from '@fluxer/logger/src/Logger';

let _logger: FluxerLogger | null = null;

export interface LoggerInitOptions {
	environment: string;
}

export function initializeLogger(options: LoggerInitOptions): FluxerLogger {
	if (_logger !== null) {
		return _logger;
	}
	_logger = createLogger('fluxer-server', {environment: options.environment});
	return _logger;
}

export function getLogger(): FluxerLogger {
	if (_logger === null) {
		throw new Error('Logger has not been initialized. Call initializeLogger() first.');
	}
	return _logger;
}

export const Logger: FluxerLogger = new Proxy({} as FluxerLogger, {
	get(_target, prop: keyof FluxerLogger | symbol) {
		if (_logger === null) {
			throw new Error('Logger has not been initialized. Call initializeLogger() first.');
		}
		const value = _logger[prop as keyof FluxerLogger];
		if (typeof value === 'function') {
			return value.bind(_logger);
		}
		return value;
	},
	set() {
		throw new Error('Cannot modify Logger directly. Use initializeLogger() instead.');
	},
});

export type Logger = FluxerLogger;

export function createComponentLogger(component: string): FluxerLogger {
	return getLogger().child({component});
}
