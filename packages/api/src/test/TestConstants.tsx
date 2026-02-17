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

export const TEST_TIMEOUTS = {
	IMMEDIATE: 20,
	QUICK: 100,

	DEFAULT: 1000,
	MEDIUM: 2000,
	LONG: 5000,

	TICKET_EXPIRY_GRACE: 2000,
	COOLDOWN_WAIT: 31000,
	HARVEST_EXPIRY_BOUNDARY: 7000,

	MAX: 10000,
} as const;

export const TEST_CREDENTIALS = {
	STRONG_PASSWORD: 'a-strong-password',

	ALT_PASSWORD_1: 'AnotherStrongPassword123!',
	ALT_PASSWORD_2: 'SecurePass-2024!',

	WEAK_PASSWORD: 'weak',
	EMPTY_PASSWORD: '',
} as const;

export const TEST_USER_DATA = {
	DEFAULT_DATE_OF_BIRTH: '2000-01-01',

	DEFAULT_GLOBAL_NAME: 'Test User',
	REGISTER_GLOBAL_NAME: 'Register User',
	LOGIN_GLOBAL_NAME: 'Login Test User',

	EMAIL_DOMAIN: 'example.com',

	USERNAME_PREFIX: 'itest',
	EMAIL_PREFIX: 'integration',
} as const;

export const TEST_GUILD_DATA = {
	DEFAULT_NAME: 'Test Guild',
	VALIDATION_NAME: 'Operation Test Guild',
	SCHEDULING_NAME: 'sched-validation',
} as const;

export const TEST_CHANNEL_DATA = {
	DEFAULT_NAME: 'test',
	DEFAULT_NAME_ALT: 'general',
} as const;

export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,

	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,

	INTERNAL_SERVER_ERROR: 500,

	ACCEPTED: 202,
} as const;

export const SUCCESS_CODES = [200, 201, 204] as const;
export const CLIENT_ERROR_CODES = [400, 401, 403, 404, 409] as const;

export const EXPECTED_RESPONSES = {
	UNAUTHORIZED_OR_BAD_REQUEST: [400, 401] as const,
	SUCCESS_OR_NO_CONTENT: [200, 204] as const,

	DUPLICATE_EMAIL_OR_CONFLICT: [400, 409] as const,

	EMAIL_SENT: [200, 202, 204] as const,
} as const;

export const TEST_IDS = {
	NONEXISTENT_GUILD: '999999999999999999',
	NONEXISTENT_CHANNEL: '999999999999999999',
	NONEXISTENT_USER: '999999999999999999',
	NONEXISTENT_MESSAGE: '999999999999999999',
	NONEXISTENT_WEBHOOK: '999999999999999999',
} as const;

export const TEST_LIMITS = {
	SCHEDULED_MESSAGE_MAX_DAYS: 30,
	SCHEDULED_MESSAGE_MIN_DELAY_MS: 5 * 60 * 1000,
	SCHEDULED_MESSAGE_MAX_DELAY_MS: 31 * 24 * 60 * 60 * 1000,

	MFA_TICKET_SHORT_TTL: 1,
	MFA_TICKET_LONG_TTL: 300,

	PASSWORD_RESET_TOKEN_LENGTH: 64,
} as const;

export function generateTimestampedValue(prefix = 'test'): string {
	return `${prefix}-${Date.now()}`;
}

export function generateUniquePassword(): string {
	return `SecurePass-${Date.now()}!`;
}

export function generateTestEmail(prefix = 'test', domain = 'example.com'): string {
	return `${prefix}-${Date.now()}@${domain}`;
}

export function generateFutureTimestamp(minutesInFuture = 5): string {
	return new Date(Date.now() + minutesInFuture * 60 * 1000).toISOString();
}

export function generatePastTimestamp(hoursInPast = 1): string {
	return new Date(Date.now() - hoursInPast * 60 * 60 * 1000).toISOString();
}

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitImmediate(): Promise<void> {
	await wait(TEST_TIMEOUTS.IMMEDIATE);
}

export async function waitDefault(): Promise<void> {
	await wait(TEST_TIMEOUTS.DEFAULT);
}

export async function waitTicketExpiry(): Promise<void> {
	await wait(TEST_TIMEOUTS.TICKET_EXPIRY_GRACE);
}

export async function waitCooldown(): Promise<void> {
	await wait(TEST_TIMEOUTS.COOLDOWN_WAIT);
}

export function isSuccessCode(status: number): boolean {
	return status >= 200 && status < 300;
}

export function isClientErrorCode(status: number): boolean {
	return status >= 400 && status < 500;
}

export function isServerErrorCode(status: number): boolean {
	return status >= 500 && status < 600;
}

export function assertStatusCode(actual: number, expected: ReadonlyArray<number>, description?: string): void {
	if (!expected.includes(actual)) {
		const message = description
			? `${description}: Expected status ${expected.join(' or ')}, got ${actual}`
			: `Expected status ${expected.join(' or ')}, got ${actual}`;
		throw new Error(message);
	}
}
