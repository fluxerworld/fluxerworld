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

import '@app/Instrument';
import {Config} from '@app/Config';
import {Logger} from '@app/Logger';
import {initializeConfig} from '@fluxer/api/src/Config';
import {initializeLogger} from '@fluxer/api/src/Logger';
import {startWorkerMain} from '@fluxer/api/src/worker/WorkerMain';

initializeConfig(Config);
initializeLogger(Logger);

startWorkerMain().catch((error) => {
	Logger.fatal({error}, 'Failed to start Fluxer API worker');
	process.exit(1);
});
