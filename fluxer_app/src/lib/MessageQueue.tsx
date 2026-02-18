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

import * as DraftActionCreators from '@app/actions/DraftActionCreators';
import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as SlowmodeActionCreators from '@app/actions/SlowmodeActionCreators';
import {FeatureTemporarilyDisabledModal} from '@app/components/alerts/FeatureTemporarilyDisabledModal';
import {FileSizeTooLargeModal} from '@app/components/alerts/FileSizeTooLargeModal';
import {MessageEditFailedModal} from '@app/components/alerts/MessageEditFailedModal';
import {MessageEditTooQuickModal} from '@app/components/alerts/MessageEditTooQuickModal';
import {MessageSendFailedModal} from '@app/components/alerts/MessageSendFailedModal';
import {MessageSendTooQuickModal} from '@app/components/alerts/MessageSendTooQuickModal';
import {NSFWContentRejectedModal} from '@app/components/alerts/NSFWContentRejectedModal';
import {SlowmodeRateLimitedModal} from '@app/components/alerts/SlowmodeRateLimitedModal';
import {Endpoints} from '@app/Endpoints';
import i18n from '@app/I18n';
import {shouldUseChunkedUpload, uploadFileChunked} from '@app/lib/ChunkedUploadService';
import {CloudUpload} from '@app/lib/CloudUpload';
import http, {type HttpResponse} from '@app/lib/HttpClient';
import type {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import {Queue, type QueueEntry} from '@app/lib/Queue';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import {createSystemMessage} from '@app/utils/CommandUtils';
import {prepareAttachmentsForNonce} from '@app/utils/MessageAttachmentUtils';
import {
	type ApiAttachmentMetadata,
	buildMessageCreateRequest,
	type MessageCreateRequest,
	type MessageEditRequest,
} from '@app/utils/MessageRequestUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {
	AllowedMentions,
	Message,
	MessageReference,
	MessageStickerItem,
} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('MessageQueue');

const DEFAULT_MAX_SIZE = 5;
const DEV_MESSAGE_DELAY = 3000;

interface BaseMessagePayload {
	channelId: string;
}

interface SendMessagePayload extends BaseMessagePayload {
	type: 'send';
	nonce: string;
	content: string;
	hasAttachments?: boolean;
	allowedMentions?: AllowedMentions;
	messageReference?: MessageReference;
	flags?: number;
	favoriteMemeId?: string;
	stickers?: Array<MessageStickerItem>;
	tts?: boolean;
}

interface EditMessagePayload extends BaseMessagePayload {
	type: 'edit';
	messageId: string;
	content?: string;
	flags?: number;
}

export type MessageQueuePayload = SendMessagePayload | EditMessagePayload;

export interface RetryError {
	retryAfter?: number;
}

export interface ApiErrorBody {
	code?: number | string;
	retry_after?: number;
	message?: string;
}

const getApiErrorBody = (error: HttpError): ApiErrorBody | undefined => {
	return typeof error?.body === 'object' && error.body !== null ? (error.body as ApiErrorBody) : undefined;
};

function isSendPayload(payload: MessageQueuePayload): payload is SendMessagePayload {
	return payload.type === 'send';
}

function isEditPayload(payload: MessageQueuePayload): payload is EditMessagePayload {
	return payload.type === 'edit';
}

function isRateLimitError(error: HttpError): boolean {
	return error?.status === 429;
}

function isSlowmodeError(error: HttpError): boolean {
	return error?.status === 400 && getApiErrorBody(error)?.code === APIErrorCodes.SLOWMODE_RATE_LIMITED;
}

function isFeatureDisabledError(error: HttpError): boolean {
	return error?.status === 403 && getApiErrorBody(error)?.code === APIErrorCodes.FEATURE_TEMPORARILY_DISABLED;
}

function isExplicitContentError(error: HttpError): boolean {
	return getApiErrorBody(error)?.code === APIErrorCodes.EXPLICIT_CONTENT_CANNOT_BE_SENT;
}

function isFileTooLargeError(error: HttpError): boolean {
	return getApiErrorBody(error)?.code === APIErrorCodes.FILE_SIZE_TOO_LARGE;
}

function isDMRestrictedError(error: HttpError): boolean {
	return getApiErrorBody(error)?.code === APIErrorCodes.CANNOT_SEND_MESSAGES_TO_USER;
}

function getUnclaimedAccountErrorCode(error: HttpError): string | undefined {
	const code = getApiErrorBody(error)?.code;
	if (
		code === APIErrorCodes.UNCLAIMED_ACCOUNT_CANNOT_SEND_MESSAGES ||
		code === APIErrorCodes.UNCLAIMED_ACCOUNT_CANNOT_SEND_DIRECT_MESSAGES
	) {
		return code;
	}
	return undefined;
}

class MessageQueue extends Queue<MessageQueuePayload, HttpResponse<Message> | undefined> {
	private readonly maxSize: number;
	private readonly abortControllers = new Map<string, AbortController>();

	constructor(maxSize = DEFAULT_MAX_SIZE) {
		super({logger, defaultRetryAfter: 100});
		this.maxSize = maxSize;
	}

	isFull(): boolean {
		return this.queueLength >= this.maxSize;
	}

	drain(
		message: MessageQueuePayload,
		completed: (err: RetryError | null, result?: HttpResponse<Message>, error?: unknown) => void,
	): Promise<unknown> | undefined {
		if (isSendPayload(message)) {
			return this.handleSend(message, completed);
		} else if (isEditPayload(message)) {
			return this.handleEdit(message, completed);
		} else {
			logger.error('Unknown message type, completing with null');
			completed(null, undefined, new Error('Unknown message queue payload'));
			return undefined;
		}
	}

	cancelRequest(nonce: string): void {
		logger.info('Cancel message send:', nonce);
		const controller = this.abortControllers.get(nonce);
		controller?.abort();
		this.abortControllers.delete(nonce);
	}

	cancelPendingSendRequests(channelId: string): Array<SendMessagePayload> {
		const cancelled: Array<SendMessagePayload> = [];
		const remaining: Array<QueueEntry<MessageQueuePayload, HttpResponse<Message> | undefined>> = [];

		while (this.queue.length > 0) {
			const entry = this.queue.shift()!;

			if (isSendPayload(entry.message) && entry.message.channelId === channelId) {
				cancelled.push(entry.message);
				this.cancelRequest(entry.message.nonce);
			} else {
				remaining.push(entry);
			}
		}

		this.queue.push(...remaining);
		logger.info('Cancel pending send requests', cancelled.length);
		return cancelled;
	}

	private async handleSend(
		payload: SendMessagePayload,
		completed: (err: RetryError | null, result?: HttpResponse<Message>, error?: unknown) => void,
	): Promise<void> {
		const {channelId, nonce, hasAttachments} = payload;

		await this.applyDevDelay();

		if (DeveloperOptionsStore.forceFailMessageSends) {
			const forcedError = new Error('Forced message send failure');
			logger.error(`Failed to send message to channel ${channelId}:`, forcedError);
			this.handleSendError(channelId, nonce, forcedError as HttpError, i18n, payload.hasAttachments);
			completed(null, undefined, forcedError);
			return;
		}

		let attachments: Array<ApiAttachmentMetadata> | undefined;
		let files: Array<File> | undefined;

		if (hasAttachments) {
			const result = await prepareAttachmentsForNonce(nonce, payload.favoriteMemeId);
			attachments = result.attachments;
			files = result.files;
		}

		if (hasAttachments && files?.length && attachments?.length) {
			const abortController = new AbortController();
			this.abortControllers.set(nonce, abortController);

			try {
				const chunkedResult = await this.performChunkedUploads(
					channelId,
					nonce,
					files,
					attachments,
					abortController.signal,
				);
				files = chunkedResult.files;
				attachments = chunkedResult.attachments;
			} catch (error) {
				this.abortControllers.delete(nonce);
				const httpError = error as HttpError;
				logger.error(`Chunked upload failed for channel ${channelId}:`, error);
				this.handleSendError(channelId, nonce, httpError, i18n, payload.hasAttachments);
				completed(null, undefined, error);
				return;
			}

			this.abortControllers.delete(nonce);
		}

		const requestBody = buildMessageCreateRequest({
			content: payload.content,
			nonce,
			attachments,
			allowedMentions: payload.allowedMentions,
			messageReference: payload.messageReference,
			flags: payload.flags,
			favoriteMemeId: payload.favoriteMemeId,
			stickers: payload.stickers,
			tts: payload.tts,
		});

		logger.debug(`Sending message to channel ${channelId}`);

		const outcome = await this.attemptMessageSend(channelId, nonce, requestBody, files);

		if (outcome.status === 'success') {
			logger.debug(`Successfully sent message to channel ${channelId}`);

			if (hasAttachments) {
				CloudUpload.removeMessageUpload(nonce);
			}

			completed(null, outcome.response);
			return;
		}

		logger.error(`Failed to send message to channel ${channelId}:`, outcome.error);

		if (outcome.status === 'rateLimit') {
			this.handleSendRateLimit(outcome.error, completed);
		} else {
			this.handleSendError(channelId, nonce, outcome.error, i18n, payload.hasAttachments);
			completed(null, undefined, outcome.error);
		}
	}

	private async applyDevDelay(): Promise<void> {
		if (!DeveloperOptionsStore.slowMessageSend) return;

		logger.debug(`Slow message send enabled, delaying by ${DEV_MESSAGE_DELAY}ms`);
		await new Promise((resolve) => setTimeout(resolve, DEV_MESSAGE_DELAY));
	}

	private async sendMessageRequest(
		channelId: string,
		nonce: string,
		requestBody: MessageCreateRequest,
		files?: Array<File>,
	): Promise<HttpResponse<Message>> {
		const abortController = new AbortController();
		this.abortControllers.set(nonce, abortController);

		try {
			if (files?.length) {
				logger.debug('Sending message with multipart form data');
				return await this.sendMultipartMessage(channelId, requestBody, files, abortController.signal, nonce);
			}

			return await http.post<Message>({
				url: Endpoints.CHANNEL_MESSAGES(channelId),
				body: requestBody,
				signal: abortController.signal,
				rejectWithError: true,
			});
		} finally {
			this.abortControllers.delete(nonce);
		}
	}

	private async performChunkedUploads(
		channelId: string,
		nonce: string,
		files: Array<File>,
		attachments: Array<ApiAttachmentMetadata>,
		signal: AbortSignal,
	): Promise<{files: Array<File>; attachments: Array<ApiAttachmentMetadata>}> {
		const largeFileIndices = new Set<number>();

		for (let i = 0; i < files.length; i++) {
			if (shouldUseChunkedUpload(files[i])) {
				largeFileIndices.add(i);
			}
		}

		if (largeFileIndices.size === 0) {
			return {files, attachments};
		}

		const totalChunkedSize = Array.from(largeFileIndices).reduce((sum, i) => sum + files[i].size, 0);
		const totalOverallSize = files.reduce((sum, f) => sum + f.size, 0);
		const chunkedRatio = totalOverallSize > 0 ? totalChunkedSize / totalOverallSize : 0;
		const chunkedProgressWeight = chunkedRatio * 90;

		const perFileProgress = new Map<number, number>();
		for (const i of largeFileIndices) {
			perFileProgress.set(i, 0);
		}

		const updatedAttachments = [...attachments];

		await Promise.all(
			Array.from(largeFileIndices).map(async (fileIndex) => {
				const file = files[fileIndex];
				const result = await uploadFileChunked(
					channelId,
					file,
					(loaded, _total) => {
						perFileProgress.set(fileIndex, loaded);
						const totalLoaded = Array.from(perFileProgress.values()).reduce((s, v) => s + v, 0);
						const ratio = totalChunkedSize > 0 ? totalLoaded / totalChunkedSize : 0;
						const overallProgress = ratio * chunkedProgressWeight;
						CloudUpload.updateSendingProgress(nonce, overallProgress);
					},
					signal,
				);

				if (updatedAttachments[fileIndex]) {
					updatedAttachments[fileIndex] = {
						...updatedAttachments[fileIndex],
						uploaded_filename: result.upload_filename,
					};
				}
			}),
		);

		const inlineFiles: Array<File> = [];
		let inlineIndex = 0;
		const remappedAttachments = updatedAttachments.map((att, originalIndex) => {
			if (largeFileIndices.has(originalIndex)) {
				return att;
			}
			const newId = String(inlineIndex);
			inlineFiles.push(files[originalIndex]);
			inlineIndex++;
			return {...att, id: newId};
		});

		return {files: inlineFiles, attachments: remappedAttachments};
	}

	private async sendMultipartMessage(
		channelId: string,
		requestBody: MessageCreateRequest,
		files: Array<File>,
		signal: AbortSignal,
		nonce?: string,
	): Promise<HttpResponse<Message>> {
		const formData = new FormData();
		formData['append']('payload_json', JSON.stringify(requestBody));

		files.forEach((file, index) => {
			formData['append'](`files[${index}]`, file);
		});

		return http.post<Message>({
			url: Endpoints.CHANNEL_MESSAGES(channelId),
			body: formData,
			signal,
			rejectWithError: true,
			onRequestProgress: nonce
				? (event) => {
						if (event.lengthComputable && event.total > 0) {
							const progress = (event.loaded / event.total) * 100;
							CloudUpload.updateSendingProgress(nonce, progress);
						}
					}
				: undefined,
		});
	}

	private async attemptMessageSend(
		channelId: string,
		nonce: string,
		requestBody: MessageCreateRequest,
		files?: Array<File>,
	): Promise<
		| {status: 'success'; response: HttpResponse<Message>}
		| {status: 'rateLimit'; error: HttpError}
		| {status: 'failure'; error: HttpError}
	> {
		try {
			const response = await this.sendMessageRequest(channelId, nonce, requestBody, files);
			return {status: 'success', response};
		} catch (error) {
			return this.buildSendOutcome(error);
		}
	}

	private buildSendOutcome(
		error: unknown,
	): {status: 'rateLimit'; error: HttpError} | {status: 'failure'; error: HttpError} {
		const httpError = error as HttpError;

		if (isRateLimitError(httpError)) {
			return {status: 'rateLimit', error: httpError};
		}

		return {status: 'failure', error: httpError};
	}

	private handleSendRateLimit(
		error: HttpError,
		completed: (err: RetryError | null, result?: HttpResponse<Message>, error?: unknown) => void,
	): void {
		const retryAfterSeconds = getApiErrorBody(error)?.retry_after ?? 0;
		const retryAfterMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : undefined;

		completed({retryAfter: retryAfterMs}, undefined, error);

		this.handleRateLimitError(retryAfterSeconds);
	}

	private handleSendError(
		channelId: string,
		nonce: string,
		error: HttpError,
		i18n: I18n,
		hasAttachments?: boolean,
	): void {
		MessageActionCreators.sendError(channelId, nonce);

		if (hasAttachments) {
			this.restoreFailedMessage(channelId, nonce);
		}

		if (isDMRestrictedError(error)) {
			const systemMessage = createSystemMessage(
				channelId,
				i18n._(
					msg`Your message could not be delivered. This is usually because you don't share a community with the recipient or the recipient is only accepting direct messages from friends.`,
				),
			);
			MessageActionCreators.createOptimistic(channelId, systemMessage.toJSON());
			return;
		}

		const unclaimedErrorCode = getUnclaimedAccountErrorCode(error);
		if (unclaimedErrorCode) {
			const systemMessage = createSystemMessage(
				channelId,
				unclaimedErrorCode === APIErrorCodes.UNCLAIMED_ACCOUNT_CANNOT_SEND_DIRECT_MESSAGES
					? i18n._(msg`Your message could not be delivered. You need to claim your account to send direct messages.`)
					: i18n._(msg`Your message could not be delivered. You need to claim your account to send messages.`),
			);
			MessageActionCreators.createOptimistic(channelId, systemMessage.toJSON());
			return;
		}

		this.showErrorModal(error, channelId);
	}

	private restoreFailedMessage(channelId: string, nonce: string): void {
		const messageUpload = CloudUpload.getMessageUpload(nonce);

		CloudUpload.restoreAttachmentsToTextarea(nonce);

		const contentToRestore = messageUpload?.content ?? '';
		DraftActionCreators.createDraft(channelId, contentToRestore);

		if (messageUpload?.messageReference) {
			MessageActionCreators.startReply(
				channelId,
				messageUpload.messageReference.message_id,
				messageUpload.allowedMentions?.replied_user ?? true,
			);
		}

		MessageActionCreators.deleteOptimistic(channelId, nonce);
	}

	private showErrorModal(error: HttpError, channelId?: string): void {
		if (isSlowmodeError(error)) {
			const retryAfter = Math.ceil(getApiErrorBody(error)?.retry_after ?? 0);
			const timestamp = Date.now() - retryAfter * 1000;
			if (channelId) {
				SlowmodeActionCreators.updateSlowmodeTimestamp(channelId, timestamp);
			}
			ModalActionCreators.push(modal(() => <SlowmodeRateLimitedModal retryAfter={retryAfter} />));
		} else if (isFeatureDisabledError(error)) {
			ModalActionCreators.push(modal(() => <FeatureTemporarilyDisabledModal />));
		} else if (isExplicitContentError(error)) {
			ModalActionCreators.push(modal(() => <NSFWContentRejectedModal />));
		} else if (isFileTooLargeError(error)) {
			ModalActionCreators.push(modal(() => <FileSizeTooLargeModal />));
		} else {
			ModalActionCreators.push(modal(() => <MessageSendFailedModal />));
		}
	}

	private handleRateLimitError(retryAfter: number, onRetry?: () => void): void {
		ModalActionCreators.push(modal(() => <MessageSendTooQuickModal retryAfter={retryAfter} onRetry={onRetry} />));
	}

	private async handleEdit(
		payload: EditMessagePayload,
		completed: (err: RetryError | null, result?: HttpResponse<Message>, error?: unknown) => void,
	): Promise<void> {
		const {channelId, messageId, content, flags} = payload;

		const abortController = new AbortController();
		this.abortControllers.set(messageId, abortController);

		try {
			logger.debug(`Editing message ${messageId} in channel ${channelId}`);

			const body = this.buildEditRequestBody(content, flags);

			const response = await http.patch<Message>({
				url: Endpoints.CHANNEL_MESSAGE(channelId, messageId),
				body,
				signal: abortController.signal,
				rejectWithError: true,
			});

			logger.debug(`Successfully edited message ${messageId} in channel ${channelId}`);
			completed(null, response);
		} catch (error) {
			const httpError = error as HttpError;
			logger.error(`Failed to edit message ${messageId} in channel ${channelId}:`, error);

			if (isRateLimitError(httpError)) {
				this.handleEditRateLimit(httpError, completed);
			} else {
				this.showEditErrorModal(httpError);
				completed(null, undefined, httpError);
			}
		} finally {
			this.abortControllers.delete(messageId);
		}
	}

	private buildEditRequestBody(content?: string, flags?: number): MessageEditRequest {
		const body: MessageEditRequest = {};

		if (content !== undefined) {
			body.content = content;
		}

		if (flags !== undefined) {
			body.flags = flags;
		}

		return body;
	}

	private handleEditRateLimit(
		error: HttpError,
		completed: (err: RetryError | null, result?: HttpResponse<Message>, error?: unknown) => void,
	): void {
		const retryAfterSeconds = getApiErrorBody(error)?.retry_after ?? 0;
		const retryAfterMs = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : undefined;

		completed({retryAfter: retryAfterMs}, undefined, error);

		this.handleEditRateLimitError(retryAfterSeconds);
	}

	private showEditErrorModal(error: HttpError): void {
		if (isFeatureDisabledError(error)) {
			ModalActionCreators.push(modal(() => <FeatureTemporarilyDisabledModal />));
		} else {
			ModalActionCreators.push(modal(() => <MessageEditFailedModal />));
		}
	}

	private handleEditRateLimitError(retryAfter: number, onRetry?: () => void): void {
		ModalActionCreators.push(modal(() => <MessageEditTooQuickModal retryAfter={retryAfter} onRetry={onRetry} />));
	}
}

export default new MessageQueue();
