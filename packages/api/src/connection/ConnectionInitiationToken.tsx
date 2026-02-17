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

import {createHmac, timingSafeEqual} from 'node:crypto';
import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';

export interface ConnectionInitiationTokenPayload {
	userId: string;
	type: ConnectionType;
	identifier: string;
	verificationCode: string;
	expiresAt: number;
}

function computeSignature(payloadBase64: string, secret: string): Buffer {
	return createHmac('sha256', secret).update(payloadBase64).digest();
}

export function signInitiationToken(payload: ConnectionInitiationTokenPayload, secret: string): string {
	const payloadJson = JSON.stringify(payload);
	const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
	const signature = computeSignature(payloadBase64, secret).toString('base64url');
	return `${payloadBase64}.${signature}`;
}

export function verifyInitiationToken(token: string, secret: string): ConnectionInitiationTokenPayload | null {
	const dotIndex = token.indexOf('.');
	if (dotIndex === -1) {
		return null;
	}

	const payloadBase64 = token.slice(0, dotIndex);
	const signatureBase64 = token.slice(dotIndex + 1);

	const expectedSignature = computeSignature(payloadBase64, secret);

	let providedSignature: Buffer;
	try {
		providedSignature = Buffer.from(signatureBase64, 'base64url');
	} catch {
		return null;
	}

	if (expectedSignature.length !== providedSignature.length) {
		return null;
	}

	if (!timingSafeEqual(expectedSignature, providedSignature)) {
		return null;
	}

	let payload: ConnectionInitiationTokenPayload;
	try {
		const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
		payload = JSON.parse(payloadJson) as ConnectionInitiationTokenPayload;
	} catch {
		return null;
	}

	if (Date.now() > payload.expiresAt) {
		return null;
	}

	return payload;
}
