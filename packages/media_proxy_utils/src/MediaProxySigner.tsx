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

import crypto from 'node:crypto';

const BASE64_URL_PADDING_REGEX = /=*$/;

export interface MediaProxySignerOptions {
	mediaProxySecretKey: string;
}

export interface IMediaProxySigner {
	createSignature(proxyUrlPath: string): string;
	verifySignature(proxyUrlPath: string, providedSignature: string): boolean;
}

class MediaProxySigner implements IMediaProxySigner {
	private readonly mediaProxySecretKey: string;

	constructor(options: MediaProxySignerOptions) {
		this.mediaProxySecretKey = options.mediaProxySecretKey;
	}

	createSignature(proxyUrlPath: string): string {
		const hmac = crypto.createHmac('sha256', this.mediaProxySecretKey);
		hmac.update(proxyUrlPath);
		return hmac.digest('base64url').replace(BASE64_URL_PADDING_REGEX, '');
	}

	verifySignature(proxyUrlPath: string, providedSignature: string): boolean {
		const expectedSignature = this.createSignature(proxyUrlPath);
		const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
		const providedBuffer = Buffer.from(providedSignature, 'utf8');

		if (expectedBuffer.length !== providedBuffer.length) {
			return false;
		}

		return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
	}
}

export function createMediaProxySigner(options: MediaProxySignerOptions): IMediaProxySigner {
	return new MediaProxySigner(options);
}
