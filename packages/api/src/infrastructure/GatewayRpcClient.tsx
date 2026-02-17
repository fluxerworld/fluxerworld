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

import {Config} from '@fluxer/api/src/Config';
import {GatewayRpcMethodError, GatewayRpcMethodErrorCodes} from '@fluxer/api/src/infrastructure/GatewayRpcError';
import {GatewayTcpRpcTransport, GatewayTcpTransportError} from '@fluxer/api/src/infrastructure/GatewayTcpRpcTransport';
import type {IGatewayRpcTransport} from '@fluxer/api/src/infrastructure/IGatewayRpcTransport';
import type {CallData} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import {ms} from 'itty-time';

interface GatewayRpcResponse {
	result?: unknown;
	error?: unknown;
}

const MAX_RETRY_ATTEMPTS = 3;
const TCP_FALLBACK_COOLDOWN_MS = ms('5 seconds');
const TCP_CONNECT_TIMEOUT_MS = 150;
const TCP_REQUEST_TIMEOUT_MS = ms('10 seconds');
const TCP_DEFAULT_PING_INTERVAL_MS = ms('15 seconds');
const TCP_MAX_PENDING_REQUESTS = 1024;
const TCP_MAX_BUFFER_BYTES = 2 * 1024 * 1024;

interface GatewayRpcClientOptions {
	tcpTransport?: IGatewayRpcTransport;
}

export class GatewayRpcClient {
	private static instance: GatewayRpcClient | null = null;

	private readonly httpEndpoint: string;
	private readonly tcpTransport: IGatewayRpcTransport;
	private tcpFallbackUntilMs = 0;

	private constructor(options?: GatewayRpcClientOptions) {
		this.httpEndpoint = `${Config.gateway.rpcEndpoint}/_rpc`;
		this.tcpTransport = options?.tcpTransport ?? this.createGatewayTcpTransport();
	}

	static getInstance(): GatewayRpcClient {
		if (!GatewayRpcClient.instance) {
			GatewayRpcClient.instance = new GatewayRpcClient();
		}
		return GatewayRpcClient.instance;
	}

	static async resetForTests(): Promise<void> {
		if (!GatewayRpcClient.instance) {
			return;
		}
		await GatewayRpcClient.instance.tcpTransport.destroy();
		GatewayRpcClient.instance = null;
	}

	private createGatewayTcpTransport(): GatewayTcpRpcTransport {
		const endpointUrl = new URL(Config.gateway.rpcEndpoint);
		return new GatewayTcpRpcTransport({
			host: endpointUrl.hostname,
			port: Config.gateway.rpcTcpPort,
			authorization: `Bearer ${Config.gateway.rpcSecret}`,
			connectTimeoutMs: TCP_CONNECT_TIMEOUT_MS,
			requestTimeoutMs: TCP_REQUEST_TIMEOUT_MS,
			defaultPingIntervalMs: TCP_DEFAULT_PING_INTERVAL_MS,
			maxPendingRequests: TCP_MAX_PENDING_REQUESTS,
			maxBufferBytes: TCP_MAX_BUFFER_BYTES,
			logger: Logger,
		});
	}

	async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
		Logger.debug(`[gateway-rpc] calling ${method}`);
		const startTime = Date.now();

		for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
			try {
				const result = await this.executeCall(method, params);

				const duration = Date.now() - startTime;
				recordHistogram({
					name: 'gateway.rpc.duration',
					valueMs: duration,
					dimensions: {method, success: 'true'},
				});

				return result as T;
			} catch (error) {
				const shouldRetry = this.shouldRetry(error, method);
				if (attempt === MAX_RETRY_ATTEMPTS || !shouldRetry) {
					const duration = Date.now() - startTime;
					recordHistogram({
						name: 'gateway.rpc.duration',
						valueMs: duration,
						dimensions: {method, success: 'false'},
					});
					recordCounter({
						name: 'gateway.rpc.error',
						dimensions: {method, attempt: attempt.toString()},
					});
					throw error;
				}

				const backoffMs = this.calculateBackoff(attempt);
				Logger.warn({error, attempt: attempt + 1, backoffMs}, '[gateway-rpc] retrying failed request');
				await this.delay(backoffMs);
			}
		}

		throw new Error('Unexpected gateway RPC retry failure');
	}

	private async executeCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
		if (Date.now() >= this.tcpFallbackUntilMs) {
			try {
				const result = await this.tcpTransport.call(method, params);
				return result as T;
			} catch (error) {
				if (!(error instanceof GatewayTcpTransportError)) {
					throw error;
				}
				this.tcpFallbackUntilMs = Date.now() + TCP_FALLBACK_COOLDOWN_MS;
				Logger.warn({error}, '[gateway-rpc] TCP transport unavailable, falling back to HTTP');
			}
		}
		return this.executeHttpCall(method, params);
	}

	private async executeHttpCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
		let response: Response;
		try {
			response = await fetch(this.httpEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${Config.gateway.rpcSecret}`,
				},
				body: JSON.stringify({
					method,
					params,
				}),
				signal: AbortSignal.timeout(ms('10 seconds')),
			});
		} catch (error) {
			if (error instanceof Error && error.name === 'TimeoutError') {
				Logger.error({method}, '[gateway-rpc] request timed out after 10s');
			} else {
				Logger.error({error}, '[gateway-rpc] request failed to reach gateway');
			}
			throw error;
		}

		const text = await response.text();

		let payload: GatewayRpcResponse = {};
		if (text.length > 0) {
			try {
				payload = JSON.parse(text) as GatewayRpcResponse;
			} catch (error) {
				Logger.error({error, body: text, status: response.status}, '[gateway-rpc] failed to parse response body');
				throw new Error('Malformed gateway RPC response');
			}
		}

		if (!response.ok) {
			if (typeof payload.error === 'string' && payload.error.length > 0) {
				throw new GatewayRpcMethodError(payload.error);
			}

			throw new Error(`Gateway RPC request failed with status ${response.status}`);
		}

		if (!Object.hasOwn(payload, 'result')) {
			Logger.error({status: response.status, body: payload}, '[gateway-rpc] response missing result value');
			throw new Error('Malformed gateway RPC response');
		}

		return payload.result as T;
	}

	private calculateBackoff(attempt: number): number {
		const multiplier = 2 ** attempt;
		return Math.min(500 * multiplier, ms('5 seconds'));
	}

	private shouldRetry(error: unknown, method: string): boolean {
		if (error instanceof GatewayTcpTransportError) {
			return true;
		}
		if (!(error instanceof Error)) {
			return false;
		}
		if (error.name === 'TimeoutError') {
			return true;
		}
		if (this.isRetryableOverloadError(error, method)) {
			return true;
		}
		return error.name === 'TypeError';
	}

	private isRetryableOverloadError(error: Error, method: string): boolean {
		if (!this.isDispatchMethod(method)) {
			return false;
		}
		if (!(error instanceof GatewayRpcMethodError)) {
			return false;
		}
		return error.code === GatewayRpcMethodErrorCodes.OVERLOADED;
	}

	private isDispatchMethod(method: string): boolean {
		return method.endsWith('.dispatch');
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	async getCall(channelId: string): Promise<CallData | null> {
		return this.call<CallData | null>('call.get', {channel_id: channelId});
	}

	async createCall(
		channelId: string,
		messageId: string,
		region: string,
		ringing: Array<string>,
		recipients: Array<string>,
	): Promise<CallData> {
		return this.call<CallData>('call.create', {
			channel_id: channelId,
			message_id: messageId,
			region,
			ringing,
			recipients,
		});
	}

	async updateCallRegion(channelId: string, region: string | null): Promise<boolean> {
		return this.call('call.update_region', {channel_id: channelId, region});
	}

	async ringCallRecipients(channelId: string, recipients: Array<string>): Promise<boolean> {
		return this.call('call.ring', {channel_id: channelId, recipients});
	}

	async stopRingingCallRecipients(channelId: string, recipients: Array<string>): Promise<boolean> {
		return this.call('call.stop_ringing', {channel_id: channelId, recipients});
	}

	async deleteCall(channelId: string): Promise<boolean> {
		return this.call('call.delete', {channel_id: channelId});
	}

	async getNodeStats(): Promise<unknown> {
		return this.call('process.node_stats', {});
	}
}
