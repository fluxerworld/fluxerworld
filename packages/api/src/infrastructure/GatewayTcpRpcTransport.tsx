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

import {createConnection, type Socket} from 'node:net';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {GatewayRpcMethodError} from '@fluxer/api/src/infrastructure/GatewayRpcError';
import {
	decodeGatewayTcpFrames,
	encodeGatewayTcpFrame,
	MAX_GATEWAY_TCP_FRAME_BYTES,
} from '@fluxer/api/src/infrastructure/GatewayTcpFrameCodec';

interface GatewayTcpRequestFrame {
	type: 'request';
	id: string;
	method: string;
	params: Record<string, unknown>;
}

interface GatewayTcpHelloFrame {
	type: 'hello';
	protocol: 'fluxer.rpc.tcp.v1';
	authorization: string;
}

interface GatewayTcpHelloAckFrame {
	type: 'hello_ack';
	protocol: string;
	max_in_flight?: number;
	ping_interval_ms?: number;
}

interface GatewayTcpResponseFrame {
	type: 'response';
	id: string;
	ok: boolean;
	result?: unknown;
	error?: unknown;
}

interface GatewayTcpErrorFrame {
	type: 'error';
	error?: unknown;
}

interface GatewayTcpPingFrame {
	type: 'ping' | 'pong';
}

type TcpBuffer = Buffer<ArrayBufferLike>;

interface GatewayTcpRpcTransportOptions {
	host: string;
	port: number;
	authorization: string;
	connectTimeoutMs: number;
	requestTimeoutMs: number;
	defaultPingIntervalMs: number;
	maxFrameBytes?: number;
	maxPendingRequests?: number;
	maxBufferBytes?: number;
	logger: ILogger;
}

interface PendingGatewayTcpRequest {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
}

const GATEWAY_TCP_PROTOCOL = 'fluxer.rpc.tcp.v1';

function isHelloAckFrame(frame: unknown): frame is GatewayTcpHelloAckFrame {
	if (!frame || typeof frame !== 'object') {
		return false;
	}
	const candidate = frame as {type?: unknown; protocol?: unknown};
	return candidate.type === 'hello_ack' && typeof candidate.protocol === 'string';
}

function isResponseFrame(frame: unknown): frame is GatewayTcpResponseFrame {
	if (!frame || typeof frame !== 'object') {
		return false;
	}
	const candidate = frame as {type?: unknown; id?: unknown; ok?: unknown};
	return candidate.type === 'response' && typeof candidate.id === 'string' && typeof candidate.ok === 'boolean';
}

function isErrorFrame(frame: unknown): frame is GatewayTcpErrorFrame {
	if (!frame || typeof frame !== 'object') {
		return false;
	}
	const candidate = frame as {type?: unknown};
	return candidate.type === 'error';
}

export class GatewayTcpTransportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GatewayTcpTransportError';
	}
}

export class GatewayTcpRpcTransport {
	private readonly options: GatewayTcpRpcTransportOptions;
	private readonly maxFrameBytes: number;
	private readonly maxPendingRequests: number;
	private readonly maxBufferBytes: number;
	private socket: Socket | null = null;
	private connectPromise: Promise<void> | null = null;
	private buffer: TcpBuffer = Buffer.alloc(0);
	private nextRequestId = 1;
	private pendingRequests = new Map<string, PendingGatewayTcpRequest>();
	private negotiatedMaxPendingRequests: number | null = null;
	private resolveHelloAck: (() => void) | null = null;
	private rejectHelloAck: ((error: Error) => void) | null = null;
	private pingTimer: NodeJS.Timeout | null = null;
	private destroyed = false;
	private helloAcknowledged = false;

	constructor(options: GatewayTcpRpcTransportOptions) {
		this.options = options;
		this.maxFrameBytes = options.maxFrameBytes ?? MAX_GATEWAY_TCP_FRAME_BYTES;
		this.maxPendingRequests = Math.max(1, options.maxPendingRequests ?? 1024);
		this.maxBufferBytes = Math.max(1, options.maxBufferBytes ?? this.maxFrameBytes * 2);
	}

	async call(method: string, params: Record<string, unknown>): Promise<unknown> {
		if (this.destroyed) {
			throw new GatewayTcpTransportError('Gateway TCP transport is destroyed');
		}

		await this.ensureConnected();
		const maxPendingRequests = this.getEffectiveMaxPendingRequests();
		if (this.pendingRequests.size >= maxPendingRequests) {
			throw new GatewayTcpTransportError(
				`Gateway TCP request queue is full (pending=${this.pendingRequests.size}, limit=${maxPendingRequests})`,
			);
		}

		const requestId = `${this.nextRequestId}`;
		this.nextRequestId += 1;

		const responsePromise = new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				const error = new GatewayTcpTransportError('Gateway TCP request timed out');
				reject(error);
				this.closeSocket(error);
			}, this.options.requestTimeoutMs);

			this.pendingRequests.set(requestId, {resolve, reject, timeout});
		});

		const frame: GatewayTcpRequestFrame = {
			type: 'request',
			id: requestId,
			method,
			params,
		};

		try {
			await this.sendFrame(frame);
		} catch (error) {
			const pending = this.pendingRequests.get(requestId);
			if (pending) {
				clearTimeout(pending.timeout);
				this.pendingRequests.delete(requestId);
				pending.reject(this.toTransportError(error, 'Gateway TCP send failed'));
			}
			throw this.toTransportError(error, 'Gateway TCP send failed');
		}

		return responsePromise;
	}

	async destroy(): Promise<void> {
		this.destroyed = true;
		this.closeSocket(new GatewayTcpTransportError('Gateway TCP transport destroyed'));
		if (this.connectPromise) {
			try {
				await this.connectPromise;
			} catch {}
		}
	}

	private async ensureConnected(): Promise<void> {
		if (this.socket && !this.socket.destroyed && this.helloAcknowledged) {
			return;
		}

		if (this.connectPromise) {
			await this.connectPromise;
			return;
		}

		this.connectPromise = this.openConnection();
		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
	}

	private async openConnection(): Promise<void> {
		const socket = createConnection({
			host: this.options.host,
			port: this.options.port,
		});

		socket.setNoDelay(true);
		socket.setKeepAlive(true);

		socket.on('data', (data: Buffer) => {
			this.handleSocketData(socket, data);
		});
		socket.on('error', (error: Error) => {
			this.handleSocketError(socket, error);
		});
		socket.on('close', () => {
			this.handleSocketClose(socket);
		});

		await this.waitForSocketConnect(socket);

		this.socket = socket;
		this.buffer = Buffer.alloc(0);
		this.helloAcknowledged = false;

		const helloAckPromise = new Promise<void>((resolve, reject) => {
			this.resolveHelloAck = resolve;
			this.rejectHelloAck = reject;
		});

		const helloFrame: GatewayTcpHelloFrame = {
			type: 'hello',
			protocol: GATEWAY_TCP_PROTOCOL,
			authorization: this.options.authorization,
		};

		await this.sendFrame(helloFrame);
		await helloAckPromise;
	}

	private async waitForSocketConnect(socket: Socket): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const onConnect = () => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timeoutHandle);
				socket.off('error', onError);
				resolve();
			};
			const onError = (error: Error) => {
				if (settled) {
					return;
				}
				settled = true;
				clearTimeout(timeoutHandle);
				socket.off('connect', onConnect);
				reject(new GatewayTcpTransportError(error.message));
			};
			const timeoutHandle = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				socket.off('connect', onConnect);
				socket.off('error', onError);
				socket.destroy();
				reject(new GatewayTcpTransportError('Gateway TCP connect timeout'));
			}, this.options.connectTimeoutMs);

			socket.once('connect', onConnect);
			socket.once('error', onError);
		});
	}

	private handleSocketData(socket: Socket, data: TcpBuffer): void {
		if (this.socket !== socket) {
			return;
		}

		const nextBufferSize = this.buffer.length + data.length;
		if (nextBufferSize > this.maxBufferBytes) {
			this.options.logger.warn(
				{
					bufferBytes: nextBufferSize,
					maxBufferBytes: this.maxBufferBytes,
				},
				'[gateway-rpc-tcp] input buffer limit exceeded',
			);
			this.closeSocket(
				new GatewayTcpTransportError(
					`Gateway TCP input buffer exceeded maximum size (buffer_bytes=${nextBufferSize}, max_buffer_bytes=${this.maxBufferBytes})`,
				),
			);
			return;
		}

		this.buffer = Buffer.concat([this.buffer, data]);
		let decodedFrames: ReturnType<typeof decodeGatewayTcpFrames>;
		try {
			decodedFrames = decodeGatewayTcpFrames(this.buffer, this.maxFrameBytes);
		} catch (error) {
			const transportError = this.toTransportError(error, 'Gateway TCP protocol decode failed');
			this.closeSocket(transportError);
			return;
		}

		this.buffer = decodedFrames.remainder;
		for (const frame of decodedFrames.frames) {
			this.handleIncomingFrame(frame);
		}
	}

	private handleIncomingFrame(frame: unknown): void {
		if (!frame || typeof frame !== 'object') {
			this.closeSocket(new GatewayTcpTransportError('Gateway TCP frame is not an object'));
			return;
		}

		const frameMap = frame as Record<string, unknown>;
		if (isHelloAckFrame(frameMap)) {
			this.handleHelloAckFrame(frameMap);
			return;
		}
		if (isResponseFrame(frameMap)) {
			this.handleResponseFrame(frameMap);
			return;
		}
		if (isErrorFrame(frameMap)) {
			const errorFrame = frameMap;
			const message =
				typeof errorFrame.error === 'string' && errorFrame.error.length > 0
					? errorFrame.error
					: 'Gateway TCP returned an error frame';
			this.closeSocket(new GatewayTcpTransportError(message));
			return;
		}
		if (frameMap.type === 'ping') {
			void this.sendFrame({type: 'pong'} satisfies GatewayTcpPingFrame).catch((error) => {
				this.closeSocket(this.toTransportError(error, 'Gateway TCP pong send failed'));
			});
			return;
		}
		if (frameMap.type === 'pong') {
			return;
		}

		this.closeSocket(new GatewayTcpTransportError('Gateway TCP received unknown frame type'));
	}

	private handleHelloAckFrame(frame: GatewayTcpHelloAckFrame): void {
		if (frame.protocol !== GATEWAY_TCP_PROTOCOL) {
			this.closeSocket(new GatewayTcpTransportError('Gateway TCP protocol mismatch'));
			return;
		}

		this.negotiatedMaxPendingRequests = this.resolveNegotiatedMaxPendingRequests(frame.max_in_flight);
		this.helloAcknowledged = true;
		this.startPingTimer(frame.ping_interval_ms);
		if (this.resolveHelloAck) {
			this.resolveHelloAck();
			this.resolveHelloAck = null;
			this.rejectHelloAck = null;
		}
	}

	private handleResponseFrame(frame: GatewayTcpResponseFrame): void {
		if (typeof frame.id !== 'string') {
			this.closeSocket(new GatewayTcpTransportError('Gateway TCP response missing request id'));
			return;
		}

		const pending = this.pendingRequests.get(frame.id);
		if (!pending) {
			return;
		}

		clearTimeout(pending.timeout);
		this.pendingRequests.delete(frame.id);

		if (frame.ok) {
			pending.resolve(frame.result);
			return;
		}

		if (typeof frame.error === 'string' && frame.error.length > 0) {
			pending.reject(new GatewayRpcMethodError(frame.error));
			return;
		}

		pending.reject(new Error('Gateway RPC request failed'));
	}

	private async sendFrame(frame: unknown): Promise<void> {
		const socket = this.socket;
		if (!socket || socket.destroyed) {
			throw new GatewayTcpTransportError('Gateway TCP socket is not connected');
		}

		const encoded = encodeGatewayTcpFrame(frame, this.maxFrameBytes);
		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error) => {
				socket.off('drain', onDrain);
				reject(error);
			};
			const onDrain = () => {
				socket.off('error', onError);
				resolve();
			};

			socket.once('error', onError);
			const canWrite = socket.write(encoded, () => {
				if (canWrite) {
					socket.off('error', onError);
					resolve();
				}
			});
			if (!canWrite) {
				socket.once('drain', onDrain);
			}
		});
	}

	private startPingTimer(pingIntervalMs?: number): void {
		this.stopPingTimer();
		const intervalMs = pingIntervalMs ?? this.options.defaultPingIntervalMs;
		this.pingTimer = setInterval(() => {
			void this.sendFrame({type: 'ping'} satisfies GatewayTcpPingFrame).catch((error) => {
				this.closeSocket(this.toTransportError(error, 'Gateway TCP ping failed'));
			});
		}, intervalMs);
	}

	private stopPingTimer(): void {
		if (!this.pingTimer) {
			return;
		}
		clearInterval(this.pingTimer);
		this.pingTimer = null;
	}

	private handleSocketError(socket: Socket, error: Error): void {
		if (this.socket !== socket) {
			return;
		}
		const transportError = this.toTransportError(error, 'Gateway TCP socket error');
		this.options.logger.warn({error: transportError}, '[gateway-rpc-tcp] socket error');
		this.closeSocket(transportError);
	}

	private handleSocketClose(socket: Socket): void {
		if (this.socket !== socket) {
			return;
		}
		this.closeSocket(new GatewayTcpTransportError('Gateway TCP socket closed'));
	}

	private closeSocket(error: Error): void {
		this.stopPingTimer();
		this.helloAcknowledged = false;
		this.buffer = Buffer.alloc(0);
		this.negotiatedMaxPendingRequests = null;

		if (this.rejectHelloAck) {
			this.rejectHelloAck(error);
			this.resolveHelloAck = null;
			this.rejectHelloAck = null;
		}

		for (const pending of this.pendingRequests.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pendingRequests.clear();

		const socket = this.socket;
		this.socket = null;
		if (socket && !socket.destroyed) {
			socket.destroy();
		}
	}

	private toTransportError(error: unknown, fallbackMessage: string): GatewayTcpTransportError {
		if (error instanceof GatewayTcpTransportError) {
			return error;
		}
		if (error instanceof Error && error.message.length > 0) {
			return new GatewayTcpTransportError(error.message);
		}
		return new GatewayTcpTransportError(fallbackMessage);
	}

	private getEffectiveMaxPendingRequests(): number {
		if (this.negotiatedMaxPendingRequests === null) {
			return this.maxPendingRequests;
		}
		return this.negotiatedMaxPendingRequests;
	}

	private resolveNegotiatedMaxPendingRequests(maxInFlight: unknown): number | null {
		if (typeof maxInFlight !== 'number' || !Number.isInteger(maxInFlight) || maxInFlight <= 0) {
			return null;
		}
		return Math.min(this.maxPendingRequests, maxInFlight);
	}
}
