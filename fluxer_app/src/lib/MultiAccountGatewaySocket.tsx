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

import type {GatewayCustomStatusPayload} from '@app/lib/CustomStatus';
import {
	decryptToString,
	deriveSharedSecret,
	encrypt,
	generateKeyPair,
	importPublicKey,
	type X25519KeyPair,
} from '@app/lib/E2EEncryption';
import {ExponentialBackoff} from '@app/lib/ExponentialBackoff';
import type {CompressionType} from '@app/lib/GatewayCompression';
import {GatewayCompression} from '@app/lib/GatewayCompression';
import type {GatewayPayload, GatewayPresence, GatewaySocketProperties} from '@app/lib/GatewaySocket';
import {Logger} from '@app/lib/Logger';
import relayClient from '@app/lib/RelayClient';
import GeoIPStore from '@app/stores/GeoIPStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {GatewayErrorCode} from '@fluxer/constants/src/GatewayConstants';
import {GatewayCloseCodes, GatewayOpcodes} from '@fluxer/constants/src/GatewayConstants';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import EventEmitter from 'eventemitter3';

const logger = new Logger('MultiAccountGateway');

const GATEWAY_TIMEOUTS = {
	HeartbeatAck: 15000,
	ResumeWindow: 180000,
	MinReconnect: 1000,
	MaxReconnect: 10000,
	Hello: 20000,
	ConnectionTimeout: 30000,
} as const;

const MAX_ACCOUNTS = 10;
const MULTIPLEXED_FRAME_PREFIX = 0xfd;

export const RelayConnectionState = {
	Disconnected: 'DISCONNECTED',
	Connecting: 'CONNECTING',
	Connected: 'CONNECTED',
	Reconnecting: 'RECONNECTING',
} as const;
export type RelayConnectionState = ValueOf<typeof RelayConnectionState>;

export const AccountConnectionState = {
	Pending: 'PENDING',
	Identifying: 'IDENTIFYING',
	Connected: 'CONNECTED',
	Resuming: 'RESUMING',
	Disconnected: 'DISCONNECTED',
} as const;
export type AccountConnectionState = ValueOf<typeof AccountConnectionState>;

export interface AccountConnection {
	accountId: string;
	instanceDomain: string;
	token: string;
	sessionId: string | null;
	sequenceNumber: number;
	connectionState: AccountConnectionState;
	heartbeatIntervalMs: number | null;
	heartbeatAckPending: boolean;
	lastHeartbeatTime: number;
	lastHeartbeatAckAt: number | null;
	sharedSecret: CryptoKey | null;
	instancePublicKeyBase64: string | null;
	presence: GatewayPresence;
	compression: CompressionType;
	decompressor: GatewayCompression | null;
	properties: GatewaySocketProperties;
	identifyFlags: number;
}

export interface GatewayErrorData {
	code: GatewayErrorCode;
	message: string;
}

export interface MultiplexedFrame {
	accountId: string;
	sequence: number;
	encryptedPayload: Uint8Array;
}

export interface MultiAccountGatewaySocketEvents {
	relayConnecting: () => void;
	relayConnected: () => void;
	relayDisconnected: (event: {code: number; reason: string}) => void;
	relayError: (error: Error | Event) => void;
	relayStateChange: (newState: RelayConnectionState, oldState: RelayConnectionState) => void;
	accountConnecting: (accountId: string) => void;
	accountConnected: (accountId: string) => void;
	accountReady: (accountId: string, data: unknown) => void;
	accountResumed: (accountId: string) => void;
	accountDisconnected: (accountId: string, event: {code: number; reason: string}) => void;
	accountError: (accountId: string, error: Error) => void;
	accountGatewayError: (accountId: string, error: GatewayErrorData) => void;
	accountAuthFailure: (accountId: string) => void;
	accountStateChange: (accountId: string, newState: AccountConnectionState, oldState: AccountConnectionState) => void;
	accountHeartbeat: (accountId: string, sequence: number) => void;
	accountHeartbeatAck: (accountId: string) => void;
	accountTimeout: (accountId: string) => void;
	accountMessage: (accountId: string, payload: GatewayPayload) => void;
	accountDispatch: (accountId: string, type: string, data: unknown) => void;
	networkStatusChange: (online: boolean) => void;
}

export interface MultiAccountGatewaySocketOptions {
	apiVersion: number;
	defaultCompression?: CompressionType;
}

export class MultiAccountGatewaySocket extends EventEmitter<MultiAccountGatewaySocketEvents> {
	private relaySocket: WebSocket | null = null;
	private relayConnectionState: RelayConnectionState = RelayConnectionState.Disconnected;
	private relayUrl: string | null = null;

	private accounts: Map<string, AccountConnection> = new Map();
	private heartbeatIntervals: Map<string, number> = new Map();
	private heartbeatAckTimeouts: Map<string, number> = new Map();
	private helloTimeouts: Map<string, number> = new Map();

	private ephemeralKeyPair: X25519KeyPair | null = null;
	private reconnectBackoff: ExponentialBackoff;
	private reconnectTimeoutId: number | null = null;
	private isUserInitiatedDisconnect = false;
	private shouldReconnectImmediately = false;

	private deferredEmitQueue: Array<() => void> = [];
	private deferredEmitTimeoutId: number | null = null;

	private readonly options: MultiAccountGatewaySocketOptions;

	constructor(options: MultiAccountGatewaySocketOptions) {
		super();
		this.options = options;
		this.reconnectBackoff = new ExponentialBackoff({
			minDelay: GATEWAY_TIMEOUTS.MinReconnect,
			maxDelay: GATEWAY_TIMEOUTS.MaxReconnect,
		});
	}

	private emitDeferred<K extends keyof MultiAccountGatewaySocketEvents>(
		event: K,
		...args: Parameters<MultiAccountGatewaySocketEvents[K]>
	): void {
		this.deferredEmitQueue.push(() => {
			(this.emit as (event: K, ...args: Parameters<MultiAccountGatewaySocketEvents[K]>) => boolean)(event, ...args);
		});

		if (this.deferredEmitTimeoutId != null) return;

		this.deferredEmitTimeoutId = window.setTimeout(() => {
			this.deferredEmitTimeoutId = null;
			const queue = this.deferredEmitQueue;
			this.deferredEmitQueue = [];
			for (const emitFn of queue) {
				emitFn();
			}
		}, 0);
	}

	async connectToRelay(relayUrl: string): Promise<void> {
		if (
			this.relayConnectionState === RelayConnectionState.Connecting ||
			this.relayConnectionState === RelayConnectionState.Connected
		) {
			logger.debug('Ignoring connectToRelay: already connecting or connected');
			return;
		}

		this.isUserInitiatedDisconnect = false;
		this.relayUrl = relayUrl;
		this.updateRelayState(RelayConnectionState.Connecting);

		await this.openRelaySocket(relayUrl);
	}

	private async openRelaySocket(relayUrl: string): Promise<void> {
		this.teardownRelaySocket();

		try {
			this.ephemeralKeyPair = await generateKeyPair();
			logger.debug('Generated ephemeral key pair for relay multiplexing');

			const wsUrl = new URL(relayUrl);
			wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
			wsUrl.pathname = '/gateway/multiplex';
			wsUrl.searchParams.set('v', this.options.apiVersion.toString());
			wsUrl.searchParams.set('ephemeral_public_key', this.ephemeralKeyPair.publicKeyBase64);

			logger.debug('Opening multiplexed relay WebSocket:', wsUrl.toString());

			this.relaySocket = new WebSocket(wsUrl.toString());
			this.relaySocket.binaryType = 'arraybuffer';

			this.relaySocket.addEventListener('open', this.handleRelayOpen);
			this.relaySocket.addEventListener('message', this.handleRelayMessage);
			this.relaySocket.addEventListener('close', this.handleRelayClose);
			this.relaySocket.addEventListener('error', this.handleRelayError);

			this.emitDeferred('relayConnecting');
		} catch (error) {
			logger.error('Failed to open relay socket', error);
			this.handleRelayConnectionFailure();
		}
	}

	private teardownRelaySocket(): void {
		if (!this.relaySocket) return;

		try {
			this.relaySocket.removeEventListener('open', this.handleRelayOpen);
			this.relaySocket.removeEventListener('message', this.handleRelayMessage);
			this.relaySocket.removeEventListener('close', this.handleRelayClose);
			this.relaySocket.removeEventListener('error', this.handleRelayError);

			if (this.relaySocket.readyState === WebSocket.OPEN) {
				this.relaySocket.close(1000, 'Disposing relay socket');
			}
		} catch (error) {
			logger.error('Error while disposing relay socket', error);
		} finally {
			this.relaySocket = null;
		}
	}

	private handleRelayOpen = (): void => {
		logger.info('Relay WebSocket connection established');
		this.updateRelayState(RelayConnectionState.Connected);
		this.reconnectBackoff.reset();
		this.emitDeferred('relayConnected');

		for (const [accountId, account] of this.accounts) {
			if (account.connectionState === AccountConnectionState.Disconnected) {
				this.initiateAccountConnection(accountId);
			}
		}
	};

	private handleRelayMessage = async (event: MessageEvent): Promise<void> => {
		try {
			if (!(event.data instanceof ArrayBuffer)) {
				logger.warn('Received non-binary message from relay');
				return;
			}

			const frame = await this.decodeFrame(event.data);
			await this.routeFrameToAccount(frame);
		} catch (error) {
			logger.error('Error handling relay message', error);
		}
	};

	private handleRelayClose = (event: CloseEvent): void => {
		logger.warn(`Relay WebSocket closed [${event.code}] ${event.reason || ''}`);

		for (const accountId of this.accounts.keys()) {
			this.stopHeartbeat(accountId);
			this.clearHelloTimeout(accountId);
		}

		this.emitDeferred('relayDisconnected', {code: event.code, reason: event.reason});

		if (!this.isUserInitiatedDisconnect) {
			this.handleRelayConnectionFailure();
		} else {
			this.updateRelayState(RelayConnectionState.Disconnected);
		}
	};

	private handleRelayError = (event: Event): void => {
		logger.error('Relay WebSocket error', event);
		this.emitDeferred('relayError', event);
	};

	private handleRelayConnectionFailure(): void {
		if (this.isUserInitiatedDisconnect) {
			this.updateRelayState(RelayConnectionState.Disconnected);
			return;
		}

		this.updateRelayState(RelayConnectionState.Reconnecting);
		this.scheduleRelayReconnect();
	}

	private scheduleRelayReconnect(): void {
		if (this.reconnectTimeoutId != null) {
			logger.debug('Relay reconnect already scheduled');
			return;
		}

		const delay = this.shouldReconnectImmediately ? 0 : this.reconnectBackoff.next();
		this.shouldReconnectImmediately = false;

		logger.info(`Scheduling relay reconnect in ${delay}ms`);

		this.reconnectTimeoutId = window.setTimeout(() => {
			this.reconnectTimeoutId = null;
			if (this.relayUrl) {
				this.openRelaySocket(this.relayUrl);
			}
		}, delay);
	}

	disconnectRelay(code = 1000, reason = 'Client disconnecting'): void {
		logger.info(`Relay disconnect requested: [${code}] ${reason}`);
		this.isUserInitiatedDisconnect = true;

		if (this.reconnectTimeoutId != null) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		for (const accountId of this.accounts.keys()) {
			this.stopHeartbeat(accountId);
			this.clearHelloTimeout(accountId);
		}

		this.teardownRelaySocket();
		this.updateRelayState(RelayConnectionState.Disconnected);
	}

	async addAccount(
		accountId: string,
		instanceDomain: string,
		token: string,
		properties: GatewaySocketProperties,
		presence?: GatewayPresence,
		identifyFlags?: number,
	): Promise<void> {
		if (this.accounts.has(accountId)) {
			logger.debug('Account already registered:', accountId);
			return;
		}

		if (this.accounts.size >= MAX_ACCOUNTS) {
			throw new Error(`Maximum number of accounts (${MAX_ACCOUNTS}) reached`);
		}

		const account: AccountConnection = {
			accountId,
			instanceDomain,
			token,
			sessionId: null,
			sequenceNumber: 0,
			connectionState: AccountConnectionState.Pending,
			heartbeatIntervalMs: null,
			heartbeatAckPending: false,
			lastHeartbeatTime: 0,
			lastHeartbeatAckAt: null,
			sharedSecret: null,
			instancePublicKeyBase64: null,
			presence: presence ?? {status: 'online', afk: false, mobile: false},
			compression: this.options.defaultCompression ?? 'zstd-stream',
			decompressor: null,
			properties,
			identifyFlags: identifyFlags ?? 0,
		};

		this.accounts.set(accountId, account);
		logger.info('Added account:', accountId, 'for instance:', instanceDomain);

		if (this.relayConnectionState === RelayConnectionState.Connected) {
			await this.initiateAccountConnection(accountId);
		}
	}

	removeAccount(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account) {
			logger.debug('Account not found for removal:', accountId);
			return;
		}

		this.stopHeartbeat(accountId);
		this.clearHelloTimeout(accountId);

		if (account.decompressor) {
			account.decompressor.destroy();
		}

		this.accounts.delete(accountId);

		logger.info('Removed account:', accountId);
		this.emitDeferred('accountDisconnected', accountId, {code: 1000, reason: 'Account removed'});
	}

	getAccount(accountId: string): AccountConnection | null {
		return this.accounts.get(accountId) ?? null;
	}

	getAccountsForInstance(instanceDomain: string): Array<AccountConnection> {
		const result: Array<AccountConnection> = [];
		for (const account of this.accounts.values()) {
			if (account.instanceDomain.toLowerCase() === instanceDomain.toLowerCase()) {
				result.push(account);
			}
		}
		return result;
	}

	private async initiateAccountConnection(accountId: string): Promise<void> {
		const account = this.accounts.get(accountId);
		if (!account) return;

		try {
			this.updateAccountState(accountId, AccountConnectionState.Identifying);
			this.emitDeferred('accountConnecting', accountId);

			const instanceKey = await relayClient.getInstancePublicKey(account.instanceDomain);
			account.instancePublicKeyBase64 = instanceKey.publicKeyBase64;

			if (!this.ephemeralKeyPair) {
				throw new Error('Ephemeral key pair not initialised');
			}

			const recipientPublicKey = await importPublicKey(instanceKey.publicKeyBase64);
			account.sharedSecret = await deriveSharedSecret(this.ephemeralKeyPair.privateKey, recipientPublicKey);

			logger.debug('Derived shared secret for account:', accountId);

			if (account.compression !== 'none') {
				account.decompressor = new GatewayCompression(account.compression);
			}

			this.startHelloTimeout(accountId);
		} catch (error) {
			logger.error('Failed to initiate account connection:', accountId, error);
			this.updateAccountState(accountId, AccountConnectionState.Disconnected);
			this.emitDeferred('accountError', accountId, error instanceof Error ? error : new Error(String(error)));
		}
	}

	async send(accountId: string, payload: GatewayPayload): Promise<boolean> {
		if (!this.relaySocket || this.relaySocket.readyState !== WebSocket.OPEN) {
			logger.warn('Cannot send: relay socket not open');
			return false;
		}

		const account = this.accounts.get(accountId);
		if (!account) {
			logger.warn('Cannot send: account not found:', accountId);
			return false;
		}

		try {
			const frame = await this.encodeFrame(accountId, payload);
			this.relaySocket.send(frame);
			logger.debug('Sent frame to account:', accountId, 'op:', payload.op);
			return true;
		} catch (error) {
			logger.error('Error sending frame to account:', accountId, error);
			return false;
		}
	}

	updatePresence(
		accountId: string,
		status: string,
		afk?: boolean,
		mobile?: boolean,
		customStatus?: GatewayCustomStatusPayload | null,
	): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState !== AccountConnectionState.Connected) {
			return;
		}

		account.presence = {
			status,
			afk: afk ?? account.presence.afk,
			mobile: mobile ?? account.presence.mobile,
			custom_status: customStatus,
		};

		this.send(accountId, {
			op: GatewayOpcodes.PRESENCE_UPDATE,
			d: {
				status,
				...(afk !== undefined && {afk}),
				...(mobile !== undefined && {mobile}),
				...(customStatus !== undefined && {custom_status: customStatus}),
			},
		});
	}

	updateVoiceState(
		accountId: string,
		params: {
			guild_id: string | null;
			channel_id: string | null;
			self_mute: boolean;
			self_deaf: boolean;
			self_video: boolean;
			self_stream: boolean;
			viewer_stream_keys?: Array<string>;
			connection_id: string | null;
		},
	): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState !== AccountConnectionState.Connected) {
			return;
		}

		const isMobileLayout = MobileLayoutStore.isMobileLayout();
		const {latitude, longitude} = GeoIPStore;

		this.send(accountId, {
			op: GatewayOpcodes.VOICE_STATE_UPDATE,
			d: {
				...params,
				connection_id: params['connection_id'] || MediaEngineStore.connectionId,
				is_mobile: isMobileLayout,
				latitude: latitude ?? undefined,
				longitude: longitude ?? undefined,
			},
		});
	}

	requestGuildMembers(
		accountId: string,
		params: {
			guildId: string;
			query?: string;
			limit?: number;
			userIds?: Array<string>;
			presences?: boolean;
			nonce?: string;
		},
	): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState !== AccountConnectionState.Connected) {
			return;
		}

		this.send(accountId, {
			op: GatewayOpcodes.REQUEST_GUILD_MEMBERS,
			d: {
				guild_id: params['guildId'],
				...(params['query'] !== undefined && {query: params['query']}),
				...(params['limit'] !== undefined && {limit: params['limit']}),
				...(params['userIds'] !== undefined && {user_ids: [...new Set(params['userIds'])]}),
				...(params['presences'] !== undefined && {presences: params['presences']}),
				...(params['nonce'] !== undefined && {nonce: params['nonce']}),
			},
		});
	}

	updateGuildSubscriptions(
		accountId: string,
		params: {
			subscriptions: Record<
				string,
				{
					active?: boolean;
					member_list_channels?: Record<string, Array<[number, number]>>;
					typing?: boolean;
					members?: Array<string>;
					sync?: boolean;
				}
			>;
		},
	): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState !== AccountConnectionState.Connected) {
			return;
		}

		this.send(accountId, {
			op: GatewayOpcodes.LAZY_REQUEST,
			d: params,
		});
	}

	handleNetworkStatusChange(online: boolean): void {
		logger.info(`Network status: ${online ? 'online' : 'offline'}`);
		this.emitDeferred('networkStatusChange', online);

		if (online) {
			if (
				this.relayConnectionState === RelayConnectionState.Disconnected ||
				this.relayConnectionState === RelayConnectionState.Reconnecting
			) {
				this.shouldReconnectImmediately = true;
				if (this.relayUrl) {
					this.connectToRelay(this.relayUrl);
				}
			}
		} else if (this.relayConnectionState === RelayConnectionState.Connected) {
			this.disconnectRelay(1000, 'Network offline');
		}
	}

	resetAccount(accountId: string, shouldReconnect = true): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		logger.info(`Resetting account: ${accountId} (reconnect=${shouldReconnect})`);

		this.stopHeartbeat(accountId);
		this.clearHelloTimeout(accountId);

		account.sessionId = null;
		account.sequenceNumber = 0;

		if (account.decompressor) {
			account.decompressor.destroy();
			account.decompressor = null;
		}

		this.updateAccountState(accountId, AccountConnectionState.Disconnected);

		if (shouldReconnect && this.relayConnectionState === RelayConnectionState.Connected) {
			this.initiateAccountConnection(accountId);
		}
	}

	simulateNetworkDisconnect(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState !== AccountConnectionState.Connected) {
			logger.warn('Cannot simulate disconnect: account not connected');
			return;
		}

		logger.info('Simulating network disconnect for account:', accountId);
		this.resetAccount(accountId, true);
	}

	private async encodeFrame(accountId: string, payload: GatewayPayload): Promise<ArrayBuffer> {
		const account = this.accounts.get(accountId);
		if (!account || !account.sharedSecret) {
			throw new Error(`No shared secret for account: ${accountId}`);
		}

		const payloadJson = JSON.stringify(payload);
		const {ciphertext, iv} = await encrypt(payloadJson, account.sharedSecret);

		const encryptedPayloadBytes = this.base64ToUint8Array(ciphertext);
		const ivBytes = this.base64ToUint8Array(iv);

		const accountIdBytes = new TextEncoder().encode(accountId);
		const sequence = account.sequenceNumber;

		const headerSize = 1 + 2 + accountIdBytes.length + 4 + 4;
		const totalSize = headerSize + ivBytes.length + encryptedPayloadBytes.length;
		const buffer = new ArrayBuffer(totalSize);
		const view = new DataView(buffer);
		const bytes = new Uint8Array(buffer);

		let offset = 0;

		view.setUint8(offset, MULTIPLEXED_FRAME_PREFIX);
		offset += 1;

		view.setUint16(offset, accountIdBytes.length, false);
		offset += 2;

		bytes.set(accountIdBytes, offset);
		offset += accountIdBytes.length;

		view.setUint32(offset, sequence, false);
		offset += 4;

		view.setUint32(offset, ivBytes.length + encryptedPayloadBytes.length, false);
		offset += 4;

		bytes.set(ivBytes, offset);
		offset += ivBytes.length;

		bytes.set(encryptedPayloadBytes, offset);

		return buffer;
	}

	private async decodeFrame(data: ArrayBuffer): Promise<MultiplexedFrame> {
		const view = new DataView(data);
		const bytes = new Uint8Array(data);

		let offset = 0;

		const prefix = view.getUint8(offset);
		offset += 1;

		if (prefix !== MULTIPLEXED_FRAME_PREFIX) {
			throw new Error(`Invalid frame prefix: ${prefix}`);
		}

		const accountIdLength = view.getUint16(offset, false);
		offset += 2;

		const accountIdBytes = bytes.slice(offset, offset + accountIdLength);
		const accountId = new TextDecoder().decode(accountIdBytes);
		offset += accountIdLength;

		const sequence = view.getUint32(offset, false);
		offset += 4;

		const payloadLength = view.getUint32(offset, false);
		offset += 4;

		const encryptedPayload = bytes.slice(offset, offset + payloadLength);

		return {
			accountId,
			sequence,
			encryptedPayload,
		};
	}

	private async routeFrameToAccount(frame: MultiplexedFrame): Promise<void> {
		const account = this.accounts.get(frame.accountId);
		if (!account) {
			logger.warn('Received frame for unknown account:', frame.accountId);
			return;
		}

		if (!account.sharedSecret) {
			logger.warn('No shared secret for account:', frame.accountId);
			return;
		}

		try {
			const ivBytes = frame.encryptedPayload.slice(0, 12);
			const ciphertextBytes = frame.encryptedPayload.slice(12);

			const iv = this.uint8ArrayToBase64(ivBytes);
			const ciphertext = this.uint8ArrayToBase64(ciphertextBytes);

			const decryptedJson = await decryptToString(ciphertext, account.sharedSecret, iv);

			const payload = JSON.parse(decryptedJson) as GatewayPayload;

			if (payload.op === GatewayOpcodes.DISPATCH && typeof payload.s === 'number') {
				account.sequenceNumber = payload.s;
			}

			this.handleAccountPayload(frame.accountId, payload);
			this.emitDeferred('accountMessage', frame.accountId, payload);
		} catch (error) {
			logger.error('Failed to decrypt/parse frame for account:', frame.accountId, error);

			if (account.compression !== 'none') {
				logger.warn('Decompression may have failed, disabling compression for account:', frame.accountId);
				account.compression = 'none';
				if (account.decompressor) {
					account.decompressor.destroy();
					account.decompressor = null;
				}
				this.resetAccount(frame.accountId, true);
				return;
			}

			this.emitDeferred('accountError', frame.accountId, error instanceof Error ? error : new Error(String(error)));
		}
	}

	private handleAccountPayload(accountId: string, payload: GatewayPayload): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		switch (payload.op) {
			case GatewayOpcodes.DISPATCH:
				this.handleAccountDispatch(accountId, payload);
				break;

			case GatewayOpcodes.HEARTBEAT:
				logger.debug('Heartbeat requested by server for account:', accountId);
				this.sendAccountHeartbeat(accountId, true);
				break;

			case GatewayOpcodes.HEARTBEAT_ACK:
				this.handleHeartbeatAck(accountId);
				break;

			case GatewayOpcodes.HELLO:
				this.handleAccountHello(accountId, payload);
				break;

			case GatewayOpcodes.INVALID_SESSION:
				this.handleAccountInvalidSession(accountId, payload);
				break;

			case GatewayOpcodes.RECONNECT:
				logger.info('Server requested reconnect for account:', accountId);
				this.reconnectAccount(accountId);
				break;

			case GatewayOpcodes.GATEWAY_ERROR: {
				const errorData = payload.d as GatewayErrorData;
				logger.warn(`Gateway error for account ${accountId} [${errorData.code}] ${errorData.message}`);
				this.emitDeferred('accountGatewayError', accountId, errorData);
				break;
			}
		}
	}

	private handleAccountDispatch(accountId: string, payload: GatewayPayload): void {
		const account = this.accounts.get(accountId);
		if (!account || !payload.t) return;

		switch (payload.t) {
			case 'READY': {
				const data = payload.d as {session_id: string; resume_gateway_url?: string};
				account.sessionId = data.session_id;
				this.clearHelloTimeout(accountId);
				this.updateAccountState(accountId, AccountConnectionState.Connected);
				logger.info(`Account READY: ${accountId}, session=${account.sessionId}`);
				this.emitDeferred('accountReady', accountId, payload.d);
				break;
			}

			case 'RESUMED':
				this.clearHelloTimeout(accountId);
				this.updateAccountState(accountId, AccountConnectionState.Connected);
				logger.info('Account session resumed:', accountId);
				this.emitDeferred('accountResumed', accountId);
				break;
		}

		this.emitDeferred('accountDispatch', accountId, payload.t, payload.d);
	}

	private handleAccountHello(accountId: string, payload: GatewayPayload): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		this.clearHelloTimeout(accountId);

		const helloData = payload.d as {heartbeat_interval: number};
		account.heartbeatIntervalMs = helloData.heartbeat_interval;

		this.startHeartbeat(accountId, helloData.heartbeat_interval);

		if (this.canResumeAccountSession(accountId)) {
			this.sendAccountResume(accountId);
		} else {
			this.sendAccountIdentify(accountId);
		}
	}

	private handleAccountInvalidSession(accountId: string, payload: GatewayPayload): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		const isResumable = payload.d as boolean;
		logger.info(`Account session invalidated: ${accountId} (resumable=${isResumable})`);

		const delay = 2500 + Math.random() * 1000;

		if (isResumable) {
			window.setTimeout(() => {
				this.sendAccountResume(accountId);
			}, delay);
		} else {
			account.sessionId = null;
			account.sequenceNumber = 0;
			window.setTimeout(() => {
				this.sendAccountIdentify(accountId);
			}, delay);
		}
	}

	private sendAccountIdentify(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		logger.info('Sending IDENTIFY for account:', accountId);

		this.send(accountId, {
			op: GatewayOpcodes.IDENTIFY,
			d: {
				token: account.token,
				properties: account.properties,
				presence: account.presence,
				flags: account.identifyFlags,
				compress: account.compression !== 'none' ? account.compression : undefined,
			},
		});
	}

	private sendAccountResume(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account || !account.sessionId) {
			logger.warn('Cannot resume without session, falling back to identify:', accountId);
			this.sendAccountIdentify(accountId);
			return;
		}

		logger.info(`Sending RESUME for account: ${accountId}, session=${account.sessionId}`);
		this.updateAccountState(accountId, AccountConnectionState.Resuming);

		this.send(accountId, {
			op: GatewayOpcodes.RESUME,
			d: {
				token: account.token,
				session_id: account.sessionId,
				seq: account.sequenceNumber,
			},
		});
	}

	private reconnectAccount(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		this.stopHeartbeat(accountId);
		this.updateAccountState(accountId, AccountConnectionState.Pending);

		this.initiateAccountConnection(accountId);
	}

	private canResumeAccountSession(accountId: string): boolean {
		const account = this.accounts.get(accountId);
		if (!account || !account.sessionId) return false;

		const now = Date.now();
		if (account.lastHeartbeatAckAt != null) {
			return now - account.lastHeartbeatAckAt <= GATEWAY_TIMEOUTS.ResumeWindow;
		}

		return true;
	}

	private startHeartbeat(accountId: string, intervalMs: number): void {
		this.stopHeartbeat(accountId);

		const account = this.accounts.get(accountId);
		if (!account) return;

		account.heartbeatIntervalMs = intervalMs;

		const jitteredInterval = Math.floor(intervalMs * (0.8 + Math.random() * 0.1));

		logger.debug(
			`Starting heartbeat for account: ${accountId}, interval=${intervalMs}ms, jittered=${jitteredInterval}ms`,
		);

		this.heartbeatIntervals.set(
			accountId,
			window.setInterval(() => {
				this.sendAccountHeartbeat(accountId, false);
			}, jitteredInterval),
		);

		window.setTimeout(
			() => {
				this.sendAccountHeartbeat(accountId, false);
			},
			Math.floor(jitteredInterval * Math.random()),
		);
	}

	private stopHeartbeat(accountId: string): void {
		const intervalId = this.heartbeatIntervals.get(accountId);
		if (intervalId != null) {
			clearInterval(intervalId);
			this.heartbeatIntervals.delete(accountId);
		}

		const ackTimeoutId = this.heartbeatAckTimeouts.get(accountId);
		if (ackTimeoutId != null) {
			clearTimeout(ackTimeoutId);
			this.heartbeatAckTimeouts.delete(accountId);
		}

		const account = this.accounts.get(accountId);
		if (account) {
			account.heartbeatAckPending = false;
		}

		logger.debug('Stopped heartbeat for account:', accountId);
	}

	private sendAccountHeartbeat(accountId: string, serverRequested: boolean): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		if (account.heartbeatAckPending && !serverRequested) {
			logger.warn('Heartbeat ACK still pending for account:', accountId);
			this.handleAccountTimeout(accountId);
			return;
		}

		account.heartbeatAckPending = true;
		account.lastHeartbeatTime = Date.now();

		const didSend = this.send(accountId, {
			op: GatewayOpcodes.HEARTBEAT,
			d: account.sequenceNumber,
		});

		if (!didSend) {
			logger.error('Failed to send heartbeat for account:', accountId);
			this.handleAccountTimeout(accountId);
			return;
		}

		this.emitDeferred('accountHeartbeat', accountId, account.sequenceNumber);
		logger.debug(`Heartbeat sent for account: ${accountId}, seq=${account.sequenceNumber}`);

		this.heartbeatAckTimeouts.set(
			accountId,
			window.setTimeout(() => {
				if (account.heartbeatAckPending) {
					logger.warn('Heartbeat ACK timeout for account:', accountId);
					this.handleAccountTimeout(accountId);
				}
			}, GATEWAY_TIMEOUTS.HeartbeatAck),
		);
	}

	private handleHeartbeatAck(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		account.heartbeatAckPending = false;
		account.lastHeartbeatAckAt = Date.now();

		const ackTimeoutId = this.heartbeatAckTimeouts.get(accountId);
		if (ackTimeoutId != null) {
			clearTimeout(ackTimeoutId);
			this.heartbeatAckTimeouts.delete(accountId);
		}

		logger.debug('Heartbeat ACK received for account:', accountId);
		this.emitDeferred('accountHeartbeatAck', accountId);
	}

	private handleAccountTimeout(accountId: string): void {
		const account = this.accounts.get(accountId);
		if (!account) return;

		logger.warn('Account timeout:', accountId);
		this.stopHeartbeat(accountId);

		this.emitDeferred('accountTimeout', accountId);

		if (this.canResumeAccountSession(accountId)) {
			this.reconnectAccount(accountId);
		} else {
			account.sessionId = null;
			account.sequenceNumber = 0;
			this.updateAccountState(accountId, AccountConnectionState.Disconnected);
			this.emitDeferred('accountDisconnected', accountId, {
				code: GatewayCloseCodes.UNKNOWN_ERROR,
				reason: 'Heartbeat timeout',
			});
		}
	}

	private startHelloTimeout(accountId: string): void {
		this.clearHelloTimeout(accountId);

		this.helloTimeouts.set(
			accountId,
			window.setTimeout(() => {
				logger.warn('HELLO timeout for account:', accountId);
				this.handleAccountTimeout(accountId);
			}, GATEWAY_TIMEOUTS.Hello),
		);
	}

	private clearHelloTimeout(accountId: string): void {
		const timeoutId = this.helloTimeouts.get(accountId);
		if (timeoutId != null) {
			clearTimeout(timeoutId);
			this.helloTimeouts.delete(accountId);
		}
	}

	private updateRelayState(nextState: RelayConnectionState): void {
		if (this.relayConnectionState === nextState) return;

		const previous = this.relayConnectionState;
		this.relayConnectionState = nextState;

		logger.info(`Relay state: ${previous} -> ${nextState}`);
		this.emitDeferred('relayStateChange', nextState, previous);
	}

	private updateAccountState(accountId: string, nextState: AccountConnectionState): void {
		const account = this.accounts.get(accountId);
		if (!account || account.connectionState === nextState) return;

		const previous = account.connectionState;
		account.connectionState = nextState;

		logger.info(`Account ${accountId} state: ${previous} -> ${nextState}`);
		this.emitDeferred('accountStateChange', accountId, nextState, previous);

		if (nextState === AccountConnectionState.Connected) {
			this.emitDeferred('accountConnected', accountId);
		}
	}

	getRelayState(): RelayConnectionState {
		return this.relayConnectionState;
	}

	getAccountState(accountId: string): AccountConnectionState | null {
		return this.accounts.get(accountId)?.connectionState ?? null;
	}

	getAccountSessionId(accountId: string): string | null {
		return this.accounts.get(accountId)?.sessionId ?? null;
	}

	getAccountSequence(accountId: string): number {
		return this.accounts.get(accountId)?.sequenceNumber ?? 0;
	}

	getConnectedAccounts(): Array<string> {
		return Array.from(this.accounts.entries())
			.filter(([_, account]) => account.connectionState === AccountConnectionState.Connected)
			.map(([id]) => id);
	}

	getAllAccounts(): Array<string> {
		return Array.from(this.accounts.keys());
	}

	isRelayConnected(): boolean {
		return (
			this.relayConnectionState === RelayConnectionState.Connected && this.relaySocket?.readyState === WebSocket.OPEN
		);
	}

	isAccountConnected(accountId: string): boolean {
		const account = this.accounts.get(accountId);
		return account?.connectionState === AccountConnectionState.Connected && this.isRelayConnected();
	}

	private base64ToUint8Array(base64: string): Uint8Array {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes;
	}

	private uint8ArrayToBase64(bytes: Uint8Array): string {
		let binaryString = '';
		for (let i = 0; i < bytes.length; i++) {
			binaryString += String.fromCharCode(bytes[i]);
		}
		return btoa(binaryString);
	}

	destroy(): void {
		this.isUserInitiatedDisconnect = true;

		if (this.reconnectTimeoutId != null) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}

		if (this.deferredEmitTimeoutId != null) {
			clearTimeout(this.deferredEmitTimeoutId);
			this.deferredEmitTimeoutId = null;
		}

		for (const accountId of this.accounts.keys()) {
			this.stopHeartbeat(accountId);
			this.clearHelloTimeout(accountId);

			const account = this.accounts.get(accountId);
			if (account?.decompressor) {
				account.decompressor.destroy();
			}
		}

		this.accounts.clear();
		this.teardownRelaySocket();
		this.ephemeralKeyPair = null;

		this.removeAllListeners();
		logger.info('MultiAccountGatewaySocket destroyed');
	}
}
