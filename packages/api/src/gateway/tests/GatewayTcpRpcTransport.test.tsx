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

import {createServer, type Server, type Socket} from 'node:net';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {decodeGatewayTcpFrames, encodeGatewayTcpFrame} from '@fluxer/api/src/infrastructure/GatewayTcpFrameCodec';
import {GatewayTcpRpcTransport} from '@fluxer/api/src/infrastructure/GatewayTcpRpcTransport';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

interface TestTcpServer {
	server: Server;
	port: number;
}

interface ConnectionContext {
	socket: Socket;
	getBuffer: () => Buffer<ArrayBufferLike>;
	setBuffer: (buffer: Buffer<ArrayBufferLike>) => void;
}

function createNoopLogger(): ILogger {
	return {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn(() => createNoopLogger()),
	};
}

async function startTestServer(
	handler: (context: ConnectionContext, frame: Record<string, unknown>) => void,
): Promise<TestTcpServer> {
	const server = createServer((socket) => {
		let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
		const context: ConnectionContext = {
			socket,
			getBuffer: () => buffer,
			setBuffer: (nextBuffer) => {
				buffer = nextBuffer;
			},
		};

		socket.on('data', (chunk: Buffer<ArrayBufferLike> | string) => {
			const chunkBuffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
			const combined = Buffer.concat([context.getBuffer(), chunkBuffer]);
			const decoded = decodeGatewayTcpFrames(combined);
			context.setBuffer(decoded.remainder);
			for (const frame of decoded.frames) {
				handler(context, frame as Record<string, unknown>);
			}
		});
	});

	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve());
	});

	const address = server.address();
	if (!address || typeof address === 'string') {
		throw new Error('Failed to get TCP server address');
	}

	return {server, port: address.port};
}

async function stopTestServer(server: Server): Promise<void> {
	await new Promise<void>((resolve) => {
		server.close(() => resolve());
	});
}

function sendFrame(socket: Socket, frame: Record<string, unknown>): void {
	socket.write(encodeGatewayTcpFrame(frame));
}

describe('GatewayTcpRpcTransport', () => {
	let tcpServer: TestTcpServer | null = null;
	let transport: GatewayTcpRpcTransport | null = null;

	afterEach(async () => {
		if (transport) {
			await transport.destroy();
			transport = null;
		}
		if (tcpServer) {
			await stopTestServer(tcpServer.server);
			tcpServer = null;
		}
	});

	beforeEach(() => {
		vi.useRealTimers();
	});

	test('multiplexes concurrent requests and matches out-of-order responses', async () => {
		let requestOneId: string | null = null;
		let requestTwoId: string | null = null;

		tcpServer = await startTestServer((context, frame) => {
			if (frame.type === 'hello') {
				sendFrame(context.socket, {
					type: 'hello_ack',
					protocol: 'fluxer.rpc.tcp.v1',
					ping_interval_ms: 60000,
				});
				return;
			}
			if (frame.type === 'request') {
				const requestId = String(frame.id);
				const method = String(frame.method);
				if (method === 'first') {
					requestOneId = requestId;
				}
				if (method === 'second') {
					requestTwoId = requestId;
				}
				if (requestOneId && requestTwoId) {
					sendFrame(context.socket, {
						type: 'response',
						id: requestTwoId,
						ok: true,
						result: 'second-result',
					});
					sendFrame(context.socket, {
						type: 'response',
						id: requestOneId,
						ok: true,
						result: 'first-result',
					});
				}
			}
		});

		transport = new GatewayTcpRpcTransport({
			host: '127.0.0.1',
			port: tcpServer.port,
			authorization: 'Bearer test-secret',
			connectTimeoutMs: 300,
			requestTimeoutMs: 2000,
			defaultPingIntervalMs: 60000,
			logger: createNoopLogger(),
		});

		const firstPromise = transport.call('first', {});
		const secondPromise = transport.call('second', {});
		const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
		expect(firstResult).toBe('first-result');
		expect(secondResult).toBe('second-result');
	});

	test('reconnects automatically after server-side disconnect', async () => {
		let connectionCount = 0;
		let firstRequestSeen = false;

		tcpServer = await startTestServer((context, frame) => {
			if (frame.type === 'hello') {
				connectionCount += 1;
				sendFrame(context.socket, {
					type: 'hello_ack',
					protocol: 'fluxer.rpc.tcp.v1',
					ping_interval_ms: 60000,
				});
				return;
			}

			if (frame.type === 'request') {
				const requestId = String(frame.id);
				if (!firstRequestSeen) {
					firstRequestSeen = true;
					sendFrame(context.socket, {
						type: 'response',
						id: requestId,
						ok: true,
						result: 'first-response',
					});
					setTimeout(() => {
						context.socket.destroy();
					}, 5);
					return;
				}

				sendFrame(context.socket, {
					type: 'response',
					id: requestId,
					ok: true,
					result: 'second-response',
				});
			}
		});

		transport = new GatewayTcpRpcTransport({
			host: '127.0.0.1',
			port: tcpServer.port,
			authorization: 'Bearer test-secret',
			connectTimeoutMs: 300,
			requestTimeoutMs: 2000,
			defaultPingIntervalMs: 60000,
			logger: createNoopLogger(),
		});

		const firstResult = await transport.call('first', {});
		expect(firstResult).toBe('first-response');

		await new Promise((resolve) => setTimeout(resolve, 20));
		const secondResult = await transport.call('second', {});
		expect(secondResult).toBe('second-response');
		expect(connectionCount).toBeGreaterThanOrEqual(2);
	});

	test('rejects new requests when pending queue is full', async () => {
		tcpServer = await startTestServer((context, frame) => {
			if (frame.type === 'hello') {
				sendFrame(context.socket, {
					type: 'hello_ack',
					protocol: 'fluxer.rpc.tcp.v1',
					ping_interval_ms: 60000,
				});
				return;
			}
			if (frame.type !== 'request') {
				return;
			}

			const requestId = String(frame.id);
			const method = String(frame.method);
			if (method === 'first') {
				setTimeout(() => {
					sendFrame(context.socket, {
						type: 'response',
						id: requestId,
						ok: true,
						result: 'first-response',
					});
				}, 40);
				return;
			}

			sendFrame(context.socket, {
				type: 'response',
				id: requestId,
				ok: true,
				result: 'unexpected-response',
			});
		});

		transport = new GatewayTcpRpcTransport({
			host: '127.0.0.1',
			port: tcpServer.port,
			authorization: 'Bearer test-secret',
			connectTimeoutMs: 300,
			requestTimeoutMs: 2000,
			defaultPingIntervalMs: 60000,
			maxPendingRequests: 1,
			logger: createNoopLogger(),
		});

		const firstPromise = transport.call('first', {});
		await expect(transport.call('second', {})).rejects.toThrow('Gateway TCP request queue is full');
		await expect(firstPromise).resolves.toBe('first-response');
	});

	test('closes the connection when the input buffer exceeds limit', async () => {
		tcpServer = await startTestServer((context, frame) => {
			if (frame.type === 'hello') {
				sendFrame(context.socket, {
					type: 'hello_ack',
					protocol: 'fluxer.rpc.tcp.v1',
					ping_interval_ms: 60000,
				});
				return;
			}
			if (frame.type === 'request') {
				context.socket.write(Buffer.from('9999999999999999999999999999999999999999999999999999999999999999999999'));
			}
		});

		transport = new GatewayTcpRpcTransport({
			host: '127.0.0.1',
			port: tcpServer.port,
			authorization: 'Bearer test-secret',
			connectTimeoutMs: 300,
			requestTimeoutMs: 2000,
			defaultPingIntervalMs: 60000,
			maxBufferBytes: 64,
			logger: createNoopLogger(),
		});

		await expect(transport.call('overflow', {})).rejects.toThrow('Gateway TCP input buffer exceeded maximum size');
	});
});
