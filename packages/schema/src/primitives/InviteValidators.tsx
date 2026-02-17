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
import {createInt32EnumType, withOpenApiType} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const InviteTypeSchema = withOpenApiType(
	createInt32EnumType(
		[
			[InviteTypes.GUILD, 'GUILD', 'Invite to a guild'],
			[InviteTypes.GROUP_DM, 'GROUP_DM', 'Invite to a group DM'],
			[InviteTypes.EMOJI_PACK, 'EMOJI_PACK', 'Invite to an emoji pack'],
			[InviteTypes.STICKER_PACK, 'STICKER_PACK', 'Invite to a sticker pack'],
		],
		'The type of invite',
		'InviteType',
	),
	'InviteType',
);
