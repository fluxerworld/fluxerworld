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
	getSentEnvelopeEntries,
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
			const result = await tryDecryptForCurrentDevice(
				currentUserId,
				senderUserId,
				data.encrypted_payload,
				data.channel_id,
			);
			if (result?.attachments.length && data.attachments?.length) {
				recordAttachmentKeys(data.id, pairEnvelopeAttachments(data.attachments, result.attachments));
			} else if (
				!result &&
				senderUserId === currentUserId &&
				data.attachments?.length &&
				data.nonce
			) {
				// Sender's own gateway echo: decrypt always returns null
				// because we don't include a ciphertext slot for our own
				// device. Pull the envelope entries we cached at send-time
				// so the renderer can still route this to the encrypted
				// bubble instead of treating ciphertext bytes as a
				// plaintext PDF/image.
				const sentEntries = getSentEnvelopeEntries(data.nonce);
				if (sentEntries && sentEntries.length > 0) {
					recordAttachmentKeys(data.id, pairEnvelopeAttachments(data.attachments, sentEntries));
				}
			}
			if (result) {
				recordMessageVerification(data.id, result.verificationStatus);
			}
			// Sender's own gateway echo: we never put a ciphertext slot for
			// our own device, so decrypt returns null. Substitute the
			// plaintext we cached at send-time so we don't show our own
			// message as un-decryptable. The cache may be keyed by nonce
			// (populated before the send) or by server id (populated after
			// the HTTP response), depending on whether the gateway beat
			// the response back to us.
			let content = buildDecryptedContent(result);
			if (!result && senderUserId === currentUserId) {
				const cached = getSentPlaintext(data.id) ?? (data.nonce ? getSentPlaintext(data.nonce) : null);
				if (cached !== null) content = cached;
			}
			const decryptedMessage: Message = {
				...data,
				content,
			};
			MessageStore.handleIncomingMessage({channelId: data.channel_id, message: decryptedMessage});
			// Fire the notification AFTER decrypt completes so the body uses
			// the plaintext instead of the empty string the server stores
			// for encrypted messages. Sender's own gateway echo still
			// triggers a notification because handleMessageCreate filters
			// own-author messages internally — we don't need to short-circuit
			// here.
			NotificationStore.handleMessageCreate({message: decryptedMessage});
		})();
	} else {
		MessageStore.handleIncomingMessage({channelId: data.channel_id, message: data});
		NotificationStore.handleMessageCreate({message: data});
	}

	MessageReferenceStore.handleMessageCreate(data, false);
	ReadStateStore.handleIncomingMessage({channelId: data.channel_id, message: data});
	GuildReadStateStore.handleGenericUpdate(data.channel_id);
	RecentMentionsStore.handleMessageCreate(data);
	TtsUtils.handleIncomingTtsMessage(data);
	if (data.call && data.channel_id) {
		CallStateStore.handleCallParticipants(data.channel_id, [...data.call.participants]);
	}
}
