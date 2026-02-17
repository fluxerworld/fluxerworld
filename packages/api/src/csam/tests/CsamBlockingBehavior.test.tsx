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
import type {AttachmentToProcess} from '@fluxer/api/src/channel/AttachmentDTOs';
import {AttachmentProcessingService} from '@fluxer/api/src/channel/services/message/AttachmentProcessingService';
import {createDefaultLimitConfig} from '@fluxer/api/src/constants/LimitConfig';
import type {PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {ScanMediaParams} from '@fluxer/api/src/csam/SynchronousCsamScanner';
import {createMockGuildResponse, TEST_FIXTURES} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import {AvatarService} from '@fluxer/api/src/infrastructure/AvatarService';
import {EntityAssetService} from '@fluxer/api/src/infrastructure/EntityAssetService';
import type {Message} from '@fluxer/api/src/models/Message';
import {MockAssetDeletionQueue} from '@fluxer/api/src/test/mocks/MockAssetDeletionQueue';
import {MockCsamReportSnapshotService} from '@fluxer/api/src/test/mocks/MockCsamReportSnapshotService';
import {MockMediaService} from '@fluxer/api/src/test/mocks/MockMediaService';
import {MockSnowflakeService} from '@fluxer/api/src/test/mocks/MockSnowflakeService';
import {MockStorageService} from '@fluxer/api/src/test/mocks/MockStorageService';
import {MockSynchronousCsamScanner} from '@fluxer/api/src/test/mocks/MockSynchronousCsamScanner';
import {MockVirusScanService} from '@fluxer/api/src/test/mocks/MockVirusScanService';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ContentBlockedError} from '@fluxer/errors/src/domains/content/ContentBlockedError';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

function createMockMatchResult(options?: {trackingId?: string}): PhotoDnaMatchResult {
	return {
		isMatch: true,
		trackingId: options?.trackingId ?? randomUUID(),
		matchDetails: [
			{
				source: 'test-database',
				violations: ['CSAM'],
				matchDistance: 0.01,
				matchId: randomUUID(),
			},
		],
		timestamp: new Date().toISOString(),
	};
}

function createMockMessage(options?: {authorId?: bigint; channelId?: bigint; id?: bigint}): Message {
	return {
		id: options?.id ?? 1n,
		authorId: options?.authorId ?? 123n,
		channelId: options?.channelId ?? 456n,
	} as Message;
}

const TEST_LIMIT_CONFIG_SERVICE = {
	getConfigSnapshot() {
		return createDefaultLimitConfig({selfHosted: false});
	},
};

describe('CsamBlockingBehavior', () => {
	let storageService: MockStorageService;
	let mediaService: MockMediaService;
	let virusScanService: MockVirusScanService;
	let snowflakeService: MockSnowflakeService;
	let csamScanner: MockSynchronousCsamScanner;
	let csamReportService: MockCsamReportSnapshotService;
	let assetDeletionQueue: MockAssetDeletionQueue;

	beforeEach(() => {
		storageService = new MockStorageService();
		mediaService = new MockMediaService();
		virusScanService = new MockVirusScanService();
		snowflakeService = new MockSnowflakeService();
		csamScanner = new MockSynchronousCsamScanner();
		csamReportService = new MockCsamReportSnapshotService();
		assetDeletionQueue = new MockAssetDeletionQueue();
	});

	afterEach(() => {
		storageService.reset();
		csamScanner.reset();
		csamReportService.reset();
		assetDeletionQueue.reset();
		vi.clearAllMocks();
	});

	describe('AttachmentProcessingService', () => {
		let attachmentService: AttachmentProcessingService;

		beforeEach(async () => {
			await snowflakeService.initialize();
			attachmentService = new AttachmentProcessingService(
				storageService,
				mediaService,
				virusScanService,
				snowflakeService,
				csamScanner,
				csamReportService,
			);
		});

		describe('CSAM attachment blocking', () => {
			it('rejects CSAM attachment with ContentBlockedError', async () => {
				const uploadKey = `${randomUUID()}/test.png`;
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});

				csamScanner.configure({shouldMatch: true});

				const attachment: AttachmentToProcess = {
					id: 1,
					filename: 'test.png',
					upload_filename: uploadKey,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				};

				const message = createMockMessage({authorId: 123n, channelId: 456n, id: 789n});

				await expect(
					attachmentService.computeAttachments({
						message,
						attachments: [attachment],
						isNSFWAllowed: false,
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean attachment through', async () => {
				const uploadKey = `${randomUUID()}/clean.png`;
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});

				csamScanner.configure({shouldMatch: false});

				const attachment: AttachmentToProcess = {
					id: 1,
					filename: 'clean.png',
					upload_filename: uploadKey,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				};

				const message = createMockMessage();

				const result = await attachmentService.computeAttachments({
					message,
					attachments: [attachment],
					isNSFWAllowed: false,
				});

				expect(result.attachments).toHaveLength(1);
				expect(result.hasVirusDetected).toBe(false);
			});

			it('creates report snapshot when CSAM detected', async () => {
				const uploadKey = `${randomUUID()}/csam.png`;
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});

				const matchResult = createMockMatchResult({trackingId: 'test-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const attachment: AttachmentToProcess = {
					id: 1,
					filename: 'csam.png',
					upload_filename: uploadKey,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				};

				const message = createMockMessage({authorId: 123n, channelId: 456n, id: 789n});

				await expect(
					attachmentService.computeAttachments({
						message,
						attachments: [attachment],
						guild: createMockGuildResponse({id: '999'}),
						isNSFWAllowed: false,
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('attachment');
				expect(snapshots[0]!.params.userId).toBe('123');
				expect(snapshots[0]!.params.guildId).toBe('999');
				expect(snapshots[0]!.params.channelId).toBe('456');
				expect(snapshots[0]!.params.messageId).toBe('789');
				expect(snapshots[0]!.params.scanResult.trackingId).toBe('test-tracking-id');
			});

			it('rejects CSAM attachment even when match details are missing', async () => {
				const uploadKey = `${randomUUID()}/csam-no-details.png`;
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});

				csamScanner.configure({shouldMatch: true, omitMatchResult: true});

				const attachment: AttachmentToProcess = {
					id: 1,
					filename: 'csam-no-details.png',
					upload_filename: uploadKey,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				};

				const message = createMockMessage({authorId: 123n, channelId: 456n, id: 789n});

				await expect(
					attachmentService.computeAttachments({
						message,
						attachments: [attachment],
						isNSFWAllowed: false,
					}),
				).rejects.toThrow(ContentBlockedError);

				expect(csamReportService.getSnapshots()).toHaveLength(0);
			});

			it('does NOT copy content to CDN when CSAM detected', async () => {
				const uploadKey = `${randomUUID()}/csam.png`;
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});

				csamScanner.configure({shouldMatch: true});

				const attachment: AttachmentToProcess = {
					id: 1,
					filename: 'csam.png',
					upload_filename: uploadKey,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				};

				const message = createMockMessage();

				await expect(
					attachmentService.computeAttachments({
						message,
						attachments: [attachment],
						isNSFWAllowed: false,
					}),
				).rejects.toThrow(ContentBlockedError);

				const copiedObjects = storageService.getCopiedObjects();
				expect(copiedObjects).toHaveLength(0);
			});

			it('deletes all attachments from uploads bucket on CSAM detection', async () => {
				const uploadKey1 = `${randomUUID()}/attachment1.png`;
				const uploadKey2 = `${randomUUID()}/attachment2.png`;

				await storageService.uploadObject({
					bucket: '',
					key: uploadKey1,
					body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
					contentType: 'image/png',
				});
				await storageService.uploadObject({
					bucket: '',
					key: uploadKey2,
					body: TEST_FIXTURES.JPEG_1X1_RED,
					contentType: 'image/jpeg',
				});

				csamScanner.configure({shouldMatch: true});

				const attachments: Array<AttachmentToProcess> = [
					{
						id: 1,
						filename: 'attachment1.png',
						upload_filename: uploadKey1,
						title: null,
						description: null,
						flags: 0,
						file_size: 0,
						content_type: 'image/png',
					},
					{
						id: 2,
						filename: 'attachment2.png',
						upload_filename: uploadKey2,
						title: null,
						description: null,
						flags: 0,
						file_size: 0,
						content_type: 'image/jpeg',
					},
				];

				const message = createMockMessage();

				await expect(
					attachmentService.computeAttachments({
						message,
						attachments,
						isNSFWAllowed: false,
					}),
				).rejects.toThrow(ContentBlockedError);

				const deletedObjects = storageService.getDeletedObjects();
				expect(deletedObjects).toHaveLength(2);
				expect(deletedObjects.some((d) => d.key === uploadKey1)).toBe(true);
				expect(deletedObjects.some((d) => d.key === uploadKey2)).toBe(true);
			});
		});
	});

	describe('AvatarService', () => {
		let avatarService: AvatarService;

		beforeEach(() => {
			avatarService = new AvatarService(
				storageService,
				mediaService,
				TEST_LIMIT_CONFIG_SERVICE,
				csamScanner,
				csamReportService,
			);
		});

		describe('CSAM avatar blocking', () => {
			it('rejects CSAM avatar with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					avatarService.uploadAvatar({
						prefix: 'avatars',
						entityId: 123n,
						errorPath: 'avatar',
						base64Image,
						csamContext: {userId: '123'},
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean avatar upload', async () => {
				csamScanner.configure({shouldMatch: false});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				const result = await avatarService.uploadAvatar({
					prefix: 'avatars',
					entityId: 123n,
					errorPath: 'avatar',
					base64Image,
				});

				expect(result).not.toBeNull();
				expect(typeof result).toBe('string');
			});

			it('creates report snapshot when CSAM avatar detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'avatar-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					avatarService.uploadAvatar({
						prefix: 'avatars',
						entityId: 123n,
						errorPath: 'avatar',
						base64Image,
						csamContext: {userId: '456', guildId: '789'},
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('avatar');
				expect(snapshots[0]!.params.userId).toBe('456');
				expect(snapshots[0]!.params.guildId).toBe('789');
				expect(snapshots[0]!.params.scanResult.trackingId).toBe('avatar-tracking-id');
			});
		});

		describe('CSAM emoji blocking', () => {
			it('rejects CSAM emoji with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await expect(
					avatarService.uploadEmoji({
						prefix: 'emojis',
						emojiId: 123n,
						imageBuffer,
						contentType: 'image/png',
						csamContext: {guildId: '456'},
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean emoji upload', async () => {
				csamScanner.configure({shouldMatch: false});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await avatarService.uploadEmoji({
					prefix: 'emojis',
					emojiId: 123n,
					imageBuffer,
					contentType: 'image/png',
				});

				expect(storageService.hasObject('cdn', 'emojis/123')).toBe(true);
			});

			it('creates report snapshot when CSAM emoji detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'emoji-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await expect(
					avatarService.uploadEmoji({
						prefix: 'emojis',
						emojiId: 123n,
						imageBuffer,
						contentType: 'image/png',
						csamContext: {guildId: '456', userId: '789'},
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('emoji');
				expect(snapshots[0]!.params.guildId).toBe('456');
			});
		});

		describe('CSAM sticker blocking', () => {
			it('rejects CSAM sticker with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await expect(
					avatarService.uploadSticker({
						prefix: 'stickers',
						stickerId: 123n,
						imageBuffer,
						contentType: 'image/png',
						csamContext: {guildId: '456'},
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean sticker upload', async () => {
				csamScanner.configure({shouldMatch: false});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await avatarService.uploadSticker({
					prefix: 'stickers',
					stickerId: 123n,
					imageBuffer,
					contentType: 'image/png',
				});

				expect(storageService.hasObject('cdn', 'stickers/123')).toBe(true);
			});

			it('creates report snapshot when CSAM sticker detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'sticker-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const imageBuffer = new Uint8Array(TEST_FIXTURES.PNG_1X1_TRANSPARENT);

				await expect(
					avatarService.uploadSticker({
						prefix: 'stickers',
						stickerId: 123n,
						imageBuffer,
						contentType: 'image/png',
						csamContext: {guildId: '456'},
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('sticker');
			});
		});
	});

	describe('EntityAssetService', () => {
		let entityAssetService: EntityAssetService;

		beforeEach(() => {
			entityAssetService = new EntityAssetService(
				storageService,
				mediaService,
				assetDeletionQueue,
				TEST_LIMIT_CONFIG_SERVICE,
				csamScanner,
				csamReportService,
			);
		});

		afterEach(() => {
			entityAssetService.cleanup();
		});

		describe('CSAM banner blocking', () => {
			it('rejects CSAM banner with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'banner',
						entityType: 'user',
						entityId: 123n,
						previousHash: null,
						base64Image,
						errorPath: 'banner',
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean banner upload', async () => {
				csamScanner.configure({shouldMatch: false});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				const result = await entityAssetService.prepareAssetUpload({
					assetType: 'banner',
					entityType: 'user',
					entityId: 123n,
					previousHash: null,
					base64Image,
					errorPath: 'banner',
				});

				expect(result.newHash).not.toBeNull();
				expect(result._uploaded).toBe(true);
			});

			it('creates report snapshot when CSAM banner detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'banner-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'banner',
						entityType: 'user',
						entityId: 123n,
						previousHash: null,
						base64Image,
						errorPath: 'banner',
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('banner');
				expect(snapshots[0]!.params.userId).toBe('123');
				expect(snapshots[0]!.params.scanResult.trackingId).toBe('banner-tracking-id');
			});
		});

		describe('CSAM guild icon blocking', () => {
			it('rejects CSAM guild icon with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'icon',
						entityType: 'guild',
						entityId: 456n,
						previousHash: null,
						base64Image,
						errorPath: 'icon',
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('allows clean guild icon upload', async () => {
				csamScanner.configure({shouldMatch: false});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				const result = await entityAssetService.prepareAssetUpload({
					assetType: 'icon',
					entityType: 'guild',
					entityId: 456n,
					previousHash: null,
					base64Image,
					errorPath: 'icon',
				});

				expect(result.newHash).not.toBeNull();
				expect(result._uploaded).toBe(true);
			});

			it('creates report snapshot when CSAM guild icon detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'icon-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'icon',
						entityType: 'guild',
						entityId: 456n,
						previousHash: null,
						base64Image,
						errorPath: 'icon',
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('avatar');
				expect(snapshots[0]!.params.guildId).toBe('456');
			});
		});

		describe('CSAM splash blocking', () => {
			it('rejects CSAM splash with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'splash',
						entityType: 'guild',
						entityId: 789n,
						previousHash: null,
						base64Image,
						errorPath: 'splash',
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('creates report snapshot when CSAM splash detected', async () => {
				const matchResult = createMockMatchResult({trackingId: 'splash-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'splash',
						entityType: 'guild',
						entityId: 789n,
						previousHash: null,
						base64Image,
						errorPath: 'splash',
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('banner');
			});
		});

		describe('guild member avatar blocking', () => {
			it('rejects CSAM guild member avatar with ContentBlockedError', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'avatar',
						entityType: 'guild_member',
						entityId: 123n,
						guildId: 456n,
						previousHash: null,
						base64Image,
						errorPath: 'avatar',
					}),
				).rejects.toThrow(ContentBlockedError);
			});

			it('creates report snapshot with correct user and guild IDs for guild member avatar', async () => {
				const matchResult = createMockMatchResult({trackingId: 'member-avatar-tracking-id'});
				csamScanner.configure({shouldMatch: true, matchResult});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'avatar',
						entityType: 'guild_member',
						entityId: 123n,
						guildId: 456n,
						previousHash: null,
						base64Image,
						errorPath: 'avatar',
					}),
				).rejects.toThrow(ContentBlockedError);

				const snapshots = csamReportService.getSnapshots();
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]!.params.resourceType).toBe('avatar');
				expect(snapshots[0]!.params.userId).toBe('123');
				expect(snapshots[0]!.params.guildId).toBe('456');
			});
		});

		describe('does not upload when CSAM detected', () => {
			it('does not upload asset to S3 when CSAM detected', async () => {
				csamScanner.configure({shouldMatch: true});

				const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

				await expect(
					entityAssetService.prepareAssetUpload({
						assetType: 'avatar',
						entityType: 'user',
						entityId: 123n,
						previousHash: null,
						base64Image,
						errorPath: 'avatar',
					}),
				).rejects.toThrow(ContentBlockedError);

				expect(storageService.hasObject('cdn', 'avatars/123')).toBe(false);
			});
		});
	});

	describe('Error propagation', () => {
		it('ContentBlockedError has correct error code', () => {
			const error = new ContentBlockedError();
			expect(error.code).toBe(APIErrorCodes.CONTENT_BLOCKED);
		});

		it('ContentBlockedError is instance of ForbiddenError', async () => {
			const avatarService = new AvatarService(
				storageService,
				mediaService,
				TEST_LIMIT_CONFIG_SERVICE,
				csamScanner,
				csamReportService,
			);

			csamScanner.configure({shouldMatch: true});

			const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

			try {
				await avatarService.uploadAvatar({
					prefix: 'avatars',
					entityId: 123n,
					errorPath: 'avatar',
					base64Image,
				});
				expect.fail('Expected ContentBlockedError to be thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(ContentBlockedError);
				expect((error as ContentBlockedError).code).toBe(APIErrorCodes.CONTENT_BLOCKED);
			}
		});

		it('throws ContentBlockedError even when multiple attachments and only one is CSAM', async () => {
			await snowflakeService.initialize();
			const attachmentService = new AttachmentProcessingService(
				storageService,
				mediaService,
				virusScanService,
				snowflakeService,
				csamScanner,
				csamReportService,
			);

			const uploadKey1 = `${randomUUID()}/clean.png`;
			const uploadKey2 = `${randomUUID()}/csam.png`;

			await storageService.uploadObject({
				bucket: '',
				key: uploadKey1,
				body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
				contentType: 'image/png',
			});
			await storageService.uploadObject({
				bucket: '',
				key: uploadKey2,
				body: TEST_FIXTURES.JPEG_1X1_RED,
				contentType: 'image/jpeg',
			});

			let scanCallCount = 0;
			const originalScanMedia = csamScanner.scanMedia.bind(csamScanner);
			csamScanner.scanMedia = async (params: ScanMediaParams) => {
				scanCallCount++;
				if (scanCallCount === 2) {
					csamScanner.configure({shouldMatch: true});
				}
				return originalScanMedia(params);
			};

			const attachments: Array<AttachmentToProcess> = [
				{
					id: 1,
					filename: 'clean.png',
					upload_filename: uploadKey1,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/png',
				},
				{
					id: 2,
					filename: 'csam.png',
					upload_filename: uploadKey2,
					title: null,
					description: null,
					flags: 0,
					file_size: 0,
					content_type: 'image/jpeg',
				},
			];

			const message = createMockMessage();

			await expect(
				attachmentService.computeAttachments({
					message,
					attachments,
					isNSFWAllowed: false,
				}),
			).rejects.toThrow(ContentBlockedError);
		});
	});

	describe('Scanner disabled behavior', () => {
		it('allows all uploads when CSAM scanner is not provided to AttachmentProcessingService', async () => {
			await snowflakeService.initialize();
			const attachmentServiceNoScanner = new AttachmentProcessingService(
				storageService,
				mediaService,
				virusScanService,
				snowflakeService,
			);

			const uploadKey = `${randomUUID()}/test.png`;
			await storageService.uploadObject({
				bucket: '',
				key: uploadKey,
				body: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
				contentType: 'image/png',
			});

			const attachment: AttachmentToProcess = {
				id: 1,
				filename: 'test.png',
				upload_filename: uploadKey,
				title: null,
				description: null,
				flags: 0,
				file_size: 0,
				content_type: 'image/png',
			};

			const message = createMockMessage();

			const result = await attachmentServiceNoScanner.computeAttachments({
				message,
				attachments: [attachment],
				isNSFWAllowed: false,
			});

			expect(result.attachments).toHaveLength(1);
		});

		it('allows all uploads when CSAM scanner is not provided to AvatarService', async () => {
			const avatarServiceNoScanner = new AvatarService(storageService, mediaService, TEST_LIMIT_CONFIG_SERVICE);

			const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

			const result = await avatarServiceNoScanner.uploadAvatar({
				prefix: 'avatars',
				entityId: 123n,
				errorPath: 'avatar',
				base64Image,
			});

			expect(result).not.toBeNull();
		});

		it('allows all uploads when CSAM scanner is not provided to EntityAssetService', async () => {
			const entityAssetServiceNoScanner = new EntityAssetService(
				storageService,
				mediaService,
				assetDeletionQueue,
				TEST_LIMIT_CONFIG_SERVICE,
			);

			const base64Image = `data:image/png;base64,${TEST_FIXTURES.PNG_1X1_TRANSPARENT.toString('base64')}`;

			const result = await entityAssetServiceNoScanner.prepareAssetUpload({
				assetType: 'avatar',
				entityType: 'user',
				entityId: 123n,
				previousHash: null,
				base64Image,
				errorPath: 'avatar',
			});

			expect(result.newHash).not.toBeNull();
			entityAssetServiceNoScanner.cleanup();
		});
	});
});
