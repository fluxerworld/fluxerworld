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

import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';

interface VoiceJoinEligibility {
	canJoin: boolean;
}

export function useVoiceJoinEligibility({
	guildId,
	channelId,
}: {
	guildId: string | null;
	channelId: string | null;
}): VoiceJoinEligibility {
	if (!channelId) return {canJoin: false};

	const channel = ChannelStore.getChannel(channelId);
	if (!channel) return {canJoin: false};

	const effectiveGuildId = guildId ?? channel.guildId ?? null;
	const currentUserId = AuthenticationStore.currentUserId;
	const currentUser = UserStore.getCurrentUser();
	const isUnclaimed = !(currentUser?.isClaimed() ?? false);

	if (effectiveGuildId && currentUserId) {
		const member = GuildMemberStore.getMember(effectiveGuildId, currentUserId);
		if (member?.isTimedOut()) return {canJoin: false};
	}

	if (isUnclaimed) {
		if (effectiveGuildId) {
			const guild = GuildStore.getGuild(effectiveGuildId);
			const isOwner = guild?.isOwner(currentUserId) ?? false;
			if (!isOwner) return {canJoin: false};
		} else if (channel.type === ChannelTypes.DM) {
			return {canJoin: false};
		}
	}

	if (effectiveGuildId && channel.userLimit && channel.userLimit > 0 && currentUserId) {
		const voiceStates = MediaEngineStore.getAllVoiceStatesInChannel(effectiveGuildId, channelId);
		const count = Object.keys(voiceStates).length;
		const already = Boolean(voiceStates[currentUserId]);
		const adjustedCount = already ? count - 1 : count;
		if (adjustedCount >= channel.userLimit) return {canJoin: false};
	}

	return {canJoin: true};
}
