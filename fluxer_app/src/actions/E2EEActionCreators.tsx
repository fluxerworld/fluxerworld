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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';

const logger = new Logger('E2EEActionCreators');

export interface E2EEDeviceResponse {
	user_id: string;
	device_id: string;
	device_name?: string | null;
	identity_key: string;
	registration_id: number;
	signed_prekey: {id: number; public_key: string; signature: string};
	created_at: string;
	last_seen_at: string;
	one_time_prekey_count: number;
}

export interface E2EEPrekeyBundleResponse {
	user_id: string;
	device_id: string;
	identity_key: string;
	registration_id: number;
	signed_prekey: {id: number; public_key: string; signature: string};
	one_time_prekey?: {id: number; public_key: string} | null;
}

export interface RegisterDevicePayload {
	device_id: string;
	device_name?: string | null;
	identity_key: string;
	registration_id: number;
	signed_prekey: {id: number; public_key: string; signature: string};
	one_time_prekeys: Array<{id: number; public_key: string}>;
}

export async function listOwnDevices(): Promise<Array<E2EEDeviceResponse>> {
	const resp = await http.get<Array<E2EEDeviceResponse>>({url: Endpoints.USER_E2EE_DEVICES});
	return resp.body;
}

export async function registerDevice(payload: RegisterDevicePayload): Promise<E2EEDeviceResponse> {
	logger.debug('Registering E2EE device', {deviceId: payload.device_id});
	const resp = await http.post<E2EEDeviceResponse>(Endpoints.USER_E2EE_DEVICES, payload);
	return resp.body;
}

export async function deleteDevice(deviceId: string): Promise<void> {
	await http.delete({url: Endpoints.USER_E2EE_DEVICE(deviceId)});
}

export async function rotateSignedPrekey(
	deviceId: string,
	signedPrekey: {id: number; public_key: string; signature: string},
): Promise<E2EEDeviceResponse> {
	const resp = await http.put<E2EEDeviceResponse>(Endpoints.USER_E2EE_DEVICE_SIGNED_PREKEY(deviceId), {
		signed_prekey: signedPrekey,
	});
	return resp.body;
}

export async function topUpOneTimePrekeys(
	deviceId: string,
	prekeys: Array<{id: number; public_key: string}>,
): Promise<{added: number; total_unclaimed: number}> {
	const resp = await http.post<{added: number; total_unclaimed: number}>(
		Endpoints.USER_E2EE_DEVICE_ONE_TIME_PREKEYS(deviceId),
		{one_time_prekeys: prekeys},
	);
	return resp.body;
}

export async function claimPrekeyBundles(targetUserId: string): Promise<Array<E2EEPrekeyBundleResponse>> {
	const resp = await http.post<Array<E2EEPrekeyBundleResponse>>(Endpoints.USER_E2EE_CLAIM_KEYS(targetUserId), {});
	return resp.body;
}

export interface E2EEPublicDeviceResponse {
	user_id: string;
	device_id: string;
	device_name?: string | null;
	identity_key: string;
	registration_id: number;
	signed_prekey: {id: number; public_key: string; signature: string};
	created_at: string;
}

export async function listPublicDevices(targetUserId: string): Promise<Array<E2EEPublicDeviceResponse>> {
	const resp = await http.get<Array<E2EEPublicDeviceResponse>>({url: Endpoints.USER_E2EE_USER_DEVICES(targetUserId)});
	return resp.body;
}

// ── Megolm group session distribution ──────────────────────────────────

export interface E2EEGroupSessionBlob {
	recipient_user_id: string;
	recipient_device_id: string;
	olm_message_type: 0 | 1;
	olm_ciphertext: string;
}

export interface E2EEGroupSessionDistributeRequest {
	session_id: string;
	sender_device_id: string;
	sender_identity_key: string;
	recipient_blobs: ReadonlyArray<E2EEGroupSessionBlob>;
}

export interface E2EEGroupSessionInboundBlob {
	session_id: string;
	sender_user_id: string;
	sender_device_id: string;
	sender_identity_key: string;
	recipient_device_id: string;
	olm_message_type: 0 | 1;
	olm_ciphertext: string;
	created_at: string;
}

export async function distributeGroupSession(
	channelId: string,
	request: E2EEGroupSessionDistributeRequest,
): Promise<{stored: number}> {
	const resp = await http.post<{stored: number}>(Endpoints.CHANNEL_E2EE_GROUP_SESSIONS(channelId), request);
	return resp.body;
}

export async function listInboundGroupSessions(channelId: string): Promise<Array<E2EEGroupSessionInboundBlob>> {
	const resp = await http.get<Array<E2EEGroupSessionInboundBlob>>({
		url: Endpoints.CHANNEL_E2EE_GROUP_SESSIONS(channelId),
	});
	return resp.body;
}

export async function ackGroupSessionBlob(
	channelId: string,
	sessionId: string,
	recipientDeviceId: string,
	senderDeviceId: string,
): Promise<void> {
	await http.delete(Endpoints.CHANNEL_E2EE_GROUP_SESSION_ACK(channelId, sessionId, recipientDeviceId, senderDeviceId));
}
