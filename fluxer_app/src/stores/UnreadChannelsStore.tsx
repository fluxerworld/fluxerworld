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

import {makePersistent} from '@app/lib/MobXPersistence';
import {makeAutoObservable} from 'mobx';

class UnreadChannelsStore {
	collapsedChannelIds: Array<string> = [];

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'UnreadChannelsStore', ['collapsedChannelIds']);
	}

	isCollapsed(channelId: string): boolean {
		return this.collapsedChannelIds.includes(channelId);
	}

	setCollapsed(channelId: string, collapsed: boolean): void {
		const next = new Set(this.collapsedChannelIds);
		if (collapsed) {
			next.add(channelId);
		} else {
			next.delete(channelId);
		}
		this.collapsedChannelIds = Array.from(next);
	}

	toggleCollapsed(channelId: string): void {
		this.setCollapsed(channelId, !this.isCollapsed(channelId));
	}
}

export default new UnreadChannelsStore();
