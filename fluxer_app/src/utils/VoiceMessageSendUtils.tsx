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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import {CloudUpload} from '@app/lib/CloudUpload';
import {Logger} from '@app/lib/Logger';
import {MessageRecord} from '@app/records/MessageRecord';
import UserStore from '@app/stores/UserStore';
import {MessageFlags, MessageStates, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';

const logger = new Logger('VoiceMessageSendUtils');

export interface SendVoiceMessageParams {
	channelId: string;
	file: File;
	waveform: string;
	duration: number;
	title?: string;
}

export async function sendVoiceMessage(params: SendVoiceMessageParams): Promise<void> {
	const {channelId, file, waveform, duration, title} = params;

	const [uploaded] = await CloudUpload.createAndStartUploads(channelId, [file]);
	uploaded.waveform = waveform;
	uploaded.duration = duration;
	uploaded.isVoiceMessage = true;

	const nonce = SnowflakeUtils.fromTimestamp(Date.now());
	CloudUpload.claimAttachmentsForMessage(channelId, nonce, [uploaded], {
		content: '',
		flags: MessageFlags.VOICE_MESSAGE,
	});

	const currentUser = UserStore.getCurrentUser();
	if (!currentUser) {
		throw new Error('Current user missing');
	}

	const uploadingAttachment = {
		id: 'uploading',
		filename: file.name,
		title: title ?? file.name,
		size: file.size,
		url: '',
		proxy_url: '',
		content_type: file.type,
		flags: 0x1000,
	};

	const message = new MessageRecord({
		id: nonce,
		channel_id: channelId,
		author: currentUser.toJSON(),
		type: MessageTypes.DEFAULT,
		flags: MessageFlags.VOICE_MESSAGE,
		pinned: false,
		mention_everyone: false,
		content: '',
		timestamp: new Date().toISOString(),
		mentions: [],
		state: MessageStates.SENDING,
		nonce,
		attachments: [uploadingAttachment],
	});

	MessageActionCreators.createOptimistic(channelId, {...message.toJSON(), attachments: [uploadingAttachment]});
	try {
		await MessageActionCreators.send(channelId, {
			content: '',
			nonce,
			hasAttachments: true,
			flags: MessageFlags.VOICE_MESSAGE,
		});
	} catch (error) {
		logger.error({error}, 'Failed to dispatch voice message');
		throw error;
	}
}
