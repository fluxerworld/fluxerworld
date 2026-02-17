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

const RANDOM_STRING_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function randomString(length: number) {
	const alphabetLength = RANDOM_STRING_ALPHABET.length;
	const rangeSize = 256 - (256 % alphabetLength);
	const randomBytes = new Uint8Array(length * 2);
	crypto.getRandomValues(randomBytes);

	let result = '';
	let byteIndex = 0;

	while (result.length < length) {
		if (byteIndex >= randomBytes.length) {
			crypto.getRandomValues(randomBytes);
			byteIndex = 0;
		}

		const randomByte = randomBytes[byteIndex++];

		if (randomByte >= rangeSize) {
			continue;
		}

		result += RANDOM_STRING_ALPHABET.charAt(randomByte % alphabetLength);
	}

	return result;
}
