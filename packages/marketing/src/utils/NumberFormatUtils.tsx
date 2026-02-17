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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

export function formatNumber(value: number): string {
	const digits = Math.max(0, Math.trunc(value)).toString();
	return formatNumberDigits(digits);
}

function formatNumberDigits(digits: string): string {
	const len = digits.length;
	if (len <= 3) return digits;
	const headLength = len % 3 === 0 ? 3 : len % 3;
	const head = digits.slice(0, headLength);
	const tail = digits.slice(headLength);
	return `${head}${chunkDigits(tail)}`;
}

function chunkDigits(digits: string): string {
	if (digits.length <= 3) return digits;
	const head = digits.slice(0, 3);
	const tail = digits.slice(3);
	return `${head},${chunkDigits(tail)}`;
}
