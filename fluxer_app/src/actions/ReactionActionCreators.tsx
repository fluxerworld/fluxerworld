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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {FeatureTemporarilyDisabledModal} from '@app/components/alerts/FeatureTemporarilyDisabledModal';
import {TooManyReactionsModal} from '@app/components/alerts/TooManyReactionsModal';
import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import MessageStore from '@app/stores/MessageStore';
import {getApiErrorCode, getApiErrorRetryAfter} from '@app/utils/ApiErrorUtils';
import type {ReactionEmoji} from '@app/utils/ReactionUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {ME} from '@fluxer/constants/src/AppConstants';
import type {UserPartial} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const logger = new Logger('MessageReactions');

const MAX_RETRIES = 3;

const checkReactionResponse = (i18n: I18n, error: HttpError, retry: () => void): boolean => {
	const errorCode = getApiErrorCode(error);

	if (error.status === 403) {
		if (errorCode === APIErrorCodes.FEATURE_TEMPORARILY_DISABLED) {
			logger.debug('Feature temporarily disabled, not retrying');
			ModalActionCreators.push(modal(() => <FeatureTemporarilyDisabledModal />));
			return true;
		}
		if (errorCode === APIErrorCodes.COMMUNICATION_DISABLED) {
			logger.debug('Communication disabled while timed out, not retrying');
			ToastActionCreators.createToast({
				type: 'info',
				children: i18n._(msg`You can't add new reactions while you're on timeout.`),
			});
			return true;
		}
	}

	if (error.status === 429) {
		const retryAfter = getApiErrorRetryAfter(error) || 1000;
		logger.debug(`Rate limited, retrying after ${retryAfter}ms`);
		setTimeout(retry, retryAfter);
		return false;
	}

	if (error.status === 400) {
		switch (errorCode) {
			case APIErrorCodes.MAX_REACTIONS:
				logger.debug(`Reaction limit reached: ${errorCode}`);
				ModalActionCreators.push(modal(() => <TooManyReactionsModal />));
				break;
		}
	}

	return true;
};

const optimisticUpdate = (
	type:
		| 'MESSAGE_REACTION_ADD'
		| 'MESSAGE_REACTION_REMOVE'
		| 'MESSAGE_REACTION_REMOVE_ALL'
		| 'MESSAGE_REACTION_REMOVE_EMOJI',
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	userId?: string,
): void => {
	const actualUserId = userId ?? AuthenticationStore.currentUserId;

	if (!actualUserId) {
		logger.warn('Skipping optimistic reaction update because user ID is unavailable');
		return;
	}

	if (type === 'MESSAGE_REACTION_ADD') {
		MessageReactionsStore.handleReactionAdd(messageId, actualUserId, emoji);
	} else if (type === 'MESSAGE_REACTION_REMOVE') {
		MessageReactionsStore.handleReactionRemove(messageId, actualUserId, emoji);
	} else if (type === 'MESSAGE_REACTION_REMOVE_ALL') {
		MessageReactionsStore.handleReactionRemoveAll(messageId);
	} else if (type === 'MESSAGE_REACTION_REMOVE_EMOJI') {
		MessageReactionsStore.handleReactionRemoveEmoji(messageId, emoji);
	}

	if (type === 'MESSAGE_REACTION_ADD' || type === 'MESSAGE_REACTION_REMOVE') {
		MessageStore.handleReaction({
			type,
			channelId,
			messageId,
			userId: actualUserId,
			emoji,
			optimistic: true,
		});
	} else if (type === 'MESSAGE_REACTION_REMOVE_ALL') {
		MessageStore.handleRemoveAllReactions({channelId, messageId});
	} else if (type === 'MESSAGE_REACTION_REMOVE_EMOJI') {
		MessageStore.handleRemoveReactionEmoji({channelId, messageId, emoji});
	}

	logger.debug(
		`Optimistically applied ${type} for message ${messageId} ` +
			`with emoji ${emoji.name}${emoji.id ? `:${emoji.id}` : ''} by user ${actualUserId}`,
	);
};

const makeUrl = ({
	channelId,
	messageId,
	emoji,
	userId,
}: {
	channelId: string;
	messageId: string;
	emoji: ReactionEmoji;
	userId?: string;
}): string => {
	const emojiCode = encodeURIComponent(emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name);
	return userId
		? Endpoints.CHANNEL_MESSAGE_REACTION_QUERY(channelId, messageId, emojiCode, userId)
		: Endpoints.CHANNEL_MESSAGE_REACTION(channelId, messageId, emojiCode);
};

async function retryWithExponentialBackoff<T>(func: () => Promise<T>, attempts = 0): Promise<T> {
	const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

	try {
		return await func();
	} catch (error) {
		const status = error instanceof HttpError ? error.status : undefined;
		if (status !== 429) {
			throw error;
		}

		if (attempts < MAX_RETRIES) {
			const backoffTime = 2 ** attempts * 1000;
			logger.debug(`Rate limited, retrying in ${backoffTime}ms (attempt ${attempts + 1}/${MAX_RETRIES})`);
			await delay(backoffTime);
			return retryWithExponentialBackoff(func, attempts + 1);
		}

		logger.error(`Operation failed after ${MAX_RETRIES} attempts:`, error);
		throw error;
	}
}

const performReactionAction = (
	i18n: I18n,
	type: 'MESSAGE_REACTION_ADD' | 'MESSAGE_REACTION_REMOVE',
	apiFunc: () => Promise<unknown>,
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	userId?: string,
): void => {
	optimisticUpdate(type, channelId, messageId, emoji, userId);

	retryWithExponentialBackoff(apiFunc).catch((error) => {
		if (
			checkReactionResponse(i18n, error, () =>
				performReactionAction(i18n, type, apiFunc, channelId, messageId, emoji, userId),
			)
		) {
			logger.debug(`Reverting optimistic update for reaction in message ${messageId}`);
			optimisticUpdate(
				type === 'MESSAGE_REACTION_ADD' ? 'MESSAGE_REACTION_REMOVE' : 'MESSAGE_REACTION_ADD',
				channelId,
				messageId,
				emoji,
				userId,
			);
		}
	});
};

export async function getReactions(
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	limit?: number,
): Promise<Array<UserPartial>> {
	MessageReactionsStore.handleFetchPending(messageId, emoji);

	try {
		logger.debug(
			`Fetching reactions for message ${messageId} in channel ${channelId} with emoji ${emoji.name}${limit ? ` (limit: ${limit})` : ''}`,
		);

		const query: Record<string, number> = {};
		if (limit !== undefined) query['limit'] = limit;

		const response = await http.get<Array<UserPartial>>({
			url: makeUrl({channelId, messageId, emoji}),
			query: Object.keys(query).length > 0 ? query : undefined,
		});
		const data = response.body ?? [];
		MessageReactionsStore.handleFetchSuccess(messageId, data, emoji);

		logger.debug(`Retrieved ${data.length} reactions for message ${messageId}`);
		return data;
	} catch (error) {
		logger.error(`Failed to get reactions for message ${messageId}:`, error);
		MessageReactionsStore.handleFetchError(messageId, emoji);
		throw error;
	}
}

export function addReaction(i18n: I18n, channelId: string, messageId: string, emoji: ReactionEmoji): void {
	logger.debug(`Adding reaction ${emoji.name} to message ${messageId}`);

	const apiFunc = () =>
		http.put({
			url: makeUrl({channelId, messageId, emoji, userId: ME}),
			query: {session_id: GatewayConnectionStore.sessionId ?? null},
		});

	performReactionAction(i18n, 'MESSAGE_REACTION_ADD', apiFunc, channelId, messageId, emoji);
}

export function removeReaction(
	i18n: I18n,
	channelId: string,
	messageId: string,
	emoji: ReactionEmoji,
	userId?: string,
): void {
	logger.debug(`Removing reaction ${emoji.name} from message ${messageId}`);

	const apiFunc = () =>
		http.delete({
			url: makeUrl({channelId, messageId, emoji, userId: userId || ME}),
			query: {session_id: GatewayConnectionStore.sessionId ?? null},
		});

	performReactionAction(i18n, 'MESSAGE_REACTION_REMOVE', apiFunc, channelId, messageId, emoji, userId);
}

export function removeAllReactions(i18n: I18n, channelId: string, messageId: string): void {
	logger.debug(`Removing all reactions from message ${messageId} in channel ${channelId}`);

	const apiFunc = () =>
		http.delete({
			url: Endpoints.CHANNEL_MESSAGE_REACTIONS(channelId, messageId),
		});

	retryWithExponentialBackoff(apiFunc).catch((error) => {
		checkReactionResponse(i18n, error, () => removeAllReactions(i18n, channelId, messageId));
	});
}

export function removeReactionEmoji(i18n: I18n, channelId: string, messageId: string, emoji: ReactionEmoji): void {
	logger.debug(`Removing all ${emoji.name} reactions from message ${messageId} in channel ${channelId}`);

	optimisticUpdate('MESSAGE_REACTION_REMOVE_EMOJI', channelId, messageId, emoji);

	const apiFunc = () =>
		http.delete({
			url: makeUrl({channelId, messageId, emoji}),
		});

	retryWithExponentialBackoff(apiFunc).catch((error) => {
		checkReactionResponse(i18n, error, () => removeReactionEmoji(i18n, channelId, messageId, emoji));
	});
}
