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

import {Logger} from '@app/lib/Logger';
import {makeAutoObservable} from 'mobx';

const logger = new Logger('RuntimeCrashStore');

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === 'string') {
		return new Error(error);
	}

	return new Error('Unknown runtime crash');
}

class RuntimeCrashStore {
	fatalError: Error | null = null;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	triggerFatalCrash(error: unknown): Error {
		const normalizedError = toError(error);
		if (this.fatalError) {
			return this.fatalError;
		}

		this.fatalError = normalizedError;
		logger.fatal('Triggering fatal runtime crash', normalizedError);
		return normalizedError;
	}

	reset(): void {
		this.fatalError = null;
	}
}

export default new RuntimeCrashStore();
