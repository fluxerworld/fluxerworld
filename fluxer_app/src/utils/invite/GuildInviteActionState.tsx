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

import type {GuildRecord} from '@app/records/GuildRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import {isGuildInvite} from '@app/types/InviteTypes';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';

const normalizeFeatures = (features?: Iterable<string> | null): Array<string> => {
	if (!features) return [];
	if (Array.isArray(features)) return features;
	return Array.from(features);
};

export interface GuildInviteActionState {
	guildId: string | null;
	isMember: boolean;
	presenceCount: number;
	memberCount: number;
	isInvitesDisabled: boolean;
	features: Array<string>;
}

export enum GuildInvitePrimaryAction {
	JoinCommunity = 'join',
	GoToCommunity = 'go',
	InvitesDisabled = 'disabled',
}

export function getGuildInviteActionState(params: {
	invite?: Invite | null;
	guild?: GuildRecord | Guild | null;
}): GuildInviteActionState {
	const inviteGuild = params['invite'] && isGuildInvite(params['invite']) ? params['invite'].guild : null;
	const guildRecord = params['guild'] ?? inviteGuild ?? null;
	const guildId = guildRecord?.id ?? null;
	const currentUserId = AuthenticationStore.currentUserId;
	const isMember = Boolean(guildId && currentUserId && GuildMemberStore.getMember(guildId, currentUserId));
	const presenceCount =
		params['invite'] && isGuildInvite(params['invite']) ? (params['invite'].presence_count ?? 0) : 0;
	const memberCount = params['invite'] && isGuildInvite(params['invite']) ? (params['invite'].member_count ?? 0) : 0;
	const features = normalizeFeatures(guildRecord?.features ?? inviteGuild?.features);

	return {
		guildId,
		isMember,
		presenceCount,
		memberCount,
		features,
		isInvitesDisabled: features.includes(GuildFeatures.INVITES_DISABLED),
	};
}

export function getGuildInvitePrimaryAction(state: GuildInviteActionState): GuildInvitePrimaryAction {
	if (state.isInvitesDisabled && !state.isMember) {
		return GuildInvitePrimaryAction.InvitesDisabled;
	}
	if (state.isMember) {
		return GuildInvitePrimaryAction.GoToCommunity;
	}
	return GuildInvitePrimaryAction.JoinCommunity;
}

export function isGuildInviteActionDisabled(state: GuildInviteActionState): boolean {
	return state.isInvitesDisabled && !state.isMember;
}
