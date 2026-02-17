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
import type {Channel} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

type ChannelUpdatePayload = Partial<Channel> & {
	id: string;
	type: number;
};

interface ChannelUpdateBulkPayload {
	channels: Array<ChannelUpdatePayload>;
}

export function handleChannelUpdateBulk(data: ChannelUpdateBulkPayload, _context: GatewayHandlerContext): void {
	for (const payload of data.channels) {
		const existing = ChannelStore.getChannel(payload.id);
		const channel = existing != null ? existing.withUpdates(payload) : (payload as Channel);

		ChannelStore.handleChannelCreate({channel});
		PermissionStore.handleChannelUpdate(payload.id);
		GuildReadStateStore.handleGenericUpdate(payload.id);
	}
	QuickSwitcherStore.recomputeIfOpen();
}
