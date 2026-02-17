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

import {DelayQueue} from '@fluxer/queue/src/engine/DelayQueue';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

interface TestItem {
	id: string;
	data: string;
}

describe('DelayQueue', () => {
	let queue: DelayQueue<TestItem>;
	const keyExtractor = (item: TestItem) => item.id;

	beforeEach(() => {
		queue = new DelayQueue<TestItem>(keyExtractor);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('basic operations', () => {
		it('should start empty', () => {
			expect(queue.isEmpty).toBe(true);
			expect(queue.size).toBe(0);
		});

		it('should push items with deadlines', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 1000);

			expect(queue.isEmpty).toBe(false);
			expect(queue.size).toBe(1);
		});

		it('should clear all items', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test1'}, now + 1000);
			queue.push({id: 'item-2', data: 'test2'}, now + 2000);

			queue.clear();

			expect(queue.isEmpty).toBe(true);
			expect(queue.size).toBe(0);
		});
	});

	describe('popExpired', () => {
		it('should return empty array when no items are expired', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 10000);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(0);
			expect(queue.size).toBe(1);
		});

		it('should pop expired items', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test1'}, now + 100);
			queue.push({id: 'item-2', data: 'test2'}, now + 200);
			queue.push({id: 'item-3', data: 'test3'}, now + 10000);

			vi.advanceTimersByTime(250);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(2);
			expect(expired.map((i) => i.id)).toContain('item-1');
			expect(expired.map((i) => i.id)).toContain('item-2');
			expect(queue.size).toBe(1);
		});

		it('should pop items in deadline order', () => {
			const now = Date.now();
			queue.push({id: 'item-3', data: 'third'}, now + 300);
			queue.push({id: 'item-1', data: 'first'}, now + 100);
			queue.push({id: 'item-2', data: 'second'}, now + 200);

			vi.advanceTimersByTime(350);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(3);
			expect(expired[0].id).toBe('item-1');
			expect(expired[1].id).toBe('item-2');
			expect(expired[2].id).toBe('item-3');
		});

		it('should include items with deadline equal to now', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(1);
			expect(expired[0].id).toBe('item-1');
		});
	});

	describe('remove operations', () => {
		it('should remove item by reference', () => {
			const now = Date.now();
			const item = {id: 'item-1', data: 'test'};
			queue.push(item, now + 1000);

			const removed = queue.remove(item);

			expect(removed).toBe(true);
			expect(queue.isEmpty).toBe(true);
		});

		it('should remove item by key', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 1000);

			const removed = queue.removeByKey('item-1');

			expect(removed).toBe(true);
			expect(queue.isEmpty).toBe(true);
		});

		it('should return false when removing non-existent item', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 1000);

			const removed = queue.removeByKey('non-existent');

			expect(removed).toBe(false);
			expect(queue.size).toBe(1);
		});

		it('should update item when pushing with same key', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'original'}, now + 1000);
			queue.push({id: 'item-1', data: 'updated'}, now + 2000);

			expect(queue.size).toBe(1);

			vi.advanceTimersByTime(1500);
			const expired1 = queue.popExpired();
			expect(expired1).toHaveLength(0);

			vi.advanceTimersByTime(1000);
			const expired2 = queue.popExpired();
			expect(expired2).toHaveLength(1);
			expect(expired2[0].data).toBe('updated');
		});
	});

	describe('has operations', () => {
		it('should return true for existing item', () => {
			const now = Date.now();
			const item = {id: 'item-1', data: 'test'};
			queue.push(item, now + 1000);

			expect(queue.has(item)).toBe(true);
			expect(queue.hasByKey('item-1')).toBe(true);
		});

		it('should return false for non-existent item', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 1000);

			expect(queue.has({id: 'item-2', data: 'test'})).toBe(false);
			expect(queue.hasByKey('item-2')).toBe(false);
		});

		it('should return false after item is removed', () => {
			const now = Date.now();
			const item = {id: 'item-1', data: 'test'};
			queue.push(item, now + 1000);
			queue.remove(item);

			expect(queue.has(item)).toBe(false);
			expect(queue.hasByKey('item-1')).toBe(false);
		});
	});

	describe('nextDelay', () => {
		it('should return null for empty queue', () => {
			expect(queue.nextDelay()).toBeNull();
		});

		it('should return delay until next deadline', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 5000);

			const delay = queue.nextDelay();

			expect(delay).toBe(5000);
		});

		it('should return 0 for expired items', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now + 100);

			vi.advanceTimersByTime(200);

			const delay = queue.nextDelay();

			expect(delay).toBe(0);
		});

		it('should return delay to earliest deadline', () => {
			const now = Date.now();
			queue.push({id: 'item-2', data: 'later'}, now + 10000);
			queue.push({id: 'item-1', data: 'sooner'}, now + 3000);

			const delay = queue.nextDelay();

			expect(delay).toBe(3000);
		});
	});

	describe('toArray', () => {
		it('should return copy of internal items', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test1'}, now + 1000);
			queue.push({id: 'item-2', data: 'test2'}, now + 2000);

			const arr = queue.toArray();

			expect(arr).toHaveLength(2);
			expect(arr[0].item.id).toBe('item-1');
			expect(arr[0].deadlineMs).toBe(now + 1000);
			expect(arr[1].item.id).toBe('item-2');
			expect(arr[1].deadlineMs).toBe(now + 2000);
		});

		it('should return items sorted by deadline', () => {
			const now = Date.now();
			queue.push({id: 'item-3', data: 'third'}, now + 3000);
			queue.push({id: 'item-1', data: 'first'}, now + 1000);
			queue.push({id: 'item-2', data: 'second'}, now + 2000);

			const arr = queue.toArray();

			expect(arr[0].item.id).toBe('item-1');
			expect(arr[1].item.id).toBe('item-2');
			expect(arr[2].item.id).toBe('item-3');
		});
	});

	describe('edge cases', () => {
		it('should handle items with same deadline', () => {
			const now = Date.now();
			const deadline = now + 1000;
			queue.push({id: 'item-1', data: 'first'}, deadline);
			queue.push({id: 'item-2', data: 'second'}, deadline);
			queue.push({id: 'item-3', data: 'third'}, deadline);

			vi.advanceTimersByTime(1100);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(3);
		});

		it('should handle negative deadline (already expired)', () => {
			const now = Date.now();
			queue.push({id: 'item-1', data: 'test'}, now - 1000);

			const expired = queue.popExpired();

			expect(expired).toHaveLength(1);
		});

		it('should handle large number of items', () => {
			const now = Date.now();
			for (let i = 0; i < 1000; i++) {
				queue.push({id: `item-${i}`, data: `data-${i}`}, now + (i + 1) * 10);
			}

			expect(queue.size).toBe(1000);

			vi.advanceTimersByTime(5000);
			const expired = queue.popExpired();

			expect(expired).toHaveLength(500);
			expect(queue.size).toBe(500);
		});
	});
});
