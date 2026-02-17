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

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VERIFICATION_CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export function formatVerificationCodeInput(raw: string): string {
	const cleaned = raw
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 8);
	if (cleaned.length <= 4) return cleaned;
	return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}

export function normalizeLikelyUrl(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return '';

	if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) {
		return `https://${trimmed}`;
	}

	return trimmed;
}

export function isValidHttpUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
