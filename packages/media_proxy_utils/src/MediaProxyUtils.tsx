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
import {createExternalMediaProxyUrlBuilder} from '@fluxer/media_proxy_utils/src/ExternalMediaProxyUrlBuilder';

const BASE64_URL_REGEX = /=*$/;

export function createSignature(inputString: string, mediaProxySecretKey: string): string {
	const hmac = crypto.createHmac('sha256', mediaProxySecretKey);
	hmac.update(inputString);
	return hmac.digest('base64url').replace(BASE64_URL_REGEX, '');
}

export function verifySignature(proxyUrlPath: string, providedSignature: string, mediaProxySecretKey: string): boolean {
	const expectedSignature = createSignature(proxyUrlPath, mediaProxySecretKey);
	const expectedBuffer = Buffer.from(expectedSignature);
	const providedBuffer = Buffer.from(providedSignature);
	if (expectedBuffer.length !== providedBuffer.length) {
		return false;
	}
	return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export interface ExternalMediaProxyURLOptions {
	inputURL: string;
	mediaProxyEndpoint: string;
	mediaProxySecretKey: string;
}

export function getExternalMediaProxyURL(options: ExternalMediaProxyURLOptions): string {
	const builder = createExternalMediaProxyUrlBuilder({
		mediaProxyEndpoint: options.mediaProxyEndpoint,
		mediaProxySecretKey: options.mediaProxySecretKey,
	});

	return builder.buildExternalMediaProxyUrl(options.inputURL);
}
