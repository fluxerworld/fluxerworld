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

import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

const logger = new Logger('PrivateChannelActionCreators');

export async function create(userId: string) {
	try {
		const response = await http.post<Channel>({
			url: Endpoints.USER_CHANNELS,
			body: {recipient_id: userId},
		});
		const channel = response.body;
		return channel;
	} catch (error) {
		logger.error('Failed to create private channel:', error);
		throw error;
	}
}

export async function createGroupDM(recipientIds: Array<string>) {
	try {
		const response = await http.post<Channel>({
			url: Endpoints.USER_CHANNELS,
			body: {recipients: recipientIds},
		});
		const channel = response.body;
		return channel;
	} catch (error) {
		logger.error('Failed to create group DM:', error);
		throw error;
	}
}

export async function removeRecipient(channelId: string, userId: string) {
	try {
		await http.delete({
			url: Endpoints.CHANNEL_RECIPIENT(channelId, userId),
		});
	} catch (error) {
		logger.error('Failed to remove recipient:', error);
		throw error;
	}
}

export async function ensureDMChannel(userId: string): Promise<string> {
	try {
		const existingChannels = ChannelStore.dmChannels;
		const existingChannel = existingChannels.find(
			(channel) => channel.type === ChannelTypes.DM && channel.recipientIds.includes(userId),
		);

		if (existingChannel) {
			return existingChannel.id;
		}

		const channel = await create(userId);
		return channel.id;
	} catch (error) {
		logger.error('Failed to ensure DM channel:', error);
		throw error;
	}
}

export async function openDMChannel(userId: string): Promise<void> {
	try {
		const channelId = await ensureDMChannel(userId);
		NavigationActionCreators.selectChannel(ME, channelId);
	} catch (error) {
		logger.error('Failed to open DM channel:', error);
		throw error;
	}
}

export async function pinDmChannel(channelId: string): Promise<void> {
	try {
		await http.put({
			url: Endpoints.USER_CHANNEL_PIN(channelId),
		});
	} catch (error) {
		logger.error('Failed to pin DM channel:', error);
		throw error;
	}
}

export async function unpinDmChannel(channelId: string): Promise<void> {
	try {
		await http.delete({
			url: Endpoints.USER_CHANNEL_PIN(channelId),
		});
	} catch (error) {
		logger.error('Failed to unpin DM channel:', error);
		throw error;
	}
}

export async function addRecipient(channelId: string, userId: string): Promise<void> {
	try {
		await http.put({
			url: Endpoints.CHANNEL_RECIPIENT(channelId, userId),
		});
	} catch (error) {
		logger.error('Failed to add recipient:', error);
		throw error;
	}
}
