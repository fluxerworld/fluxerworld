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

import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import UserConnectionStore from '@app/stores/UserConnectionStore';
import * as ApiErrorUtils from '@app/utils/ApiErrorUtils';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';
import type {
	ConnectionListResponse,
	ConnectionResponse,
	ConnectionVerificationResponse,
	CreateConnectionRequest,
	ReorderConnectionsRequest,
	UpdateConnectionRequest,
	VerifyAndCreateConnectionRequest,
} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('Connections');

function showErrorToast(i18n: I18n, error: unknown, fallbackMessage: MessageDescriptor): void {
	const errorMessage = ApiErrorUtils.getApiErrorMessage(error);

	ToastActionCreators.createToast({
		type: 'error',
		children: errorMessage ?? i18n._(fallbackMessage),
	});
}

export async function fetchConnections(): Promise<void> {
	try {
		const response = await http.get<ConnectionListResponse>(Endpoints.CONNECTIONS);
		UserConnectionStore.setConnections(response.body);
		logger.debug('Successfully fetched connections');
	} catch (error) {
		logger.error('Failed to fetch connections:', error);
		throw error;
	}
}

export async function initiateConnection(
	i18n: I18n,
	type: ConnectionType,
	identifier: string,
): Promise<ConnectionVerificationResponse> {
	try {
		const payload: CreateConnectionRequest = {
			type,
			identifier,
		};

		const response = await http.post<ConnectionVerificationResponse>(Endpoints.CONNECTIONS, payload);
		logger.debug(`Successfully initiated connection: ${type}/${identifier}`);
		return response.body;
	} catch (error) {
		logger.error(`Failed to initiate connection ${type}/${identifier}:`, error);
		showErrorToast(i18n, error, msg`Failed to initiate connection`);
		throw error;
	}
}

export async function authorizeBlueskyConnection(i18n: I18n, handle: string): Promise<void> {
	try {
		const response = await http.post<{authorize_url: string}>(Endpoints.BLUESKY_AUTHORIZE, {handle});
		window.open(response.body.authorize_url, '_blank');
	} catch (error) {
		logger.error(`Failed to start Bluesky OAuth flow for ${handle}:`, error);
		showErrorToast(i18n, error, msg`Failed to start Bluesky authorisation`);
		throw error;
	}
}

export async function verifyAndCreateConnection(
	i18n: I18n,
	initiationToken: string,
	visibilityFlags?: number,
): Promise<ConnectionResponse> {
	try {
		const payload: VerifyAndCreateConnectionRequest = {
			initiation_token: initiationToken,
			visibility_flags: visibilityFlags,
		};

		const response = await http.post<ConnectionResponse>(Endpoints.CONNECTIONS_VERIFY_AND_CREATE, payload);
		UserConnectionStore.addConnection(response.body);

		ToastActionCreators.createToast({
			type: 'success',
			children: i18n._(msg`Connection verified`),
		});

		logger.debug('Successfully verified and created connection');
		return response.body;
	} catch (error) {
		logger.error('Failed to verify and create connection:', error);
		showErrorToast(i18n, error, msg`Failed to verify connection`);
		throw error;
	}
}

export async function updateConnection(
	i18n: I18n,
	type: string,
	connectionId: string,
	patch: UpdateConnectionRequest,
): Promise<void> {
	try {
		await http.patch(Endpoints.CONNECTION(type, connectionId), patch);
		UserConnectionStore.updateConnection(connectionId, patch);

		ToastActionCreators.createToast({
			type: 'success',
			children: i18n._(msg`Connection updated`),
		});

		logger.debug(`Successfully updated connection: ${type}/${connectionId}`);
	} catch (error) {
		logger.error(`Failed to update connection ${type}/${connectionId}:`, error);
		throw error;
	}
}

export async function deleteConnection(i18n: I18n, type: string, connectionId: string): Promise<void> {
	try {
		await http.delete({url: Endpoints.CONNECTION(type, connectionId)});
		UserConnectionStore.removeConnection(connectionId);

		ToastActionCreators.createToast({
			type: 'success',
			children: i18n._(msg`Connection removed`),
		});

		logger.debug(`Successfully deleted connection: ${type}/${connectionId}`);
	} catch (error) {
		logger.error(`Failed to delete connection ${type}/${connectionId}:`, error);
		throw error;
	}
}

export async function verifyConnection(i18n: I18n, type: string, connectionId: string): Promise<void> {
	try {
		const response = await http.post<ConnectionResponse>(Endpoints.CONNECTION_VERIFY(type, connectionId), {});
		UserConnectionStore.updateConnection(connectionId, response.body);

		ToastActionCreators.createToast({
			type: 'success',
			children: i18n._(msg`Connection verified`),
		});

		logger.debug(`Successfully verified connection: ${type}/${connectionId}`);
	} catch (error) {
		logger.error(`Failed to verify connection ${type}/${connectionId}:`, error);
		throw error;
	}
}

export async function reorderConnections(i18n: I18n, connectionIds: Array<string>): Promise<void> {
	try {
		const payload: ReorderConnectionsRequest = {
			connection_ids: connectionIds,
		};

		await http.patch(Endpoints.CONNECTIONS_REORDER, payload);
		await fetchConnections();

		ToastActionCreators.createToast({
			type: 'success',
			children: i18n._(msg`Connections reordered`),
		});

		logger.debug('Successfully reordered connections');
	} catch (error) {
		logger.error('Failed to reorder connections:', error);
		throw error;
	}
}
