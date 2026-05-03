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

import {
	buildDecryptedContent,
	getSentPlaintext,
	pairEnvelopeAttachments,
	recordAttachmentKeys,
	recordMessageVerification,
	tryDecryptForCurrentDevice,
} from '@app/lib/e2ee/E2EEMessageIntegration';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallStateStore from '@app/stores/CallStateStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import MessageReferenceStore from '@app/stores/MessageReferenceStore';
import MessageStore from '@app/stores/MessageStore';
import NotificationStore from '@app/stores/NotificationStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import TypingStore from '@app/stores/TypingStore';
import TtsUtils from '@app/utils/TtsUtils';
import {MessageFlags} from '@fluxer/constants/src/ChannelConstants';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

export function handleMessageCreate(data: Message, _context: GatewayHandlerContext): void {
	if (data.guild_id && data.member) {
		GuildMemberStore.handleMemberAdd(data.guild_id, {
			...data.member,
			user: data.author,
		} as GuildMemberData);
	}

	if (data.mentions && data.guild_id) {
		for (const mention of data.mentions) {
			if (mention.member) {
				GuildMemberStore.handleMemberAdd(data.guild_id, {
					...mention.member,
					user: mention,
				} as GuildMemberData);
			}
		}
	}

	TypingStore.stopTypingOnMessageCreate(data);

	const isEncrypted = ((data.flags ?? 0) & MessageFlags.ENCRYPTED) !== 0;
	if (isEncrypted && data.encrypted_payload) {
		// Surface a placeholder immediately so the bubble appears in chat,
		// then swap in the decrypted text once Olm finishes. Failures stay
		// on the placeholder text so the user knows something arrived but
		// couldn't be decrypted on this device (lost session, wrong device,
		// etc.).
		const placeholder: Message = {...data, content: ''};
		MessageStore.handleIncomingMessage({channelId: data.channel_id, message: placeholder});

		void (async () => {
			const currentUserId = AuthenticationStore.currentUserId;
			const senderUserId = data.author?.id;
			if (!currentUserId || !senderUserId) return;
			const result = await tryDecryptForCurrentDevice(currentUserId, senderUserId, data.encrypted_payload);
			if (result?.attachments.length && data.attachments?.length) {
				recordAttachmentKeys(data.id, pairEnvelopeAttachments(data.attachments, result.attachments));
			}
			if (result) {
				recordMessageVerification(data.id, result.verificationStatus);
			}
			// Sender's own gateway echo: we never put a ciphertext slot for
			// our own device, so decrypt returns null. Substitute the
			// plaintext we cached at send-time so we don't show our own
			// message as un-decryptable.
			let content = buildDecryptedContent(result);
			if (!result && senderUserId === currentUserId) {
				const cached = getSentPlaintext(data.id);
				if (cached !== null) content = cached;
			}
			const decryptedMessage: Message = {
				...data,
				content,
			};
			MessageStore.handleIncomingMessage({channelId: data.channel_id, message: decryptedMessage});
		})();
	} else {
		MessageStore.handleIncomingMessage({channelId: data.channel_id, message: data});
	}

	MessageReferenceStore.handleMessageCreate(data, false);
	NotificationStore.handleMessageCreate({message: data});
	ReadStateStore.handleIncomingMessage({channelId: data.channel_id, message: data});
	GuildReadStateStore.handleGenericUpdate(data.channel_id);
	RecentMentionsStore.handleMessageCreate(data);
	TtsUtils.handleIncomingTtsMessage(data);
	if (data.call && data.channel_id) {
		CallStateStore.handleCallParticipants(data.channel_id, [...data.call.participants]);
	}
}
