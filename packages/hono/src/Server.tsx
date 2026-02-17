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

import {createServer as createNodeServer, type IncomingMessage, type Server} from 'node:http';
import type {Duplex} from 'node:stream';
import {getRequestListener, type ServerType, serve} from '@hono/node-server';
import type {Hono} from 'hono';

export interface ServerOptions {
	port: number;
	hostname?: string;
	onListen?: (info: {address: string; port: number}) => void;
}

export function createServer<E extends object = object>(app: Hono<E>, options: ServerOptions): ServerType {
	const {port, hostname, onListen} = options;

	return serve(
		{
			fetch: app.fetch,
			port,
			...(hostname !== undefined && {hostname}),
		},
		onListen,
	);
}

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export interface NodeServerOptions extends ServerOptions {
	onUpgrade?: UpgradeHandler;
	onServerCreated?: (server: Server) => void;
}

function resolveServerAddress(
	server: Server,
	fallbackHost: string,
	fallbackPort: number,
): {address: string; port: number} {
	const address = server.address();
	if (!address || typeof address === 'string') {
		return {address: fallbackHost, port: fallbackPort};
	}
	return {address: address.address, port: address.port};
}

export function createServerWithUpgrade<E extends object = object>(app: Hono<E>, options: NodeServerOptions): Server {
	const {port, hostname, onListen, onUpgrade, onServerCreated} = options;
	const server = createNodeServer(getRequestListener(app.fetch));
	const fallbackHost = hostname ?? '0.0.0.0';

	if (onUpgrade) {
		server.on('upgrade', (req, socket, head) => onUpgrade(req, socket, head));
	}

	if (onServerCreated) {
		onServerCreated(server);
	}

	server.listen(port, hostname, () => {
		if (onListen) {
			onListen(resolveServerAddress(server, fallbackHost, port));
		}
	});

	return server;
}

export type CleanupFunction = () => void | Promise<void>;

export interface ShutdownLogger {
	info(msg: string): void;
	info(obj: Record<string, unknown>, msg: string): void;
	error(msg: string): void;
	error(obj: Record<string, unknown>, msg: string): void;
}

const defaultShutdownLogger: ShutdownLogger = {
	info(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			process.stdout.write(`[info] ${objOrMsg}\n`);
		} else if (msg) {
			process.stdout.write(`[info] ${msg} ${JSON.stringify(objOrMsg)}\n`);
		}
	},
	error(objOrMsg: Record<string, unknown> | string, msg?: string): void {
		if (typeof objOrMsg === 'string') {
			process.stderr.write(`[error] ${objOrMsg}\n`);
		} else if (msg) {
			process.stderr.write(`[error] ${msg} ${JSON.stringify(objOrMsg)}\n`);
		}
	},
};

export interface GracefulShutdownOptions {
	logger?: ShutdownLogger;
	timeoutMs?: number;
}

export function setupGracefulShutdown(cleanupFn: CleanupFunction, options?: GracefulShutdownOptions): void {
	const logger = options?.logger ?? defaultShutdownLogger;
	const timeoutMs = options?.timeoutMs;
	let isShuttingDown = false;

	const shutdown = async (signal: string): Promise<void> => {
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;
		logger.info({signal}, `Received ${signal}, shutting down gracefully...`);
		let timeoutHandle: NodeJS.Timeout | undefined;
		if (timeoutMs && timeoutMs > 0) {
			timeoutHandle = setTimeout(() => {
				logger.error({timeoutMs}, 'Forcing shutdown after timeout');
				process.exit(1);
			}, timeoutMs);
		}
		try {
			await cleanupFn();
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		} catch (err) {
			logger.error({err: err instanceof Error ? err : new Error(String(err))}, 'Error during shutdown');
			process.exit(1);
		}
		process.exit(0);
	};

	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));
}
