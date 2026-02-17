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
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {makeAutoObservable} from 'mobx';

class LimitOverrideStore {
	overrides: Partial<Record<LimitKey, number>> = {};

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		void this.initPersistence();
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'LimitOverrideStore', ['overrides']);
	}

	getOverride(key: LimitKey): number | null {
		if (Object.hasOwn(this.overrides, key)) {
			return this.overrides[key] ?? null;
		}
		return null;
	}

	getAllOverrides(): Partial<Record<LimitKey, number>> {
		return {...this.overrides};
	}

	hasOverrides(): boolean {
		return Object.keys(this.overrides).length > 0;
	}

	setOverride(key: LimitKey, value: number | null): void {
		const next = {...this.overrides};
		if (value === null) {
			delete next[key];
		} else {
			next[key] = value;
		}
		this.overrides = next;
	}

	clearOverride(key: LimitKey): void {
		this.setOverride(key, null);
	}

	clearAll(): void {
		this.overrides = {};
	}
}

export default new LimitOverrideStore();
