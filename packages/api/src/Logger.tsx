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

import type {ILogger} from '@fluxer/api/src/ILogger';

let _logger: ILogger | null = null;

export function initializeLogger(logger: ILogger): void {
	if (_logger !== null) {
		return;
	}
	_logger = logger;
}

export function getLogger(): ILogger {
	if (_logger === null) {
		throw new Error('Logger has not been initialized. Call initializeLogger() first.');
	}
	return _logger;
}

export function resetLogger(): void {
	_logger = null;
}

export const Logger: ILogger = new Proxy({} as ILogger, {
	get(_target, prop: keyof ILogger | symbol) {
		if (_logger === null) {
			throw new Error('Logger has not been initialized. Call initializeLogger() first.');
		}
		const value = _logger[prop as keyof ILogger];
		if (typeof value === 'function') {
			return value.bind(_logger);
		}
		return value;
	},
	set() {
		throw new Error('Cannot modify Logger directly. Use initializeLogger() instead.');
	},
});
