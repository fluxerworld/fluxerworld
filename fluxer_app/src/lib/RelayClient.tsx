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

import {
	decryptToString,
	deriveSharedSecret,
	encrypt,
	generateKeyPair,
	importPublicKey,
	type X25519KeyPair,
} from '@app/lib/E2EEncryption';
import {Logger} from '@app/lib/Logger';
import {MS_PER_HOUR, MS_PER_MINUTE} from '@fluxer/date_utils/src/DateConstants';

const logger = new Logger('RelayClient');

const RELAY_CACHE_TTL_MS = 5 * MS_PER_MINUTE;
const INSTANCE_KEY_CACHE_TTL_MS = MS_PER_HOUR;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export interface RelayInfo {
	url: string;
	region: string;
	latency?: number;
}

export interface InstancePublicKey {
	id: string;
	algorithm: string;
	publicKeyBase64: string;
}

export interface InstanceEndpoints {
	gateway: string;
	api: string;
	media: string;
}

export interface RelayRequestOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	headers?: Record<string, string>;
	body?: unknown;
	timeout?: number;
	signal?: AbortSignal;
}

export interface RelayResponse<T = unknown> {
	ok: boolean;
	status: number;
	headers: Record<string, string>;
	body: T;
}

interface CachedRelay {
	relay: RelayInfo;
	expiresAt: number;
}

interface CachedInstanceInfo {
	key: InstancePublicKey;
	endpoints: InstanceEndpoints;
	expiresAt: number;
}

interface EncryptedRelayRequest {
	encrypted_request: string;
	iv: string;
	ephemeral_public_key: string;
}

interface EncryptedRelayResponse {
	encrypted_response: string;
	iv: string;
}

class RelayClient {
	private relayDirectoryUrl: string | null = null;
	private cachedRelay: CachedRelay | null = null;
	private instanceInfoCache = new Map<string, CachedInstanceInfo>();
	private ephemeralKeyPair: X25519KeyPair | null = null;

	setRelayDirectoryUrl(url: string): void {
		this.relayDirectoryUrl = url;
		this.cachedRelay = null;
		logger.debug('Set relay directory URL:', url);
	}

	async selectRelay(forceRefresh = false): Promise<RelayInfo> {
		if (!forceRefresh && this.cachedRelay && this.cachedRelay.expiresAt > Date.now()) {
			logger.debug('Using cached relay:', this.cachedRelay.relay.url);
			return this.cachedRelay.relay;
		}

		if (!this.relayDirectoryUrl) {
			throw new Error('Relay directory URL not configured');
		}

		logger.debug('Fetching relay from directory:', this.relayDirectoryUrl);

		const response = await fetch(`${this.relayDirectoryUrl}/api/relay/select`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to select relay: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as {relay: RelayInfo};
		const relay = data.relay;

		this.cachedRelay = {
			relay,
			expiresAt: Date.now() + RELAY_CACHE_TTL_MS,
		};

		logger.debug('Selected relay:', relay.url, 'region:', relay.region);

		return relay;
	}

	async getInstancePublicKey(instanceDomain: string, forceRefresh = false): Promise<InstancePublicKey> {
		const cachedInfo = await this.fetchInstanceInfo(instanceDomain, forceRefresh);
		return cachedInfo.key;
	}

	async getInstanceEndpoints(instanceDomain: string, forceRefresh = false): Promise<InstanceEndpoints> {
		const cachedInfo = await this.fetchInstanceInfo(instanceDomain, forceRefresh);
		return cachedInfo.endpoints;
	}

	private async fetchInstanceInfo(instanceDomain: string, forceRefresh = false): Promise<CachedInstanceInfo> {
		const cacheKey = instanceDomain.toLowerCase();

		if (!forceRefresh) {
			const cached = this.instanceInfoCache.get(cacheKey);
			if (cached && cached.expiresAt > Date.now()) {
				logger.debug('Using cached instance info for:', instanceDomain);
				return cached;
			}
		}

		logger.debug('Fetching instance info for:', instanceDomain);

		const wellKnownUrl = `https://${instanceDomain}/.well-known/fluxer`;
		const response = await fetch(wellKnownUrl, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch instance info: ${response.status} ${response.statusText}`);
		}

		const instanceInfo = (await response.json()) as {
			public_key?: InstancePublicKey;
			endpoints?: {
				gateway: string;
				api: string;
				media: string;
			};
			federation?: {enabled: boolean};
		};

		if (!instanceInfo.public_key) {
			throw new Error(`Instance ${instanceDomain} does not have a public key configured`);
		}

		if (!instanceInfo.federation?.enabled) {
			throw new Error(`Instance ${instanceDomain} does not have federation enabled`);
		}

		if (!instanceInfo.endpoints) {
			throw new Error(`Instance ${instanceDomain} does not have endpoints configured`);
		}

		const cachedInfo: CachedInstanceInfo = {
			key: instanceInfo.public_key,
			endpoints: {
				gateway: instanceInfo.endpoints.gateway,
				api: instanceInfo.endpoints.api,
				media: instanceInfo.endpoints.media,
			},
			expiresAt: Date.now() + INSTANCE_KEY_CACHE_TTL_MS,
		};

		this.instanceInfoCache.set(cacheKey, cachedInfo);

		logger.debug('Cached instance info for:', instanceDomain);

		return cachedInfo;
	}

	private async getOrCreateEphemeralKeyPair(): Promise<X25519KeyPair> {
		if (!this.ephemeralKeyPair) {
			this.ephemeralKeyPair = await generateKeyPair();
			logger.debug('Generated ephemeral key pair for relay communication');
		}
		return this.ephemeralKeyPair;
	}

	rotateEphemeralKeyPair(): void {
		this.ephemeralKeyPair = null;
		logger.debug('Ephemeral key pair marked for rotation');
	}

	async encryptedFetch<T = unknown>(
		targetInstance: string,
		path: string,
		options: RelayRequestOptions = {},
	): Promise<RelayResponse<T>> {
		const relay = await this.selectRelay();
		const instanceKey = await this.getInstancePublicKey(targetInstance);
		const ephemeralKeyPair = await this.getOrCreateEphemeralKeyPair();

		const recipientPublicKey = await importPublicKey(instanceKey.publicKeyBase64);
		const sharedSecret = await deriveSharedSecret(ephemeralKeyPair.privateKey, recipientPublicKey);

		const requestPayload = {
			method: options.method ?? 'GET',
			path,
			headers: options.headers ?? {},
			body: options.body,
			target_instance: targetInstance,
		};

		const requestJson = JSON.stringify(requestPayload);
		const {ciphertext, iv} = await encrypt(requestJson, sharedSecret);

		const encryptedRequest: EncryptedRelayRequest = {
			encrypted_request: ciphertext,
			iv,
			ephemeral_public_key: ephemeralKeyPair.publicKeyBase64,
		};

		logger.debug('Sending encrypted request to relay:', relay.url, 'target:', targetInstance, 'path:', path);

		const controller = new AbortController();
		const timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS;
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		let signalListener: (() => void) | null = null;
		if (options.signal) {
			if (options.signal.aborted) {
				controller.abort();
			} else {
				signalListener = () => controller.abort();
				options.signal.addEventListener('abort', signalListener);
			}
		}

		try {
			const relayResponse = await fetch(`${relay.url}/proxy`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Target-Instance': targetInstance,
					'X-Key-Id': instanceKey.id,
				},
				body: JSON.stringify(encryptedRequest),
				signal: controller.signal,
			});

			if (!relayResponse.ok) {
				const errorText = await relayResponse.text();
				throw new Error(`Relay request failed: ${relayResponse.status} ${errorText}`);
			}

			const encryptedResponse = (await relayResponse.json()) as EncryptedRelayResponse;

			const decryptedJson = await decryptToString(
				encryptedResponse.encrypted_response,
				sharedSecret,
				encryptedResponse.iv,
			);

			const responseData = JSON.parse(decryptedJson) as {
				status: number;
				headers: Record<string, string>;
				body: T;
			};

			logger.debug('Received encrypted response from:', targetInstance, 'status:', responseData.status);

			return {
				ok: responseData.status >= 200 && responseData.status < 300,
				status: responseData.status,
				headers: responseData.headers,
				body: responseData.body,
			};
		} finally {
			clearTimeout(timeoutId);
			if (options.signal && signalListener) {
				options.signal.removeEventListener('abort', signalListener);
			}
		}
	}

	async get<T = unknown>(
		targetInstance: string,
		path: string,
		options?: Omit<RelayRequestOptions, 'method' | 'body'>,
	): Promise<RelayResponse<T>> {
		return this.encryptedFetch<T>(targetInstance, path, {...options, method: 'GET'});
	}

	async post<T = unknown>(
		targetInstance: string,
		path: string,
		body?: unknown,
		options?: Omit<RelayRequestOptions, 'method'>,
	): Promise<RelayResponse<T>> {
		return this.encryptedFetch<T>(targetInstance, path, {...options, method: 'POST', body});
	}

	async put<T = unknown>(
		targetInstance: string,
		path: string,
		body?: unknown,
		options?: Omit<RelayRequestOptions, 'method'>,
	): Promise<RelayResponse<T>> {
		return this.encryptedFetch<T>(targetInstance, path, {...options, method: 'PUT', body});
	}

	async patch<T = unknown>(
		targetInstance: string,
		path: string,
		body?: unknown,
		options?: Omit<RelayRequestOptions, 'method'>,
	): Promise<RelayResponse<T>> {
		return this.encryptedFetch<T>(targetInstance, path, {...options, method: 'PATCH', body});
	}

	async delete<T = unknown>(
		targetInstance: string,
		path: string,
		options?: Omit<RelayRequestOptions, 'method' | 'body'>,
	): Promise<RelayResponse<T>> {
		return this.encryptedFetch<T>(targetInstance, path, {...options, method: 'DELETE'});
	}

	clearCache(): void {
		this.cachedRelay = null;
		this.instanceInfoCache.clear();
		this.ephemeralKeyPair = null;
		logger.debug('Cleared all relay client caches');
	}

	clearInstanceInfoCache(instanceDomain?: string): void {
		if (instanceDomain) {
			this.instanceInfoCache.delete(instanceDomain.toLowerCase());
			logger.debug('Cleared instance info cache for:', instanceDomain);
		} else {
			this.instanceInfoCache.clear();
			logger.debug('Cleared all instance info caches');
		}
	}
}

const relayClient = new RelayClient();
export default relayClient;
