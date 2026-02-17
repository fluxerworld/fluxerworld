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

import type {DiscoveryGuild} from '@app/actions/DiscoveryActionCreators';
import * as DiscoveryActionCreators from '@app/actions/DiscoveryActionCreators';
import {makeAutoObservable, runInAction} from 'mobx';

class DiscoveryStore {
	guilds: Array<DiscoveryGuild> = [];
	total = 0;
	loading = false;
	query = '';
	category: number | null = null;
	sortBy = 'member_count';
	categories: Array<{id: number; name: string}> = [];
	categoriesLoaded = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	async search(params: {query?: string; category?: number | null; sortBy?: string; offset?: number}): Promise<void> {
		const query = params.query ?? this.query;
		const category = params.category !== undefined ? params.category : this.category;
		const sortBy = params.sortBy ?? this.sortBy;
		const offset = params.offset ?? 0;

		runInAction(() => {
			this.loading = true;
			this.query = query;
			this.category = category;
			this.sortBy = sortBy;
		});

		try {
			const result = await DiscoveryActionCreators.searchGuilds({
				query: query || undefined,
				category: category ?? undefined,
				sort_by: sortBy,
				limit: 24,
				offset,
			});
			runInAction(() => {
				if (offset === 0) {
					this.guilds = result.guilds;
				} else {
					this.guilds = [...this.guilds, ...result.guilds];
				}
				this.total = result.total;
				this.loading = false;
			});
		} catch {
			runInAction(() => {
				this.loading = false;
			});
		}
	}

	async loadCategories(): Promise<void> {
		if (this.categoriesLoaded) return;
		try {
			const categories = await DiscoveryActionCreators.getCategories();
			runInAction(() => {
				this.categories = categories;
				this.categoriesLoaded = true;
			});
		} catch {
			// Fail silently - categories are optional UI enhancement
		}
	}

	reset(): void {
		this.guilds = [];
		this.total = 0;
		this.loading = false;
		this.query = '';
		this.category = null;
		this.sortBy = 'member_count';
	}
}

export default new DiscoveryStore();
