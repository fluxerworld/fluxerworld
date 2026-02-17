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

import http from 'node:http';
import type {Socket} from 'node:net';
import type {Duplex} from 'node:stream';
import {Config} from '@app/Config';
import {Logger} from '@app/Logger';
import {extractClientIpFromHeaders} from '@fluxer/ip_utils/src/ClientIp';

export interface GatewayProxy {
	onUpgrade: (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void;
}

function formatHeaderValue(value: string | Array<string> | undefined): string {
	if (value === undefined) {
		return '';
	}
	if (Array.isArray(value)) {
		return value.join(', ');
	}
	return value;
}

function createResponseHeaders(res: http.IncomingMessage): string {
	const headers = Object.entries(res.headers)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}: ${formatHeaderValue(v)}`);
	return [`HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}`, ...headers, '', ''].join('\r\n');
}

function cleanupSockets(clientSocket: Socket, proxySocket?: Socket): void {
	if (!clientSocket.destroyed) {
		clientSocket.destroy();
	}
	if (proxySocket && !proxySocket.destroyed) {
		proxySocket.destroy();
	}
}

export function createGatewayProxy(): GatewayProxy {
	const gatewayHost = '127.0.0.1';
	const gatewayPort = Config.services.gateway.port;

	Logger.info({host: gatewayHost, port: gatewayPort}, 'Gateway Proxy initialized');

	const onUpgrade = (req: http.IncomingMessage, socket: Duplex, head: Buffer): void => {
		const clientSocket = socket as Socket;

		Logger.info({url: req.url, method: req.method}, 'Gateway proxy: received upgrade request');

		if (!req.url?.startsWith('/gateway')) {
			Logger.warn({url: req.url}, 'Gateway proxy: invalid path, destroying connection');
			clientSocket.destroy();
			return;
		}

		const stripped = req.url.replace(/^\/gateway/, '');
		const forwardPath = stripped === '' || stripped.startsWith('?') ? `/${stripped}` : stripped;

		Logger.info({forwardPath, host: gatewayHost, port: gatewayPort}, 'Gateway proxy: forwarding to gateway');

		const clientIp = extractClientIpFromHeaders(req.headers, {
			trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
		});

		const forwardedHeaders = {...req.headers};
		if (clientIp) {
			forwardedHeaders['x-forwarded-for'] = clientIp;
		}

		const options = {
			hostname: gatewayHost,
			port: gatewayPort,
			path: forwardPath,
			method: req.method,
			headers: forwardedHeaders,
		};

		const proxyReq = http.request(options);

		proxyReq.on('upgrade', (res, proxySocket, proxyHead) => {
			Logger.info({status: res.statusCode}, 'Gateway proxy: received upgrade response from gateway');
			if (!clientSocket.writable || !proxySocket.writable) {
				Logger.warn('Gateway proxy: socket not writable, cleaning up');
				cleanupSockets(clientSocket, proxySocket);
				return;
			}

			clientSocket.write(createResponseHeaders(res));
			clientSocket.write(proxyHead);
			proxySocket.write(head);

			clientSocket.pipe(proxySocket);
			proxySocket.pipe(clientSocket);

			proxySocket.on('error', (err) => {
				Logger.debug({error: err.message}, 'Gateway proxy socket error');
				cleanupSockets(clientSocket, proxySocket);
			});

			clientSocket.on('error', (err) => {
				Logger.debug({error: err.message}, 'Client socket error during proxy');
				cleanupSockets(clientSocket, proxySocket);
			});

			clientSocket.on('close', () => {
				if (!proxySocket.destroyed) {
					proxySocket.destroy();
				}
			});

			proxySocket.on('close', () => {
				if (!clientSocket.destroyed) {
					clientSocket.destroy();
				}
			});
		});

		proxyReq.on('error', (err) => {
			Logger.error(
				{error: err.message, code: (err as NodeJS.ErrnoException).code},
				'Gateway proxy: failed to proxy upgrade request',
			);
			clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
			cleanupSockets(clientSocket);
		});

		proxyReq.on('response', (res) => {
			Logger.info(
				{statusCode: res.statusCode, headers: res.headers},
				'Gateway proxy: received HTTP response (not upgrade)',
			);
		});

		clientSocket.on('error', () => {
			proxyReq.destroy();
		});

		proxyReq.end();
	};

	return {
		onUpgrade,
	};
}
