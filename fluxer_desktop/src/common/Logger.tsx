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

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';
import log from 'electron-log';

log.transports.file.level = BUILD_CHANNEL === 'canary' ? 'debug' : 'info';
log.transports.console.level = BUILD_CHANNEL === 'canary' ? 'debug' : 'info';

export const Logger = {
	debug: (...args: Array<unknown>) => log.debug(...args),
	info: (...args: Array<unknown>) => log.info(...args),
	warn: (...args: Array<unknown>) => log.warn(...args),
	error: (...args: Array<unknown>) => log.error(...args),
};

export function createChildLogger(componentName: string): typeof Logger {
	const prefix = `[${componentName}]`;
	return {
		debug: (...args: Array<unknown>) => log.debug(prefix, ...args),
		info: (...args: Array<unknown>) => log.info(prefix, ...args),
		warn: (...args: Array<unknown>) => log.warn(prefix, ...args),
		error: (...args: Array<unknown>) => log.error(prefix, ...args),
	};
}
