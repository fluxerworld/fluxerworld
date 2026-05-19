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
import {
	getSentEnvelopeEntries,
	pairEnvelopeAttachments,
	recordAttachmentKeys,
	recordMessageVerification,
	resolveEncryptedMessageContent,
} from '@app/lib/e2ee/E2EEMessageIntegration';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallStateStore from '@app/stores/CallStateStore';
import ChannelStore from '@app/stores/ChannelStore';
import E2EEStore from '@app/stores/E2EEStore';
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
import {ChannelTypes, MessageFlags} from '@fluxer/constants/src/ChannelConstants';
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
	const isE2EEControl = ((data.flags ?? 0) & MessageFlags.E2EE_CONTROL) !== 0;

	// E2EE control envelopes carry no user-visible content. We never render
	// them: even if the decrypt path fails (forward-secret session lost,
	// peer rotated identity, etc.), the bubble must not show the
	// "could not be decrypted" placeholder. The flag is set by
	// `sendE2EEOffControl` on the wire; the server passes it through.
	if (isEncrypted && isE2EEControl && data.encrypted_payload) {
		const channel = ChannelStore.getChannel(data.channel_id);
		const isDM = channel?.type === ChannelTypes.DM;
		void (async () => {
			const currentUserId = AuthenticationStore.currentUserId;
			const senderUserId = data.author?.id;
			if (!currentUserId || !senderUserId) return;
			const fromPeer = senderUserId !== currentUserId;
			// Only the peer's control message drives our local toggle and
			// "AES-256 off" notice — the sender already flipped + emitted
			// locally when they clicked the toggle.
			if (!fromPeer || !isDM) return;
			const {result} = await resolveEncryptedMessageContent(
				data.id,
				data.nonce,
				currentUserId,
				senderUserId,
				data.encrypted_payload,
			);
			// Even on decrypt failure we treat the flagged message as an
			// off-control: it's a small, authenticated-by-flag-presence
			// signal, and getting the toggle wrong is worse than missing
			// the rare misdecrypt case.
			if (result && result.control !== 'e2ee_off') return;
			if (E2EEStore.isChannelEncrypted(data.channel_id)) {
				E2EEStore.setChannelEncrypted(data.channel_id, false);
				MessageActionCreators.emitE2EEStateMessage(data.channel_id, false);
			}
		})();
		return;
	}

	if (isEncrypted && data.encrypted_payload) {
		const channel = ChannelStore.getChannel(data.channel_id);
		const isDM = channel?.type === ChannelTypes.DM;

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
			const {content, result} = await resolveEncryptedMessageContent(
				data.id,
				data.nonce,
				currentUserId,
				senderUserId,
				data.encrypted_payload,
			);

			const fromPeer = senderUserId !== currentUserId;

			// Mirror the peer's per-DM toggle on receiving real encrypted
			// content: peer enabled E2EE, our toggle should match so the
			// next reply also goes encrypted. Deferred until after decrypt
			// so an off-control doesn't briefly toggle on first.
			if (isDM && fromPeer && !E2EEStore.isChannelEncrypted(data.channel_id)) {
				E2EEStore.setChannelEncrypted(data.channel_id, true);
				MessageActionCreators.emitE2EEStateMessage(data.channel_id, true);
			}

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
