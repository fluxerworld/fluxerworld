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

import type {ChannelID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {AuthenticatedChannel} from '@fluxer/api/src/channel/services/AuthenticatedChannel';
import {getContentType} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	ATTACHMENT_MAX_SIZE_NON_PREMIUM,
	CHUNKED_UPLOAD_CHUNK_SIZE,
	CHUNKED_UPLOAD_MAX_CHUNKS,
	CHUNKED_UPLOAD_SESSION_TTL_SECONDS,
} from '@fluxer/constants/src/LimitConstants';
import {ChunkedUploadChunkIndexOutOfRangeError} from '@fluxer/errors/src/domains/channel/ChunkedUploadChunkIndexOutOfRangeError';
import {ChunkedUploadIncompleteError} from '@fluxer/errors/src/domains/channel/ChunkedUploadIncompleteError';
import {ChunkedUploadNotFoundError} from '@fluxer/errors/src/domains/channel/ChunkedUploadNotFoundError';
import {ChunkedUploadNotOwnedError} from '@fluxer/errors/src/domains/channel/ChunkedUploadNotOwnedError';
import {FileSizeTooLargeError} from '@fluxer/errors/src/domains/core/FileSizeTooLargeError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import type {
	CompleteChunkedUploadRequest,
	CompleteChunkedUploadResponse,
	CreateChunkedUploadRequest,
	CreateChunkedUploadResponse,
	UploadChunkResponse,
} from '@fluxer/schema/src/domains/channel/ChunkedUploadSchemas';

interface ChunkedUploadSession {
	userId: string;
	channelId: string;
	s3UploadId: string;
	uploadFilename: string;
	filename: string;
	fileSize: number;
	chunkSize: number;
	chunkCount: number;
	contentType: string;
}

function sessionKey(uploadId: string): string {
	return `chunked_upload:${uploadId}`;
}

export class ChunkedUploadService {
	constructor(
		private storageService: IStorageService,
		private kvProvider: IKVProvider,
		private userRepository: IUserRepository,
		private limitConfigService: LimitConfigService,
		private getChannelAuthenticated: (params: {userId: UserID; channelId: ChannelID}) => Promise<AuthenticatedChannel>,
		private ensureTextChannel: (channel: Channel) => void,
	) {}

	async initiateUpload(
		userId: UserID,
		channelId: ChannelID,
		request: CreateChunkedUploadRequest,
	): Promise<CreateChunkedUploadResponse> {
		const {channel, guild, checkPermission} = await this.getChannelAuthenticated({userId, channelId});
		this.ensureTextChannel(channel);

		if (guild) {
			await checkPermission(Permissions.SEND_MESSAGES | Permissions.ATTACH_FILES);
		}

		const user = await this.userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}

		const fallbackMaxSize = ATTACHMENT_MAX_SIZE_NON_PREMIUM;
		const ctx = createLimitMatchContext({user, guildFeatures: guild?.features ?? null});
		const maxFileSize = resolveLimitSafe(
			this.limitConfigService.getConfigSnapshot(),
			ctx,
			'max_attachment_file_size',
			fallbackMaxSize,
		);

		if (request.file_size > maxFileSize) {
			throw new FileSizeTooLargeError(maxFileSize);
		}

		const chunkCount = Math.ceil(request.file_size / CHUNKED_UPLOAD_CHUNK_SIZE);
		if (chunkCount > CHUNKED_UPLOAD_MAX_CHUNKS) {
			throw new FileSizeTooLargeError(maxFileSize);
		}

		const uploadFilename = crypto.randomUUID();
		const contentType = getContentType(request.filename);

		const {uploadId: s3UploadId} = await this.storageService.createMultipartUpload({
			bucket: Config.s3.buckets.uploads,
			key: uploadFilename,
			contentType,
		});

		const uploadId = crypto.randomUUID();

		const session: ChunkedUploadSession = {
			userId: userId.toString(),
			channelId: channelId.toString(),
			s3UploadId,
			uploadFilename,
			filename: request.filename,
			fileSize: request.file_size,
			chunkSize: CHUNKED_UPLOAD_CHUNK_SIZE,
			chunkCount,
			contentType,
		};

		await this.kvProvider.setex(sessionKey(uploadId), CHUNKED_UPLOAD_SESSION_TTL_SECONDS, JSON.stringify(session));

		return {
			upload_id: uploadId,
			upload_filename: uploadFilename,
			chunk_size: CHUNKED_UPLOAD_CHUNK_SIZE,
			chunk_count: chunkCount,
		};
	}

	async uploadChunk(
		userId: UserID,
		uploadId: string,
		chunkIndex: number,
		body: Uint8Array,
	): Promise<UploadChunkResponse> {
		const session = await this.getSession(uploadId);
		this.verifyOwnership(session, userId);

		if (chunkIndex < 0 || chunkIndex >= session.chunkCount) {
			throw new ChunkedUploadChunkIndexOutOfRangeError();
		}

		const {etag} = await this.storageService.uploadPart({
			bucket: Config.s3.buckets.uploads,
			key: session.uploadFilename,
			uploadId: session.s3UploadId,
			partNumber: chunkIndex + 1,
			body,
		});

		return {etag};
	}

	async completeUpload(
		userId: UserID,
		uploadId: string,
		request: CompleteChunkedUploadRequest,
	): Promise<CompleteChunkedUploadResponse> {
		const session = await this.getSession(uploadId);
		this.verifyOwnership(session, userId);

		if (request.etags.length !== session.chunkCount) {
			throw new ChunkedUploadIncompleteError();
		}

		const seenIndices = new Set<number>();
		for (const entry of request.etags) {
			if (entry.chunk_index < 0 || entry.chunk_index >= session.chunkCount) {
				throw new ChunkedUploadChunkIndexOutOfRangeError();
			}
			if (seenIndices.has(entry.chunk_index)) {
				throw new ChunkedUploadIncompleteError();
			}
			seenIndices.add(entry.chunk_index);
		}

		const parts = request.etags.map((entry) => ({
			partNumber: entry.chunk_index + 1,
			etag: entry.etag,
		}));

		await this.storageService.completeMultipartUpload({
			bucket: Config.s3.buckets.uploads,
			key: session.uploadFilename,
			uploadId: session.s3UploadId,
			parts,
		});

		await this.kvProvider.del(sessionKey(uploadId));

		return {
			upload_filename: session.uploadFilename,
			file_size: session.fileSize,
			content_type: session.contentType,
		};
	}

	private async getSession(uploadId: string): Promise<ChunkedUploadSession> {
		const raw = await this.kvProvider.get(sessionKey(uploadId));
		if (!raw) {
			throw new ChunkedUploadNotFoundError();
		}
		return JSON.parse(raw) as ChunkedUploadSession;
	}

	private verifyOwnership(session: ChunkedUploadSession, userId: UserID): void {
		if (session.userId !== userId.toString()) {
			throw new ChunkedUploadNotOwnedError();
		}
	}
}
