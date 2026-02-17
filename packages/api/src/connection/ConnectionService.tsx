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

import {randomBytes, randomUUID} from 'node:crypto';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {IBlueskyOAuthService} from '@fluxer/api/src/bluesky/IBlueskyOAuthService';
import {mapConnectionToResponse} from '@fluxer/api/src/connection/ConnectionMappers';
import {BlueskyOAuthNotEnabledError} from '@fluxer/api/src/connection/errors/BlueskyOAuthNotEnabledError';
import {ConnectionAlreadyExistsError} from '@fluxer/api/src/connection/errors/ConnectionAlreadyExistsError';
import {ConnectionInvalidTypeError} from '@fluxer/api/src/connection/errors/ConnectionInvalidTypeError';
import {ConnectionLimitReachedError} from '@fluxer/api/src/connection/errors/ConnectionLimitReachedError';
import {ConnectionNotFoundError} from '@fluxer/api/src/connection/errors/ConnectionNotFoundError';
import {ConnectionVerificationFailedError} from '@fluxer/api/src/connection/errors/ConnectionVerificationFailedError';
import type {IConnectionRepository, UpdateConnectionParams} from '@fluxer/api/src/connection/IConnectionRepository';
import {IConnectionService, type InitiateConnectionResult} from '@fluxer/api/src/connection/IConnectionService';
import {BlueskyOAuthVerifier} from '@fluxer/api/src/connection/verification/BlueskyOAuthVerifier';
import {DomainConnectionVerifier} from '@fluxer/api/src/connection/verification/DomainConnectionVerifier';
import type {IConnectionVerifier} from '@fluxer/api/src/connection/verification/IConnectionVerifier';
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {
	CONNECTION_VERIFICATION_TOKEN_LENGTH,
	type ConnectionType,
	ConnectionTypes,
	ConnectionVisibilityFlags,
	MAX_CONNECTIONS_PER_USER,
} from '@fluxer/constants/src/ConnectionConstants';

export class ConnectionService extends IConnectionService {
	constructor(
		private readonly repository: IConnectionRepository,
		private readonly gateway: IGatewayService,
		private readonly blueskyOAuthService: IBlueskyOAuthService | null,
	) {
		super();
	}

	async getConnectionsForUser(userId: UserID): Promise<Array<UserConnectionRow>> {
		return this.repository.findByUserId(userId);
	}

	async initiateConnection(
		userId: UserID,
		type: ConnectionType,
		identifier: string,
	): Promise<InitiateConnectionResult> {
		if (type === ConnectionTypes.BLUESKY) {
			throw new BlueskyOAuthNotEnabledError();
		}
		if (type !== ConnectionTypes.DOMAIN) {
			throw new ConnectionInvalidTypeError();
		}

		const count = await this.repository.count(userId);
		if (count >= MAX_CONNECTIONS_PER_USER) {
			throw new ConnectionLimitReachedError();
		}

		const existing = await this.repository.findByTypeAndIdentifier(userId, type, identifier);
		if (existing) {
			throw new ConnectionAlreadyExistsError();
		}

		const verificationCode = randomBytes(CONNECTION_VERIFICATION_TOKEN_LENGTH).toString('hex');
		return {verificationCode};
	}

	private normalizeVisibilityFlags(flags: number): number {
		let normalized = flags;

		const hasEveryone = (normalized & ConnectionVisibilityFlags.EVERYONE) === ConnectionVisibilityFlags.EVERYONE;
		const hasFriends = (normalized & ConnectionVisibilityFlags.FRIENDS) === ConnectionVisibilityFlags.FRIENDS;
		const hasMutualGuilds =
			(normalized & ConnectionVisibilityFlags.MUTUAL_GUILDS) === ConnectionVisibilityFlags.MUTUAL_GUILDS;

		if (hasEveryone && hasFriends && hasMutualGuilds) {
			normalized =
				ConnectionVisibilityFlags.EVERYONE |
				ConnectionVisibilityFlags.FRIENDS |
				ConnectionVisibilityFlags.MUTUAL_GUILDS;
		}

		return normalized;
	}

	async verifyAndCreateConnection(
		userId: UserID,
		type: ConnectionType,
		identifier: string,
		verificationCode: string,
		visibilityFlags: number,
	): Promise<UserConnectionRow> {
		if (type === ConnectionTypes.BLUESKY) {
			throw new BlueskyOAuthNotEnabledError();
		}
		if (type !== ConnectionTypes.DOMAIN) {
			throw new ConnectionInvalidTypeError();
		}

		const count = await this.repository.count(userId);
		if (count >= MAX_CONNECTIONS_PER_USER) {
			throw new ConnectionLimitReachedError();
		}

		const existing = await this.repository.findByTypeAndIdentifier(userId, type, identifier);
		if (existing) {
			throw new ConnectionAlreadyExistsError();
		}

		const verifier = this.getVerifier(type);
		const isValid = await verifier.verify({identifier, verification_token: verificationCode});
		if (!isValid) {
			throw new ConnectionVerificationFailedError();
		}

		const connectionId = randomUUID();
		const sortOrder = count;
		const now = new Date();

		const created = await this.repository.create({
			user_id: userId,
			connection_id: connectionId,
			connection_type: type,
			identifier,
			name: identifier,
			visibility_flags: this.normalizeVisibilityFlags(visibilityFlags),
			sort_order: sortOrder,
			verification_token: verificationCode,
			verified: true,
			verified_at: now,
			last_verified_at: now,
		});

		const connections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: connections.map(mapConnectionToResponse)},
		});

		return created;
	}

	async updateConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
		patch: UpdateConnectionParams,
	): Promise<void> {
		const connection = await this.repository.findById(userId, connectionType, connectionId);
		if (!connection) {
			throw new ConnectionNotFoundError();
		}

		const normalizedPatch =
			patch.visibility_flags !== undefined
				? {...patch, visibility_flags: this.normalizeVisibilityFlags(patch.visibility_flags)}
				: patch;

		await this.repository.update(userId, connectionType, connectionId, normalizedPatch);

		const connections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: connections.map(mapConnectionToResponse)},
		});
	}

	async deleteConnection(userId: UserID, connectionType: ConnectionType, connectionId: string): Promise<void> {
		const connection = await this.repository.findById(userId, connectionType, connectionId);
		if (!connection) {
			throw new ConnectionNotFoundError();
		}

		await this.repository.delete(userId, connectionType, connectionId);

		const connections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: connections.map(mapConnectionToResponse)},
		});
	}

	async verifyConnection(
		userId: UserID,
		connectionType: ConnectionType,
		connectionId: string,
	): Promise<UserConnectionRow> {
		const connection = await this.repository.findById(userId, connectionType, connectionId);
		if (!connection) {
			throw new ConnectionNotFoundError();
		}

		const {isValid, updateParams} = await this.revalidateConnection(connection);

		if (updateParams) {
			await this.repository.update(userId, connectionType, connectionId, updateParams);
		}

		const updated = await this.repository.findById(userId, connectionType, connectionId);
		if (!updated) {
			throw new ConnectionNotFoundError();
		}

		if (!isValid) {
			throw new ConnectionVerificationFailedError();
		}

		const connections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: connections.map(mapConnectionToResponse)},
		});

		return updated;
	}

	async reorderConnections(userId: UserID, connectionIds: Array<string>): Promise<void> {
		const connections = await this.repository.findByUserId(userId);

		for (let i = 0; i < connectionIds.length; i++) {
			const connectionId = connectionIds[i];
			const connection = connections.find((c) => c.connection_id === connectionId);
			if (connection) {
				await this.repository.update(userId, connection.connection_type, connectionId, {
					sort_order: i,
				});
			}
		}

		const updatedConnections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: updatedConnections.map(mapConnectionToResponse)},
		});
	}

	async createOrUpdateBlueskyConnection(userId: UserID, did: string, handle: string): Promise<UserConnectionRow> {
		const existing = await this.repository.findByTypeAndIdentifier(userId, ConnectionTypes.BLUESKY, did);

		if (existing) {
			const now = new Date();
			await this.repository.update(userId, ConnectionTypes.BLUESKY, existing.connection_id, {
				name: handle,
				verified: true,
				verified_at: existing.verified_at ?? now,
				last_verified_at: now,
			});

			const updated = await this.repository.findById(userId, ConnectionTypes.BLUESKY, existing.connection_id);
			const connections = await this.repository.findByUserId(userId);
			await this.gateway.dispatchPresence({
				userId,
				event: 'USER_CONNECTIONS_UPDATE',
				data: {connections: connections.map(mapConnectionToResponse)},
			});
			return updated!;
		}

		const count = await this.repository.count(userId);
		if (count >= MAX_CONNECTIONS_PER_USER) {
			throw new ConnectionLimitReachedError();
		}

		const connectionId = randomUUID();
		const now = new Date();

		const created = await this.repository.create({
			user_id: userId,
			connection_id: connectionId,
			connection_type: ConnectionTypes.BLUESKY,
			identifier: did,
			name: handle,
			visibility_flags: ConnectionVisibilityFlags.EVERYONE,
			sort_order: count,
			verification_token: '',
			verified: true,
			verified_at: now,
			last_verified_at: now,
		});

		const connections = await this.repository.findByUserId(userId);
		await this.gateway.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: connections.map(mapConnectionToResponse)},
		});

		return created;
	}

	async revalidateConnection(connection: UserConnectionRow): Promise<{
		isValid: boolean;
		updateParams: UpdateConnectionParams | null;
	}> {
		const verifier = this.getVerifier(connection.connection_type);
		const isValid = await verifier.verify({
			identifier: connection.identifier,
			verification_token: connection.verification_token,
		});

		const now = new Date();

		if (!isValid && connection.verified) {
			return {
				isValid: false,
				updateParams: {
					verified: false,
					verified_at: null,
					last_verified_at: now,
				},
			};
		}

		if (isValid) {
			return {
				isValid: true,
				updateParams: {
					verified: true,
					verified_at: connection.verified_at ? connection.verified_at : now,
					last_verified_at: now,
				},
			};
		}

		return {isValid: false, updateParams: null};
	}

	private getVerifier(type: ConnectionType): IConnectionVerifier {
		if (type === ConnectionTypes.BLUESKY) {
			if (!this.blueskyOAuthService) {
				throw new BlueskyOAuthNotEnabledError();
			}
			return new BlueskyOAuthVerifier(this.blueskyOAuthService);
		}
		if (type === ConnectionTypes.DOMAIN) {
			return new DomainConnectionVerifier();
		}
		throw new ConnectionInvalidTypeError();
	}
}
