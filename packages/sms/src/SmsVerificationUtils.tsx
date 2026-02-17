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
import {
	SMS_MASK_VISIBLE_PREFIX_LENGTH,
	SMS_VERIFICATION_CACHE_PREFIX,
	SMS_VERIFICATION_CODE_LENGTH,
	SMS_VERIFICATION_MESSAGE_TEMPLATE,
} from '@fluxer/constants/src/SmsVerificationConstants';

export function buildSmsVerificationCacheKey(phone: string): string {
	return `${SMS_VERIFICATION_CACHE_PREFIX}${phone}`;
}

export function generateSmsVerificationCode(): string {
	const maxCodeValue = 10 ** SMS_VERIFICATION_CODE_LENGTH;
	const value = crypto.randomInt(0, maxCodeValue);
	return value.toString().padStart(SMS_VERIFICATION_CODE_LENGTH, '0');
}

export function buildSmsVerificationMessage(code: string, ttlSeconds: number): string {
	const ttlMinutes = Math.max(1, Math.floor(ttlSeconds / 60));
	return SMS_VERIFICATION_MESSAGE_TEMPLATE.replace('{code}', code).replace('{minutes}', String(ttlMinutes));
}

export function timingSafeEqualStrings(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function maskPhoneNumber(phone: string): string {
	if (phone.length <= SMS_MASK_VISIBLE_PREFIX_LENGTH) {
		return `${phone}***`;
	}
	return `${phone.slice(0, SMS_MASK_VISIBLE_PREFIX_LENGTH)}***`;
}
