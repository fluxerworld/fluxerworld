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

import type {TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createMultipartFormData, setupTestGuildAndChannel} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {CHUNKED_UPLOAD_CHUNK_SIZE} from '@fluxer/constants/src/LimitConstants';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {
	CompleteChunkedUploadResponse,
	CreateChunkedUploadResponse,
	UploadChunkResponse,
} from '@fluxer/schema/src/domains/channel/ChunkedUploadSchemas';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

let harness: ApiTestHarness;

beforeAll(async () => {
	harness = await createApiTestHarness();
});

beforeEach(async () => {
	await harness.reset();
});

afterAll(async () => {
	await harness?.shutdown();
});

async function initiateChunkedUpload(
	token: string,
	channelId: string,
	filename: string,
	fileSize: number,
): Promise<CreateChunkedUploadResponse> {
	return createBuilder<CreateChunkedUploadResponse>(harness, token)
		.post(`/channels/${channelId}/chunked-uploads`)
		.body({filename, file_size: fileSize})
		.expect(201)
		.execute();
}

async function uploadChunk(
	token: string,
	channelId: string,
	uploadId: string,
	chunkIndex: number,
	data: Buffer,
): Promise<UploadChunkResponse> {
	const response = await harness.app.request(
		`/channels/${channelId}/chunked-uploads/${uploadId}/chunks/${chunkIndex}`,
		{
			method: 'PUT',
			headers: new Headers({
				Authorization: token,
				'Content-Type': 'application/octet-stream',
				'x-forwarded-for': '127.0.0.1',
			}),
			body: data,
		},
	);

	expect(response.status).toBe(200);
	return (await response.json()) as UploadChunkResponse;
}

async function completeChunkedUpload(
	token: string,
	channelId: string,
	uploadId: string,
	etags: Array<{chunk_index: number; etag: string}>,
): Promise<CompleteChunkedUploadResponse> {
	return createBuilder<CompleteChunkedUploadResponse>(harness, token)
		.post(`/channels/${channelId}/chunked-uploads/${uploadId}/complete`)
		.body({etags})
		.execute();
}

describe('Chunked Uploads', () => {
	let account: TestAccount;
	let channel: ChannelResponse;

	beforeEach(async () => {
		const setup = await setupTestGuildAndChannel(harness);
		account = setup.account;
		channel = setup.channel;
	});

	describe('POST /channels/:channel_id/chunked-uploads', () => {
		it('should initiate a chunked upload session', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE * 2 + 100;
			const result = await initiateChunkedUpload(account.token, channel.id, 'large-file.bin', fileSize);

			expect(result.upload_id).toBeDefined();
			expect(result.upload_filename).toBeDefined();
			expect(result.chunk_size).toBe(CHUNKED_UPLOAD_CHUNK_SIZE);
			expect(result.chunk_count).toBe(3);
		});

		it('should reject when file size exceeds the limit', async () => {
			const hugeSize = 1024 * 1024 * 1024 * 10;
			await createBuilder(harness, account.token)
				.post(`/channels/${channel.id}/chunked-uploads`)
				.body({filename: 'huge.bin', file_size: hugeSize})
				.expect(400, APIErrorCodes.FILE_SIZE_TOO_LARGE)
				.execute();
		});

		it('should reject without authentication', async () => {
			await createBuilder(harness, '')
				.post(`/channels/${channel.id}/chunked-uploads`)
				.body({filename: 'file.bin', file_size: 1024})
				.expect(401)
				.execute();
		});
	});

	describe('PUT /channels/:channel_id/chunked-uploads/:upload_id/chunks/:chunk_index', () => {
		it('should upload a chunk and return an etag', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE + 100;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'test.bin', fileSize);

			const chunkData = Buffer.alloc(CHUNKED_UPLOAD_CHUNK_SIZE, 0xab);
			const result = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunkData);

			expect(result.etag).toBeDefined();
			expect(typeof result.etag).toBe('string');
		});

		it('should reject chunk index out of range', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE + 100;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'test.bin', fileSize);

			const chunkData = Buffer.alloc(100, 0xab);
			const response = await harness.app.request(
				`/channels/${channel.id}/chunked-uploads/${initResult.upload_id}/chunks/99`,
				{
					method: 'PUT',
					headers: new Headers({
						Authorization: account.token,
						'Content-Type': 'application/octet-stream',
						'x-forwarded-for': '127.0.0.1',
					}),
					body: chunkData,
				},
			);

			expect(response.status).toBe(400);
			const body = (await response.json()) as {code: string};
			expect(body.code).toBe(APIErrorCodes.CHUNKED_UPLOAD_CHUNK_INDEX_OUT_OF_RANGE);
		});

		it('should reject for non-existent upload session', async () => {
			const chunkData = Buffer.alloc(100, 0xab);
			const response = await harness.app.request(`/channels/${channel.id}/chunked-uploads/non-existent-id/chunks/0`, {
				method: 'PUT',
				headers: new Headers({
					Authorization: account.token,
					'Content-Type': 'application/octet-stream',
					'x-forwarded-for': '127.0.0.1',
				}),
				body: chunkData,
			});

			expect(response.status).toBe(404);
			const body = (await response.json()) as {code: string};
			expect(body.code).toBe(APIErrorCodes.CHUNKED_UPLOAD_NOT_FOUND);
		});
	});

	describe('POST /channels/:channel_id/chunked-uploads/:upload_id/complete', () => {
		it('should complete a chunked upload', async () => {
			const chunkSize = CHUNKED_UPLOAD_CHUNK_SIZE;
			const fileSize = chunkSize * 2;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'two-chunks.bin', fileSize);

			const chunk0 = Buffer.alloc(chunkSize, 0xaa);
			const chunk1 = Buffer.alloc(chunkSize, 0xbb);

			const etag0 = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunk0);
			const etag1 = await uploadChunk(account.token, channel.id, initResult.upload_id, 1, chunk1);

			const result = await completeChunkedUpload(account.token, channel.id, initResult.upload_id, [
				{chunk_index: 0, etag: etag0.etag},
				{chunk_index: 1, etag: etag1.etag},
			]);

			expect(result.upload_filename).toBe(initResult.upload_filename);
			expect(result.file_size).toBe(fileSize);
			expect(result.content_type).toBeDefined();
		});

		it('should reject when not all chunks have been provided', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE * 2;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'test.bin', fileSize);

			const chunk0 = Buffer.alloc(CHUNKED_UPLOAD_CHUNK_SIZE, 0xaa);
			const etag0 = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunk0);

			await createBuilder(harness, account.token)
				.post(`/channels/${channel.id}/chunked-uploads/${initResult.upload_id}/complete`)
				.body({etags: [{chunk_index: 0, etag: etag0.etag}]})
				.expect(400, APIErrorCodes.CHUNKED_UPLOAD_INCOMPLETE)
				.execute();
		});

		it('should reject duplicate chunk indices', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE * 2;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'test.bin', fileSize);

			const chunk0 = Buffer.alloc(CHUNKED_UPLOAD_CHUNK_SIZE, 0xaa);
			const etag0 = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunk0);

			await createBuilder(harness, account.token)
				.post(`/channels/${channel.id}/chunked-uploads/${initResult.upload_id}/complete`)
				.body({
					etags: [
						{chunk_index: 0, etag: etag0.etag},
						{chunk_index: 0, etag: etag0.etag},
					],
				})
				.expect(400, APIErrorCodes.CHUNKED_UPLOAD_INCOMPLETE)
				.execute();
		});
	});

	describe('Upload ownership', () => {
		it('should reject chunk upload from a different user', async () => {
			const fileSize = CHUNKED_UPLOAD_CHUNK_SIZE + 100;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'test.bin', fileSize);

			const otherSetup = await setupTestGuildAndChannel(harness);
			const otherAccount = otherSetup.account;

			const chunkData = Buffer.alloc(100, 0xab);
			const response = await harness.app.request(
				`/channels/${channel.id}/chunked-uploads/${initResult.upload_id}/chunks/0`,
				{
					method: 'PUT',
					headers: new Headers({
						Authorization: otherAccount.token,
						'Content-Type': 'application/octet-stream',
						'x-forwarded-for': '127.0.0.1',
					}),
					body: chunkData,
				},
			);

			expect(response.status).toBe(403);
			const body = (await response.json()) as {code: string};
			expect(body.code).toBe(APIErrorCodes.CHUNKED_UPLOAD_NOT_OWNED);
		});
	});

	describe('End-to-end: chunked upload + message send', () => {
		it('should send a message with a pre-uploaded file', async () => {
			const chunkSize = CHUNKED_UPLOAD_CHUNK_SIZE;
			const fileSize = chunkSize + 500;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'uploaded-file.txt', fileSize);

			const chunk0 = Buffer.alloc(chunkSize, 0x41);
			const chunk1 = Buffer.alloc(500, 0x42);

			const etag0 = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunk0);
			const etag1 = await uploadChunk(account.token, channel.id, initResult.upload_id, 1, chunk1);

			await completeChunkedUpload(account.token, channel.id, initResult.upload_id, [
				{chunk_index: 0, etag: etag0.etag},
				{chunk_index: 1, etag: etag1.etag},
			]);

			const payload = {
				content: 'Message with chunked upload',
				attachments: [
					{
						id: 0,
						filename: 'uploaded-file.txt',
						uploaded_filename: initResult.upload_filename,
					},
				],
			};

			const {body, contentType} = createMultipartFormData(payload, []);

			const mergedHeaders = new Headers();
			mergedHeaders.set('Content-Type', contentType);
			mergedHeaders.set('Authorization', account.token);
			mergedHeaders.set('x-forwarded-for', '127.0.0.1');

			const response = await harness.app.request(`/channels/${channel.id}/messages`, {
				method: 'POST',
				headers: mergedHeaders,
				body,
			});

			expect(response.status).toBe(200);
			const message = (await response.json()) as MessageResponse;
			expect(message.content).toBe('Message with chunked upload');
			expect(message.attachments).toBeDefined();
			expect(message.attachments!.length).toBe(1);
			expect(message.attachments![0].filename).toBe('uploaded-file.txt');
		});

		it('should send a message with both inline and pre-uploaded files', async () => {
			const chunkSize = CHUNKED_UPLOAD_CHUNK_SIZE;
			const fileSize = chunkSize + 100;
			const initResult = await initiateChunkedUpload(account.token, channel.id, 'large.bin', fileSize);

			const chunk0 = Buffer.alloc(chunkSize, 0xcc);
			const chunk1 = Buffer.alloc(100, 0xdd);

			const etag0 = await uploadChunk(account.token, channel.id, initResult.upload_id, 0, chunk0);
			const etag1 = await uploadChunk(account.token, channel.id, initResult.upload_id, 1, chunk1);

			await completeChunkedUpload(account.token, channel.id, initResult.upload_id, [
				{chunk_index: 0, etag: etag0.etag},
				{chunk_index: 1, etag: etag1.etag},
			]);

			const smallFileData = Buffer.from('small inline file content');
			const payload = {
				content: 'Mixed upload message',
				attachments: [
					{
						id: 0,
						filename: 'small.txt',
					},
					{
						id: 1,
						filename: 'large.bin',
						uploaded_filename: initResult.upload_filename,
					},
				],
			};

			const {response, json} = await sendMixedMessage(account.token, channel.id, payload, [
				{index: 0, filename: 'small.txt', data: smallFileData},
			]);

			expect(response.status).toBe(200);
			expect(json.content).toBe('Mixed upload message');
			expect(json.attachments).toBeDefined();
			expect(json.attachments!.length).toBe(2);
		});
	});
});

async function sendMixedMessage(
	token: string,
	channelId: string,
	payload: Record<string, unknown>,
	files: Array<{index: number; filename: string; data: Buffer}>,
): Promise<{response: Response; json: MessageResponse}> {
	const {body, contentType} = createMultipartFormData(payload, files);

	const mergedHeaders = new Headers();
	mergedHeaders.set('Content-Type', contentType);
	mergedHeaders.set('Authorization', token);
	mergedHeaders.set('x-forwarded-for', '127.0.0.1');

	const response = await harness.app.request(`/channels/${channelId}/messages`, {
		method: 'POST',
		headers: mergedHeaders,
		body,
	});

	const text = await response.text();
	let json: MessageResponse = undefined as unknown as MessageResponse;
	if (text.length > 0) {
		try {
			json = JSON.parse(text) as MessageResponse;
		} catch {}
	}

	return {response, json};
}
