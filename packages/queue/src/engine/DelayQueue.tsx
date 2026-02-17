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

import {nowMs} from '@fluxer/time/src/Clock';
import {computeRemainingDelayMs} from '@fluxer/time/src/DelayMath';

export interface DelayedItem<T> {
	item: T;
	deadlineMs: number;
}

export class DelayQueue<T> {
	private items: Array<DelayedItem<T>> = [];
	private keyExtractor: (item: T) => string;

	constructor(keyExtractor: (item: T) => string) {
		this.keyExtractor = keyExtractor;
	}

	push(item: T, deadlineMs: number): void {
		this.remove(item);

		let left = 0;
		let right = this.items.length;
		while (left < right) {
			const mid = Math.floor((left + right) / 2);
			if (this.items[mid]!.deadlineMs <= deadlineMs) {
				left = mid + 1;
			} else {
				right = mid;
			}
		}

		this.items.splice(left, 0, {item, deadlineMs});
	}

	popExpired(): Array<T> {
		const now = nowMs();
		const expired: Array<T> = [];

		while (this.items.length > 0 && this.items[0]!.deadlineMs <= now) {
			expired.push(this.items.shift()!.item);
		}

		return expired;
	}

	remove(item: T): boolean {
		const key = this.keyExtractor(item);
		const index = this.items.findIndex((di) => this.keyExtractor(di.item) === key);
		if (index !== -1) {
			this.items.splice(index, 1);
			return true;
		}
		return false;
	}

	removeByKey(key: string): boolean {
		const index = this.items.findIndex((di) => this.keyExtractor(di.item) === key);
		if (index !== -1) {
			this.items.splice(index, 1);
			return true;
		}
		return false;
	}

	has(item: T): boolean {
		const key = this.keyExtractor(item);
		return this.items.some((di) => this.keyExtractor(di.item) === key);
	}

	hasByKey(key: string): boolean {
		return this.items.some((di) => this.keyExtractor(di.item) === key);
	}

	nextDelay(): number | null {
		if (this.items.length === 0) {
			return null;
		}
		return computeRemainingDelayMs({
			fromMs: nowMs(),
			toMs: this.items[0]!.deadlineMs,
		});
	}

	get size(): number {
		return this.items.length;
	}

	get isEmpty(): boolean {
		return this.items.length === 0;
	}

	clear(): void {
		this.items = [];
	}

	toArray(): Array<DelayedItem<T>> {
		return [...this.items];
	}
}
