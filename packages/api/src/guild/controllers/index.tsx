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

import {GuildAuditLogController} from '@fluxer/api/src/guild/controllers/GuildAuditLogController';
import {GuildBaseController} from '@fluxer/api/src/guild/controllers/GuildBaseController';
import {GuildChannelController} from '@fluxer/api/src/guild/controllers/GuildChannelController';
import {GuildDiscoveryController} from '@fluxer/api/src/guild/controllers/GuildDiscoveryController';
import {GuildEmojiController} from '@fluxer/api/src/guild/controllers/GuildEmojiController';
import {GuildMemberController} from '@fluxer/api/src/guild/controllers/GuildMemberController';
import {GuildMemberSearchController} from '@fluxer/api/src/guild/controllers/GuildMemberSearchController';
import {GuildRoleController} from '@fluxer/api/src/guild/controllers/GuildRoleController';
import {GuildStickerController} from '@fluxer/api/src/guild/controllers/GuildStickerController';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';

export function registerGuildControllers(app: HonoApp) {
	GuildBaseController(app);
	GuildMemberController(app);
	GuildMemberSearchController(app);
	GuildRoleController(app);
	GuildChannelController(app);
	GuildEmojiController(app);
	GuildStickerController(app);
	GuildAuditLogController(app);
	GuildDiscoveryController(app);
}
