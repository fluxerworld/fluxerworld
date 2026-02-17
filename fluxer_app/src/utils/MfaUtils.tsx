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

const TOTP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const getRandomBytes = (length = 20): Uint8Array => {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
};

const encodeTotpKey = (bytes: Uint8Array): string => {
	let bits = 0;
	let value = 0;
	let output = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += TOTP_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) {
		output += TOTP_ALPHABET[(value << (5 - bits)) & 31];
	}
	return output;
};

export function generateTotpSecret() {
	return encodeTotpKey(getRandomBytes());
}

export function encodeTotpSecret(secret: string) {
	return secret.replace(/[\s._-]+/g, '').toUpperCase();
}

export function encodeTotpSecretAsURL(accountName: string, secret: string, issuer = 'Fluxer') {
	const url = new URL('otpauth://totp');
	url.pathname = `/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
	url.searchParams.set('secret', encodeTotpSecret(secret));
	url.searchParams.set('issuer', issuer);
	return url.toString();
}
