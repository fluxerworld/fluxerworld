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

import fs from 'node:fs/promises';
import {createConnection} from 'node:net';
import {Config} from '@fluxer/api/src/Config';

interface ScanResult {
	isClean: boolean;
	virus?: string;
}

export class ClamAV {
	constructor(
		private host: string = Config.clamav.host,
		private port: number = Config.clamav.port,
	) {}

	async scanFile(filePath: string): Promise<ScanResult> {
		const buffer = await fs.readFile(filePath);
		return this.scanBuffer(buffer);
	}

	async scanBuffer(buffer: Buffer): Promise<ScanResult> {
		return new Promise((resolve, reject) => {
			const socket = createConnection(this.port, this.host);
			let response = '';
			let isResolved = false;

			const cleanup = () => {
				if (!socket.destroyed) {
					socket.destroy();
				}
			};

			const doReject = (error: Error) => {
				if (isResolved) return;
				isResolved = true;
				cleanup();
				reject(error);
			};

			const doResolve = (result: ScanResult) => {
				if (isResolved) return;
				isResolved = true;
				cleanup();
				resolve(result);
			};

			socket.on('connect', () => {
				try {
					socket.write('zINSTREAM\0');

					const chunkSize = Math.min(buffer.length, 2048);
					let offset = 0;

					while (offset < buffer.length) {
						const remainingBytes = buffer.length - offset;
						const bytesToSend = Math.min(chunkSize, remainingBytes);

						const sizeBuffer = Buffer.alloc(4);
						sizeBuffer.writeUInt32BE(bytesToSend, 0);
						socket.write(sizeBuffer);

						socket.write(buffer.subarray(offset, offset + bytesToSend));
						offset += bytesToSend;
					}

					const endBuffer = Buffer.alloc(4);
					endBuffer.writeUInt32BE(0, 0);
					socket.write(endBuffer);
				} catch (error) {
					doReject(new Error(`ClamAV write failed: ${error instanceof Error ? error.message : String(error)}`));
				}
			});

			socket.on('data', (data) => {
				response += data.toString();
			});

			socket.on('end', () => {
				const trimmedResponse = response.trim();

				if (trimmedResponse.includes('FOUND')) {
					const virusMatch = trimmedResponse.match(/:\s(.+)\sFOUND/);
					const virus = virusMatch ? virusMatch[1] : 'Virus detected';

					doResolve({
						isClean: false,
						virus,
					});
				} else if (trimmedResponse.includes('OK')) {
					doResolve({
						isClean: true,
					});
				} else {
					doReject(new Error(`Unexpected ClamAV response: ${trimmedResponse}`));
				}
			});

			socket.on('error', (error) => {
				doReject(new Error(`ClamAV connection failed: ${error.message}`));
			});
		});
	}
}
