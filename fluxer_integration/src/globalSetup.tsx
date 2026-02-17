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

import {execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(__dirname, '../docker/compose.yaml');

const PROJECT_NAME = 'fluxer-integration';
const API_URL = 'http://localhost:18088/api/v1';
const GATEWAY_URL = 'ws://localhost:18088/gateway';
const HEALTH_CHECK_URL = `${API_URL}/_health`;
const MAX_WAIT_SECONDS = 120;
const POLL_INTERVAL_MS = 2000;

const GATEWAY_OPCODE_HELLO = 10;

async function waitForApi(): Promise<void> {
	const startTime = Date.now();
	const maxWaitMs = MAX_WAIT_SECONDS * 1000;

	while (Date.now() - startTime < maxWaitMs) {
		try {
			const response = await fetch(HEALTH_CHECK_URL, {
				headers: {'X-Forwarded-For': '127.0.0.1'},
			});
			if (response.ok) {
				console.log('API server is ready');
				return;
			}
		} catch {}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error(`API server did not become ready within ${MAX_WAIT_SECONDS} seconds`);
}

async function probeGateway(): Promise<void> {
	return new Promise((resolve, reject) => {
		const url = `${GATEWAY_URL}?v=1&encoding=json`;

		const ws = new WebSocket(url, {
			headers: {
				'User-Agent': 'FluxerIntegrationTests/1.0',
				Origin: 'http://localhost:5173',
			},
		});

		const timeout = setTimeout(() => {
			ws.close();
			reject(new Error('Gateway WebSocket probe timed out'));
		}, 10000);

		ws.on('message', (data: WebSocket.Data) => {
			try {
				const payload = JSON.parse(data.toString());
				if (payload.op === GATEWAY_OPCODE_HELLO) {
					clearTimeout(timeout);
					ws.close(1000, 'Probe complete');
					resolve();
				}
			} catch {
				clearTimeout(timeout);
				ws.close();
				reject(new Error('Failed to parse gateway message'));
			}
		});

		ws.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});

		ws.on('close', (code, reason) => {
			clearTimeout(timeout);
			if (code !== 1000) {
				reject(new Error(`Gateway WebSocket closed unexpectedly: ${code} ${reason.toString()}`));
			}
		});
	});
}

async function waitForGateway(): Promise<void> {
	const startTime = Date.now();
	const maxWaitMs = MAX_WAIT_SECONDS * 1000;

	while (Date.now() - startTime < maxWaitMs) {
		try {
			await probeGateway();
			console.log('Gateway is ready');
			return;
		} catch {}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error(`Gateway did not become ready within ${MAX_WAIT_SECONDS} seconds`);
}

function startContainers(): void {
	console.log('Starting integration test infrastructure...');

	try {
		execSync(`docker compose -p ${PROJECT_NAME} -f "${composeFile}" up -d --build --wait`, {
			stdio: 'inherit',
		});
	} catch (error) {
		console.error('Failed to start Docker containers:', error);
		throw error;
	}
}

function showContainerLogs(): void {
	try {
		console.log('\n=== Container logs ===');
		execSync(`docker compose -p ${PROJECT_NAME} -f "${composeFile}" logs --tail=100 fluxer_server`, {
			stdio: 'inherit',
		});
	} catch {}
}

export default async function globalSetup(): Promise<void> {
	console.log('\n=== Integration Test Global Setup ===\n');

	startContainers();

	try {
		await waitForApi();
		await waitForGateway();
	} catch (error) {
		showContainerLogs();
		throw error;
	}

	console.log('\n=== Infrastructure ready ===\n');
}
