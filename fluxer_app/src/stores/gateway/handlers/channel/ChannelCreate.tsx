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

import ChannelStore from '@app/stores/ChannelStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import PermissionStore from '@app/stores/PermissionStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

interface ChannelPayload {
	id: string;
	type: number;
}

export function handleChannelCreate(data: ChannelPayload, _context: GatewayHandlerContext): void {
	const channel = data as Channel;

	ChannelStore.handleChannelCreate({channel});
	PermissionStore.handleChannelUpdate(data.id);
	ReadStateStore.handleChannelCreate({channel});
	GuildReadStateStore.handleGenericUpdate(data.id);
	QuickSwitcherStore.recomputeIfOpen();
}
