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

import GuildVerificationStore from '@app/stores/GuildVerificationStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import MessageStore from '@app/stores/MessageStore';
import PermissionStore from '@app/stores/PermissionStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import UserStore from '@app/stores/UserStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import type {User} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

interface UserUpdatePayload {
	id: string;
	username: string;
	discriminator: string;
	avatar: string | null;
	flags: number;
}

export function handleUserUpdate(data: UserUpdatePayload, _context: GatewayHandlerContext): void {
	UserStore.handleUserUpdate(data as User, {clearMissingOptionalFields: true});
	VoiceSettingsStore.handleUserUpdate(data);
	MessageStore.handleUserUpdate({user: {id: data.id}});
	PermissionStore.handleUserUpdate(data.id);
	QuickSwitcherStore.recomputeIfOpen();
	GuildVerificationStore.handleUserUpdate();
}
