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

import {decodeGatewayTcpFrames, encodeGatewayTcpFrame} from '@fluxer/api/src/infrastructure/GatewayTcpFrameCodec';
import {describe, expect, test} from 'vitest';

describe('GatewayTcpFrameCodec', () => {
	test('encodes and decodes a single frame', () => {
		const frame = {type: 'ping'};
		const encoded = encodeGatewayTcpFrame(frame);
		const decoded = decodeGatewayTcpFrames(encoded);
		expect(decoded.frames).toEqual([frame]);
		expect(decoded.remainder.length).toBe(0);
	});

	test('decodes multiple frames with trailing partial frame', () => {
		const frameA = {type: 'request', id: '1', method: 'process.node_stats', params: {}};
		const frameB = {type: 'pong'};
		const encodedA = encodeGatewayTcpFrame(frameA);
		const encodedB = encodeGatewayTcpFrame(frameB);
		const partial = Buffer.from('5\n{"ty', 'utf8');
		const combined = Buffer.concat([encodedA, encodedB, partial]);
		const decoded = decodeGatewayTcpFrames(combined);
		expect(decoded.frames).toEqual([frameA, frameB]);
		expect(decoded.remainder.equals(partial)).toBe(true);
	});

	test('throws on invalid frame length', () => {
		const invalid = Buffer.from('x\n{}', 'utf8');
		expect(() => decodeGatewayTcpFrames(invalid)).toThrow('Invalid Gateway TCP frame length');
	});
});
