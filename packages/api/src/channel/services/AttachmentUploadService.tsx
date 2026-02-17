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

import type {AttachmentID, ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {UploadedAttachment} from '@fluxer/api/src/channel/AttachmentDTOs';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {AuthenticatedChannel} from '@fluxer/api/src/channel/services/AuthenticatedChannel';
import {
	getContentType,
	isMessageEmpty,
	isOperationDisabled,
	makeAttachmentCdnKey,
	makeAttachmentCdnUrl,
	purgeMessageAttachments as purgeMessageAttachmentsHelper,
} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Attachment} from '@fluxer/api/src/models/Attachment';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {recordAttachmentOperation, recordAttachmentUploadDuration} from '@fluxer/api/src/telemetry/MessageTelemetry';
import {withSpan} from '@fluxer/api/src/telemetry/Tracing';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import {ATTACHMENT_MAX_SIZE_NON_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {FileSizeTooLargeError} from '@fluxer/errors/src/domains/core/FileSizeTooLargeError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';

interface DeleteAttachmentParams {
	userId: UserID;
	channelId: ChannelID;
	messageId: MessageID;
	attachmentId: AttachmentID;
	requestCache: RequestCache;
}

interface UploadFormDataAttachmentsParams {
	userId: UserID;
	channelId: ChannelID;
	files: Array<{file: File; index: number}>;
	attachmentMetadata: Array<{id: number; filename: string}>;
	expiresAt?: Date;
}

export class AttachmentUploadService {
	constructor(
		private channelRepository: IChannelRepositoryAggregate,
		private userRepository: IUserRepository,
		private storageService: IStorageService,
		private purgeQueue: IPurgeQueue,
		private getChannelAuthenticated: (params: {userId: UserID; channelId: ChannelID}) => Promise<AuthenticatedChannel>,
		private ensureTextChannel: (channel: Channel) => void,
		private dispatchMessageUpdate: (params: {
			channel: Channel;
			message: Message;
			requestCache: RequestCache;
			currentUserId?: UserID;
		}) => Promise<void>,
		private deleteMessage: (params: {
			userId: UserID;
			channelId: ChannelID;
			messageId: MessageID;
			requestCache: RequestCache;
		}) => Promise<void>,
		private limitConfigService: LimitConfigService,
	) {}

	async uploadFormDataAttachments({
		userId,
		channelId,
		files,
		attachmentMetadata,
		expiresAt,
	}: UploadFormDataAttachmentsParams): Promise<Array<UploadedAttachment>> {
		return await withSpan(
			{
				name: 'fluxer.media.upload',
				attributes: {channel_id: channelId.toString()},
			},
			async () => this.performUploadFormDataAttachments({userId, channelId, files, attachmentMetadata, expiresAt}),
		);
	}

	private async performUploadFormDataAttachments({
		userId,
		channelId,
		files,
		attachmentMetadata,
		expiresAt,
	}: UploadFormDataAttachmentsParams): Promise<Array<UploadedAttachment>> {
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

		const hasFileExceedingLimit = files.some((entry) => entry.file.size > maxFileSize);
		if (hasFileExceedingLimit) {
			throw new FileSizeTooLargeError(maxFileSize);
		}

		const metadataMap = new Map(attachmentMetadata.map((m) => [m.id, m]));

		const uploadedAttachments = await Promise.all(
			files.map(async (fileWithIndex) => {
				const {file, index} = fileWithIndex;

				const metadata = metadataMap.get(index);
				if (!metadata) {
					throw new Error(`Internal error: metadata not found for file index ${index}`);
				}

				const filename = metadata.filename;
				const uploadKey = crypto.randomUUID();

				const arrayBuffer = await file.arrayBuffer();
				const body = new Uint8Array(arrayBuffer);

				const contentType = this.resolveContentType(file, filename);
				const startTime = Date.now();

				try {
					await this.storageService.uploadObject({
						bucket: Config.s3.buckets.uploads,
						key: uploadKey,
						body,
						contentType,
						expiresAt: expiresAt ?? undefined,
					});

					const durationMs = Date.now() - startTime;
					recordAttachmentOperation({
						operation: 'upload',
						contentType: file.type || 'unknown',
						status: 'success',
					});
					recordAttachmentUploadDuration({
						contentType: file.type || 'unknown',
						durationMs,
					});

					const uploaded: UploadedAttachment = {
						id: index,
						upload_filename: uploadKey,
						filename: filename,
						file_size: file.size,
						content_type: contentType,
					};

					return uploaded;
				} catch (error) {
					recordAttachmentOperation({
						operation: 'upload',
						contentType: file.type || 'unknown',
						status: 'error',
					});
					throw error;
				}
			}),
		);

		return uploadedAttachments;
	}

	async deleteAttachment({
		userId,
		channelId,
		messageId,
		attachmentId,
		requestCache,
	}: DeleteAttachmentParams): Promise<void> {
		return await withBusinessSpan(
			'fluxer.attachment.delete',
			'fluxer.attachments.deleted',
			{
				channel_id: channelId.toString(),
				attachment_id: attachmentId.toString(),
			},
			async () => {
				const {channel, guild} = await this.getChannelAuthenticated({userId, channelId});

				if (isOperationDisabled(guild, GuildOperations.SEND_MESSAGE)) {
					throw new FeatureTemporarilyDisabledError();
				}

				const message = await this.channelRepository.messages.getMessage(channelId, messageId);
				if (!message) {
					throw new UnknownMessageError();
				}

				if (message.authorId !== userId) {
					throw new MissingPermissionsError();
				}

				if (!message.attachments || message.attachments.length === 0) {
					throw new UnknownMessageError();
				}

				const attachment = message.attachments.find((a: Attachment) => a.id === attachmentId);
				if (!attachment) {
					throw new UnknownMessageError();
				}

				const isLastAttachment = message.attachments.length === 1;
				const willBeEmpty = isLastAttachment && isMessageEmpty(message, true);

				if (willBeEmpty) {
					await this.deleteMessage({
						userId,
						channelId,
						messageId,
						requestCache,
					});
					return;
				}

				const cdnKey = makeAttachmentCdnKey(message.channelId, attachment.id, attachment.filename);
				await this.storageService.deleteObject(Config.s3.buckets.cdn, cdnKey);

				if (Config.cloudflare.purgeEnabled) {
					const cdnUrl = makeAttachmentCdnUrl(message.channelId, attachment.id, attachment.filename);
					await this.purgeQueue.addUrls([cdnUrl]);
				}

				const updatedAttachments = message.attachments.filter((a: Attachment) => a.id !== attachmentId);
				const updatedRowData = {
					...message.toRow(),
					attachments:
						updatedAttachments.length > 0 ? updatedAttachments.map((a: Attachment) => a.toMessageAttachment()) : null,
				};

				const updatedMessage = await this.channelRepository.messages.upsertMessage(updatedRowData, message.toRow());
				await this.dispatchMessageUpdate({channel, message: updatedMessage, requestCache});
			},
		);
	}

	async purgeChannelAttachments(channel: Channel): Promise<void> {
		const batchSize = 100;
		let beforeMessageId: MessageID | undefined;

		while (true) {
			const messages = await this.channelRepository.messages.listMessages(channel.id, beforeMessageId, batchSize);

			if (messages.length === 0) {
				return;
			}

			await Promise.all(
				messages.map((message: Message) =>
					purgeMessageAttachmentsHelper(message, this.storageService, this.purgeQueue),
				),
			);

			if (messages.length < batchSize) {
				return;
			}

			beforeMessageId = messages[messages.length - 1].id;
		}
	}

	private resolveContentType(_file: File, normalizedFilename: string): string {
		return getContentType(normalizedFilename);
	}
}
