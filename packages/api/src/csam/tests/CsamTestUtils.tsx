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

import {randomUUID} from 'node:crypto';
import {createTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {
	CsamResourceType,
	CsamScanJobPayload,
	CsamScanJobStatus,
	CsamScanTarget,
	FrameSample,
	PhotoDnaMatchDetail,
	PhotoDnaMatchResult,
} from '@fluxer/api/src/csam/CsamTypes';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import type {ILogger} from '@fluxer/api/src/ILogger';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import {vi} from 'vitest';

export interface MockPhotoDnaConfig {
	shouldMatch: boolean;
	matchDistance?: number;
	matchSource?: string;
	violations?: Array<string>;
	matchId?: string;
}

export interface MockNcmecReport {
	timestamp: string;
	reportId: string;
	payload: Record<string, unknown>;
}

export interface MockNcmecUpload {
	timestamp: string;
	reportId: string;
	filename: string;
	size: number;
}

export interface CapturedJob {
	jobType: string;
	payload: CsamScanJobPayload;
	timestamp: Date;
}

export class MockWorkerService implements IWorkerService {
	private jobs: Array<CapturedJob> = [];

	reset(): void {
		this.jobs = [];
	}

	getCapturedJobs(): Array<CapturedJob> {
		return [...this.jobs];
	}

	async addJob(jobType: string, payload: unknown): Promise<void> {
		this.jobs.push({
			jobType,
			payload: payload as CsamScanJobPayload,
			timestamp: new Date(),
		});
	}

	async cancelJob(_jobId: string): Promise<boolean> {
		return false;
	}

	async retryDeadLetterJob(_jobId: string): Promise<boolean> {
		return false;
	}
}

export interface CsamTestContext {
	account: TestAccount;
	guild: GuildResponse;
	guildId: string;
	channelId: string;
}

export async function setupCsamTestContext(harness: ApiTestHarness): Promise<CsamTestContext> {
	const account = await createTestAccount(harness);
	await ensureSessionStarted(harness, account.token);

	const guild = await createGuild(harness, account.token, 'CSAM Test Guild');
	const channelId = guild.system_channel_id ?? guild.id;

	return {
		account,
		guild,
		guildId: guild.id,
		channelId,
	};
}

export function createMockScanTarget(options: {
	resourceType: CsamResourceType;
	channelId?: string;
	messageId?: string;
	guildId?: string;
	userId?: string;
	filename?: string;
	contentType?: string;
}): CsamScanTarget {
	const id = randomUUID();
	const filename = options.filename ?? 'test-file.png';

	return {
		bucket: 'test-cdn-bucket',
		key: `test/${id}/${filename}`,
		cdnUrl: `https://cdn.test.local/test/${id}`,
		filename,
		contentType: options.contentType ?? 'image/png',
		resourceType: options.resourceType,
		channelId: options.channelId ?? null,
		messageId: options.messageId ?? null,
		guildId: options.guildId ?? null,
		userId: options.userId ?? null,
	};
}

export function createMockJobPayload(options: {
	resourceType: CsamResourceType;
	channelId?: string | null;
	messageId?: string | null;
	guildId?: string | null;
	userId?: string | null;
	filename?: string;
	contentType?: string;
}): CsamScanJobPayload {
	const id = randomUUID();
	const filename = options.filename ?? 'test-file.png';

	return {
		jobId: randomUUID(),
		resourceType: options.resourceType,
		bucket: 'test-cdn-bucket',
		key: `test/${id}/${filename}`,
		cdnUrl: `https://cdn.test.local/test/${id}`,
		filename,
		contentType: options.contentType ?? 'image/png',
		channelId: options.channelId ?? null,
		messageId: options.messageId ?? null,
		guildId: options.guildId ?? null,
		userId: options.userId ?? null,
	};
}

export function createMockFrameSamples(count: number): Array<FrameSample> {
	return Array.from({length: count}, (_, i) => ({
		timestamp: i * 100,
		mimeType: 'image/jpeg',
		base64: Buffer.from(`mock-frame-data-${i}`).toString('base64'),
	}));
}

export function createMockMatchResult(options?: {
	isMatch?: boolean;
	trackingId?: string;
	matchDetails?: Array<PhotoDnaMatchDetail>;
}): PhotoDnaMatchResult {
	const isMatch = options?.isMatch ?? true;

	return {
		isMatch,
		trackingId: options?.trackingId ?? randomUUID(),
		matchDetails: isMatch
			? (options?.matchDetails ?? [
					{
						source: 'test-database',
						violations: ['CSAM'],
						matchDistance: 0.01,
						matchId: randomUUID(),
					},
				])
			: [],
		timestamp: new Date().toISOString(),
	};
}

export const CSAM_JOB_STATUSES: Record<string, CsamScanJobStatus> = {
	PENDING: 'pending',
	PROCESSING: 'processing',
	HASHING: 'hashing',
	MATCHED: 'matched',
	NO_MATCH: 'no_match',
	FAILED: 'failed',
};

export const TEST_FIXTURES = {
	PNG_1X1_TRANSPARENT: Buffer.from(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		'base64',
	),
	GIF_1X1_TRANSPARENT: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
	JPEG_1X1_RED: Buffer.from(
		'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
		'base64',
	),
};

export function loadTestFixture(type: 'png' | 'gif' | 'jpeg'): Buffer {
	if (type === 'png') {
		return TEST_FIXTURES.PNG_1X1_TRANSPARENT;
	}
	if (type === 'gif') {
		return TEST_FIXTURES.GIF_1X1_TRANSPARENT;
	}
	if (type === 'jpeg') {
		return TEST_FIXTURES.JPEG_1X1_RED;
	}
	throw new Error(`Unknown fixture type: ${type}`);
}

export function createNoopLogger(): ILogger {
	return {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		fatal: vi.fn(),
		child: () => createNoopLogger(),
	};
}

export function createMockGuildResponse(overrides?: Partial<GuildResponse>): GuildResponse {
	return {
		id: '999',
		name: 'Test Guild',
		icon: null,
		banner: null,
		banner_width: null,
		banner_height: null,
		splash: null,
		splash_width: null,
		splash_height: null,
		splash_card_alignment: 0,
		embed_splash: null,
		embed_splash_width: null,
		embed_splash_height: null,
		vanity_url_code: null,
		owner_id: '123',
		system_channel_id: null,
		system_channel_flags: 0,
		rules_channel_id: null,
		afk_channel_id: null,
		afk_timeout: 300,
		features: [],
		verification_level: 0,
		mfa_level: 0,
		nsfw_level: 0,
		explicit_content_filter: 0,
		default_message_notifications: 0,
		disabled_operations: 0,
		...overrides,
	};
}
