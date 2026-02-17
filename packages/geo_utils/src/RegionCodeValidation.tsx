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

const ASCII_UPPER_A = 65;
const ASCII_UPPER_Z = 90;
const REGION_CODE_LENGTH = 2;

function isAsciiUpperAlpha2(value: string): boolean {
	return (
		value.length === REGION_CODE_LENGTH &&
		value.charCodeAt(0) >= ASCII_UPPER_A &&
		value.charCodeAt(0) <= ASCII_UPPER_Z &&
		value.charCodeAt(1) >= ASCII_UPPER_A &&
		value.charCodeAt(1) <= ASCII_UPPER_Z
	);
}

export function normalizeRegionCode(regionCode: string): string | undefined {
	const trimmedRegionCode = regionCode.trim();
	if (trimmedRegionCode.length !== REGION_CODE_LENGTH) {
		return undefined;
	}

	const upperRegionCode = trimmedRegionCode.toUpperCase();
	if (!isAsciiUpperAlpha2(upperRegionCode)) {
		return undefined;
	}

	return upperRegionCode;
}

export function isRegionCode(value: string): boolean {
	return normalizeRegionCode(value) !== undefined;
}
