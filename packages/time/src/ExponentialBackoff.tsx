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

export interface ExponentialBackoffPolicy {
	baseSeconds: number;
	minimumSeconds: number;
	maximumSeconds: number;
	maxExponent: number;
}

export interface ExponentialBackoffInput {
	attemptCount: number;
	policy?: ExponentialBackoffPolicy;
}

export const DefaultExponentialBackoffPolicy: ExponentialBackoffPolicy = {
	baseSeconds: 1,
	minimumSeconds: 1,
	maximumSeconds: 600,
	maxExponent: 30,
};

function normalizeAttemptCount(attemptCount: number): number {
	if (!Number.isFinite(attemptCount)) {
		return 0;
	}

	return Math.max(0, Math.floor(attemptCount));
}

function validateExponentialBackoffPolicy(policy: ExponentialBackoffPolicy): void {
	if (!Number.isFinite(policy.baseSeconds) || policy.baseSeconds <= 0) {
		throw new Error(`Invalid exponential backoff baseSeconds: ${policy.baseSeconds}`);
	}

	if (!Number.isFinite(policy.minimumSeconds) || policy.minimumSeconds <= 0) {
		throw new Error(`Invalid exponential backoff minimumSeconds: ${policy.minimumSeconds}`);
	}

	if (!Number.isFinite(policy.maximumSeconds) || policy.maximumSeconds <= 0) {
		throw new Error(`Invalid exponential backoff maximumSeconds: ${policy.maximumSeconds}`);
	}

	if (policy.maximumSeconds < policy.minimumSeconds) {
		throw new Error(
			`Invalid exponential backoff policy: maximumSeconds(${policy.maximumSeconds}) is smaller than minimumSeconds(${policy.minimumSeconds})`,
		);
	}

	if (!Number.isFinite(policy.maxExponent) || policy.maxExponent < 0) {
		throw new Error(`Invalid exponential backoff maxExponent: ${policy.maxExponent}`);
	}
}

export function computeExponentialBackoffSeconds(input: ExponentialBackoffInput): number {
	const policy = input.policy ?? DefaultExponentialBackoffPolicy;
	validateExponentialBackoffPolicy(policy);

	const normalizedAttemptCount = normalizeAttemptCount(input.attemptCount);
	const exponent = Math.min(normalizedAttemptCount, Math.floor(policy.maxExponent));
	const backoffSeconds = policy.baseSeconds * 2 ** exponent;
	const cappedBackoffSeconds = Math.min(backoffSeconds, policy.maximumSeconds);

	return Math.max(cappedBackoffSeconds, policy.minimumSeconds);
}
