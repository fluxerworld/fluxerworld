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

import {createUserID} from '@fluxer/api/src/BrandedTypes';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {UserHarvestRepository} from '@fluxer/api/src/user/UserHarvestRepository';
import type {
	HarvestDownloadUrlResponse,
	HarvestStatusResponseSchema,
} from '@fluxer/schema/src/domains/user/UserHarvestSchemas';
import {expect} from 'vitest';
import type {z} from 'zod';

export type HarvestStatusResponse = z.infer<typeof HarvestStatusResponseSchema>;
export interface HarvestRequestResponse {
	harvest_id: string;
}

export async function requestHarvest(harness: ApiTestHarness, token: string): Promise<HarvestRequestResponse> {
	return createBuilder<HarvestRequestResponse>(harness, token).post('/users/@me/harvest').execute();
}

export async function fetchHarvestStatus(
	harness: ApiTestHarness,
	token: string,
	harvestId: string,
): Promise<HarvestStatusResponse> {
	return createBuilder<HarvestStatusResponse>(harness, token).get(`/users/@me/harvest/${harvestId}`).execute();
}

export async function fetchHarvestDownload(
	harness: ApiTestHarness,
	token: string,
	harvestId: string,
): Promise<HarvestDownloadUrlResponse> {
	return createBuilder<HarvestDownloadUrlResponse>(harness, token)
		.get(`/users/@me/harvest/${harvestId}/download`)
		.execute();
}

export async function setHarvestExpiration(
	harness: ApiTestHarness,
	userId: string,
	harvestId: string,
	expiresAt: string,
): Promise<void> {
	await createBuilderWithoutAuth<void>(harness)
		.post(`/test/users/${userId}/harvest/${harvestId}/set-expiration`)
		.body({expires_at: expiresAt})
		.execute();
}

export async function waitForHarvestCompletion(
	harness: ApiTestHarness,
	token: string,
	harvestId: string,
	timeoutMs = 90000,
	pollIntervalMs = 1000,
): Promise<HarvestStatusResponse> {
	const startTime = Date.now();
	while (Date.now() - startTime < timeoutMs) {
		const status = await fetchHarvestStatus(harness, token, harvestId);
		if (status.completed_at !== null && status.download_url_expires_at !== null) {
			return status;
		}
		if (status.failed_at !== null) {
			throw new Error(`Harvest failed: ${status.error_message ?? 'unknown error'}`);
		}
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
	throw new Error('Harvest did not complete within timeout');
}

export async function expectHarvestDownloadFailsWithError(
	harness: ApiTestHarness,
	token: string,
	harvestId: string,
	expectedCode: string,
): Promise<void> {
	const {json} = await createBuilder<Record<string, unknown>>(harness, token)
		.get(`/users/@me/harvest/${harvestId}/download`)
		.expect(400)
		.executeWithResponse();

	const errorResponse = json as {code: string; message: string};
	expect(errorResponse.code).toBe(expectedCode);
}

export async function markHarvestCompleted(userId: string, harvestId: string, expiresAt: Date): Promise<void> {
	const harvestRepository = new UserHarvestRepository();
	const userIdTyped = createUserID(BigInt(userId));
	const harvestIdTyped = BigInt(harvestId);
	await harvestRepository.markAsCompleted(userIdTyped, harvestIdTyped, `test/${harvestId}.zip`, 1024n, expiresAt);
}
