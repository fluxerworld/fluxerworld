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

import {InviteTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import type {GroupDmInvite, GuildInvite, Invite, PackInvite} from '@fluxer/schema/src/domains/invite/InviteSchemas';

export type InviteTypeValue = ValueOf<typeof InviteTypes>;

export type PackInviteType = typeof InviteTypes.EMOJI_PACK | typeof InviteTypes.STICKER_PACK;

export const isGuildInvite = (invite: Invite): invite is GuildInvite => invite.type === InviteTypes.GUILD;
export const isGroupDmInvite = (invite: Invite): invite is GroupDmInvite => invite.type === InviteTypes.GROUP_DM;
export const isPackInvite = (invite: Invite): invite is PackInvite =>
	invite.type === InviteTypes.EMOJI_PACK || invite.type === InviteTypes.STICKER_PACK;
