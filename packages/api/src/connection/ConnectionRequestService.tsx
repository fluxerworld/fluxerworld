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
import {signInitiationToken, verifyInitiationToken} from '@fluxer/api/src/connection/ConnectionInitiationToken';
import {mapConnectionToResponse} from '@fluxer/api/src/connection/ConnectionMappers';
import {ConnectionInitiationTokenInvalidError} from '@fluxer/api/src/connection/errors/ConnectionInitiationTokenInvalidError';
import type {IConnectionService} from '@fluxer/api/src/connection/IConnectionService';
import {
	CONNECTION_INITIATION_TOKEN_EXPIRY_MS,
	type ConnectionType,
	ConnectionTypes,
} from '@fluxer/constants/src/ConnectionConstants';
import type {
	ConnectionResponse,
	ConnectionVerificationResponse,
	CreateConnectionRequest,
	UpdateConnectionRequest,
	VerifyAndCreateConnectionRequest,
} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';

export class ConnectionRequestService {
	constructor(
		private readonly connectionService: IConnectionService,
		private readonly connectionInitiationSecret: string,
	) {}

	async listConnections(userId: UserID): Promise<Array<ConnectionResponse>> {
		const rows = await this.connectionService.getConnectionsForUser(userId);
		return rows.sort((a, b) => a.sort_order - b.sort_order).map((row) => mapConnectionToResponse(row));
	}

	async initiateConnection(userId: UserID, body: CreateConnectionRequest): Promise<ConnectionVerificationResponse> {
		const result = await this.connectionService.initiateConnection(userId, body.type, body.identifier);
		const instructions = this.generateVerificationInstructions(body.type, body.identifier);
		const initiationToken = signInitiationToken(
			{
				userId: String(userId),
				type: body.type,
				identifier: body.identifier,
				verificationCode: result.verificationCode,
				expiresAt: Date.now() + CONNECTION_INITIATION_TOKEN_EXPIRY_MS,
			},
			this.connectionInitiationSecret,
		);

		return {
			token: result.verificationCode,
			type: body.type,
			id: body.identifier,
			instructions,
			initiation_token: initiationToken,
		};
	}

	async verifyAndCreateConnection(userId: UserID, body: VerifyAndCreateConnectionRequest): Promise<ConnectionResponse> {
		const payload = verifyInitiationToken(body.initiation_token, this.connectionInitiationSecret);
		if (!payload || payload.userId !== String(userId)) {
			throw new ConnectionInitiationTokenInvalidError();
		}

		const row = await this.connectionService.verifyAndCreateConnection(
			userId,
			payload.type,
			payload.identifier,
			payload.verificationCode,
			body.visibility_flags ?? 1,
		);
		return mapConnectionToResponse(row);
	}

	async updateConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
		body: UpdateConnectionRequest,
	): Promise<void> {
		await this.connectionService.updateConnection(userId, connectionType, connectionId, body);
	}

	async deleteConnection(userId: UserID, connectionType: ConnectionType, connectionId: string): Promise<void> {
		await this.connectionService.deleteConnection(userId, connectionType, connectionId);
	}

	async verifyConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
	): Promise<ConnectionResponse> {
		const row = await this.connectionService.verifyConnection(userId, connectionType, connectionId);
		return mapConnectionToResponse(row);
	}

	async reorderConnections(userId: UserID, connectionIds: Array<string>): Promise<void> {
		await this.connectionService.reorderConnections(userId, connectionIds);
	}

	private generateVerificationInstructions(connectionType: ConnectionType, identifier: string): string {
		switch (connectionType) {
			case ConnectionTypes.DOMAIN:
				return `Add a DNS TXT record at _fluxer.${identifier} with the value fluxer-verification=<token>, or serve the token at https://${identifier}/.well-known/fluxer-verification`;
			default:
				return 'Follow the platform-specific verification instructions';
		}
	}
}
