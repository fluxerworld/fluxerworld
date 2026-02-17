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

import type {CronSchedule, CronStats} from '@fluxer/queue/src/domain/QueueDomainTypes';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';

export interface ICronScheduler {
	start(): Promise<void>;
	stop(): Promise<void>;
	upsert(
		id: string,
		taskType: string,
		payload: JsonValue,
		cronExpression: string,
		enabled?: boolean,
	): Promise<CronSchedule>;
	delete(id: string): Promise<boolean>;
	get(id: string): CronSchedule | null;
	list(): Array<CronSchedule>;
	getStats(): CronStats;
}
