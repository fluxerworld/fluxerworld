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

import EmojiStore from '@app/stores/EmojiStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import GuildListStore from '@app/stores/GuildListStore';
import GuildStore from '@app/stores/GuildStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import NagbarStore from '@app/stores/NagbarStore';
import PermissionStore from '@app/stores/PermissionStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import StickerStore from '@app/stores/StickerStore';
import type {Guild} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

export function handleGuildUpdate(data: Guild, _context: GatewayHandlerContext): void {
	GuildAvailabilityStore.setGuildAvailable(data.id);
	GuildStore.handleGuildUpdate(data);

	GuildListStore.handleGuild(data);
	StickerStore.handleGuildUpdate(data);
	NagbarStore.handleGuildUpdate({guild: data});
	EmojiStore.handleGuildUpdate({guild: data});
	PermissionStore.handleGuild();

	QuickSwitcherStore.recomputeIfOpen();
}
