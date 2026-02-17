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

export const MAX_GATEWAY_TCP_FRAME_BYTES = 1024 * 1024;

export interface DecodedGatewayTcpFrames {
	frames: Array<unknown>;
	remainder: Buffer;
}

export function encodeGatewayTcpFrame(frame: unknown, maxFrameBytes = MAX_GATEWAY_TCP_FRAME_BYTES): Buffer {
	const payloadText = JSON.stringify(frame);
	const payload = Buffer.from(payloadText, 'utf8');
	if (payload.length > maxFrameBytes) {
		throw new Error('Gateway TCP frame exceeds maximum size');
	}
	const header = Buffer.from(`${payload.length}\n`, 'utf8');
	return Buffer.concat([header, payload]);
}

export function decodeGatewayTcpFrames(
	buffer: Buffer,
	maxFrameBytes = MAX_GATEWAY_TCP_FRAME_BYTES,
): DecodedGatewayTcpFrames {
	let offset = 0;
	const frames: Array<unknown> = [];

	while (offset < buffer.length) {
		const newlineIndex = buffer.indexOf(0x0a, offset);
		if (newlineIndex < 0) {
			break;
		}

		const lengthText = buffer.subarray(offset, newlineIndex).toString('utf8');
		const frameLength = Number.parseInt(lengthText, 10);
		if (!Number.isFinite(frameLength) || frameLength < 0 || frameLength > maxFrameBytes) {
			throw new Error('Invalid Gateway TCP frame length');
		}

		const payloadStart = newlineIndex + 1;
		const payloadEnd = payloadStart + frameLength;
		if (payloadEnd > buffer.length) {
			break;
		}

		const payload = buffer.subarray(payloadStart, payloadEnd).toString('utf8');
		let frame: unknown;
		try {
			frame = JSON.parse(payload);
		} catch {
			throw new Error('Invalid Gateway TCP frame JSON');
		}
		frames.push(frame);
		offset = payloadEnd;
	}

	return {
		frames,
		remainder: buffer.subarray(offset),
	};
}
