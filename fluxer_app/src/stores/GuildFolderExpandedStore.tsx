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

class GuildFolderExpandedStore {
	expandedFolderIds: Array<number> = [];

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'GuildFolderExpandedStore', ['expandedFolderIds']);
	}

	isExpanded(folderId: number): boolean {
		return this.expandedFolderIds.includes(folderId);
	}

	toggleExpanded(folderId: number): void {
		if (this.expandedFolderIds.includes(folderId)) {
			const index = this.expandedFolderIds.indexOf(folderId);
			if (index > -1) {
				this.expandedFolderIds.splice(index, 1);
			}
		} else {
			this.expandedFolderIds.push(folderId);
		}
	}
}

export default new GuildFolderExpandedStore();
