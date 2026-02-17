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

import {PermissionStringType} from '@fluxer/schema/src/primitives/PermissionValidators';
import {Int32Type, SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildRoleResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this role'),
	name: z.string().describe('The name of the role'),
	color: Int32Type.describe('The colour of the role as an integer'),
	position: Int32Type.describe('The position of the role in the role hierarchy'),
	hoist_position: Int32Type.nullish().describe('The position of the role in the hoisted member list'),
	permissions: PermissionStringType.describe('fluxer:PermissionStringType The permissions bitfield for the role'),
	hoist: z.boolean().describe('Whether this role is displayed separately in the member list'),
	mentionable: z.boolean().describe('Whether this role can be mentioned by anyone'),
	unicode_emoji: z.string().nullish().describe('The unicode emoji for this role'),
});

export type GuildRoleResponse = z.infer<typeof GuildRoleResponse>;

export const GuildRoleListResponse = z.array(GuildRoleResponse).max(250).describe('A list of guild roles');
export type GuildRoleListResponse = z.infer<typeof GuildRoleListResponse>;

export interface GuildRole {
	readonly id: string;
	readonly name: string;
	readonly color: number;
	readonly position: number;
	readonly hoist_position?: number | null;
	readonly permissions: string;
	readonly hoist: boolean;
	readonly mentionable: boolean;
	readonly unicode_emoji?: string | null;
}
