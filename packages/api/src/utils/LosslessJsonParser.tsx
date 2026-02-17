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

// json ids (snowflakes) are often emitted as unquoted numbers by older clients and bot libraries.
// in js, numbers above 2^53 - 1 lose integer precision, which breaks id validation and routing.
//
// this helper does a tiny pre-pass over the raw json text and wraps any *unsafe* integer literals in quotes
// before handing off to `JSON.parse`. that way, schema code can treat large ids as strings and stay lossless.
//
// this is intentionally not a full json parser; it only tokenises enough to avoid touching string contents.
const MAX_SAFE_INTEGER_DECIMAL = Number.MAX_SAFE_INTEGER.toString();

function isDigit(char: string): boolean {
	return char >= '0' && char <= '9';
}

function isValidJsonIntegerToken(token: string): boolean {
	// only plain integers (no decimals/exponents), and only if they'd be valid json numbers.
	// note: json doesn't allow leading zeros (except the literal "0").
	if (!/^-?\d+$/.test(token)) return false;
	if (token === '0' || token === '-0') return true;
	const digits = token[0] === '-' ? token.slice(1) : token;
	return digits.length > 0 && digits[0] !== '0';
}

function isUnsafeIntegerToken(token: string): boolean {
	// call this only for tokens that are already known to be valid json integers.
	// we compare as strings so we don't accidentally introduce precision loss here too.
	const digits = token[0] === '-' ? token.slice(1) : token;
	if (digits === '0') return false;

	if (digits.length < MAX_SAFE_INTEGER_DECIMAL.length) return false;
	if (digits.length > MAX_SAFE_INTEGER_DECIMAL.length) return true;
	return digits > MAX_SAFE_INTEGER_DECIMAL;
}

function coerceUnsafeIntegersToStrings(jsonText: string): string {
	let inString = false;
	let escaped = false;

	let i = 0;
	let lastCopyIndex = 0;
	let outputParts: Array<string> | null = null;

	// walk the json once, keeping track of whether we're inside a string literal.
	// we only consider number tokens when we're *not* in a string.
	while (i < jsonText.length) {
		const char = jsonText[i]!;

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
			i++;
			continue;
		}

		if (char === '"') {
			inString = true;
			i++;
			continue;
		}

		// detect a json number token start (only '-' or a digit are valid starts).
		if (char === '-' || isDigit(char)) {
			const start = i;
			i++;

			// consume the remainder of the number token.
			// we keep this permissive and rely on `JSON.parse` to reject anything that's not actually json.
			while (i < jsonText.length) {
				const c = jsonText[i]!;
				if (isDigit(c) || c === '.' || c === 'e' || c === 'E' || c === '+' || c === '-') {
					i++;
					continue;
				}
				break;
			}

			const token = jsonText.slice(start, i);
			if (isValidJsonIntegerToken(token) && isUnsafeIntegerToken(token)) {
				// lazily build an output buffer only if we actually find something to rewrite.
				// this keeps the common case (already-quoted ids) allocation-free.
				if (!outputParts) {
					outputParts = [];
				}
				outputParts.push(jsonText.slice(lastCopyIndex, start), `"${token}"`);
				lastCopyIndex = i;
			}
			continue;
		}

		i++;
	}

	if (!outputParts) {
		return jsonText;
	}

	outputParts.push(jsonText.slice(lastCopyIndex));
	return outputParts.join('');
}

export function parseJsonPreservingLargeIntegers(jsonText: string): unknown {
	const processed = coerceUnsafeIntegersToStrings(jsonText);
	return JSON.parse(processed) as unknown;
}
