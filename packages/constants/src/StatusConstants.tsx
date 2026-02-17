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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const StatusTypes = {
	ONLINE: 'online',
	DND: 'dnd',
	IDLE: 'idle',
	INVISIBLE: 'invisible',
	OFFLINE: 'offline',
} as const;

export type StatusType = ValueOf<typeof StatusTypes>;

const STATUS_VALUES = Object.values(StatusTypes) as Array<StatusType>;
const STATUS_SET = new Set<StatusType>(STATUS_VALUES);

export function isStatusType(value: unknown): value is StatusType {
	return typeof value === 'string' && STATUS_SET.has(value as StatusType);
}

export function normalizeStatus(value: unknown): StatusType {
	return isStatusType(value) ? value : StatusTypes.OFFLINE;
}

export const OFFLINE_STATUS_TYPES: Set<StatusType> = new Set([StatusTypes.OFFLINE, StatusTypes.INVISIBLE]);

export function isOfflineStatus(
	status: StatusType,
): status is typeof StatusTypes.OFFLINE | typeof StatusTypes.INVISIBLE {
	return status === StatusTypes.OFFLINE || status === StatusTypes.INVISIBLE;
}
