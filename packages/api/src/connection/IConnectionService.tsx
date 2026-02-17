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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {UpdateConnectionParams} from '@fluxer/api/src/connection/IConnectionRepository';
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';

export interface InitiateConnectionResult {
	verificationCode: string;
}

export abstract class IConnectionService {
	abstract getConnectionsForUser(userId: UserID): Promise<Array<UserConnectionRow>>;
	abstract initiateConnection(
		userId: UserID,
		type: ConnectionType,
		identifier: string,
	): Promise<InitiateConnectionResult>;
	abstract verifyAndCreateConnection(
		userId: UserID,
		type: ConnectionType,
		identifier: string,
		verificationCode: string,
		visibilityFlags: number,
	): Promise<UserConnectionRow>;
	abstract updateConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
		patch: UpdateConnectionParams,
	): Promise<void>;
	abstract deleteConnection(userId: UserID, connectionType: ConnectionType, connectionId: string): Promise<void>;
	abstract verifyConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
	): Promise<UserConnectionRow>;
	abstract reorderConnections(userId: UserID, connectionIds: Array<string>): Promise<void>;
	abstract revalidateConnection(connection: UserConnectionRow): Promise<{
		isValid: boolean;
		updateParams: UpdateConnectionParams | null;
	}>;
	abstract createOrUpdateBlueskyConnection(userId: UserID, did: string, handle: string): Promise<UserConnectionRow>;
}
