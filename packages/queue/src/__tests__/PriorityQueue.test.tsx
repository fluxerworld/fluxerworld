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

import {PriorityQueue} from '@fluxer/queue/src/engine/PriorityQueue';
import {createJobID, type ReadyItem} from '@fluxer/queue/src/types/JobTypes';
import {beforeEach, describe, expect, it} from 'vitest';

function createReadyItem(
	jobId: string,
	priority: number,
	runAtMs: number = 1000,
	createdAtMs: number = 1000,
	sequence: number = 0,
): ReadyItem {
	return {
		jobId: createJobID(jobId),
		priority,
		runAtMs,
		createdAtMs,
		sequence,
	};
}

describe('PriorityQueue', () => {
	let queue: PriorityQueue;

	beforeEach(() => {
		queue = new PriorityQueue();
	});

	describe('basic operations', () => {
		it('should start empty', () => {
			expect(queue.isEmpty).toBe(true);
			expect(queue.size).toBe(0);
			expect(queue.peek()).toBeUndefined();
			expect(queue.pop()).toBeUndefined();
		});

		it('should push and pop a single item', () => {
			const item = createReadyItem('job-1', 5);
			queue.push(item);

			expect(queue.isEmpty).toBe(false);
			expect(queue.size).toBe(1);
			expect(queue.peek()).toEqual(item);

			const popped = queue.pop();
			expect(popped).toEqual(item);
			expect(queue.isEmpty).toBe(true);
		});

		it('should push multiple items and maintain size', () => {
			queue.push(createReadyItem('job-1', 1));
			queue.push(createReadyItem('job-2', 2));
			queue.push(createReadyItem('job-3', 3));

			expect(queue.size).toBe(3);
		});

		it('should clear all items', () => {
			queue.push(createReadyItem('job-1', 1));
			queue.push(createReadyItem('job-2', 2));

			queue.clear();

			expect(queue.isEmpty).toBe(true);
			expect(queue.size).toBe(0);
		});
	});

	describe('priority ordering', () => {
		it('should pop highest priority first', () => {
			queue.push(createReadyItem('low', 1));
			queue.push(createReadyItem('high', 10));
			queue.push(createReadyItem('medium', 5));

			expect(queue.pop()?.jobId).toBe('high');
			expect(queue.pop()?.jobId).toBe('medium');
			expect(queue.pop()?.jobId).toBe('low');
		});

		it('should order by runAtMs when priorities are equal', () => {
			const baseTime = 1000;
			queue.push(createReadyItem('later', 5, baseTime + 200));
			queue.push(createReadyItem('earlier', 5, baseTime + 100));
			queue.push(createReadyItem('earliest', 5, baseTime));

			expect(queue.pop()?.jobId).toBe('earliest');
			expect(queue.pop()?.jobId).toBe('earlier');
			expect(queue.pop()?.jobId).toBe('later');
		});

		it('should order by createdAtMs when priority and runAtMs are equal', () => {
			const baseTime = 1000;
			queue.push(createReadyItem('third', 5, baseTime, baseTime + 200));
			queue.push(createReadyItem('first', 5, baseTime, baseTime));
			queue.push(createReadyItem('second', 5, baseTime, baseTime + 100));

			expect(queue.pop()?.jobId).toBe('first');
			expect(queue.pop()?.jobId).toBe('second');
			expect(queue.pop()?.jobId).toBe('third');
		});

		it('should order by sequence when all other fields are equal', () => {
			const baseTime = 1000;
			queue.push(createReadyItem('third', 5, baseTime, baseTime, 3));
			queue.push(createReadyItem('first', 5, baseTime, baseTime, 1));
			queue.push(createReadyItem('second', 5, baseTime, baseTime, 2));

			expect(queue.pop()?.jobId).toBe('first');
			expect(queue.pop()?.jobId).toBe('second');
			expect(queue.pop()?.jobId).toBe('third');
		});

		it('should maintain heap property after multiple insertions', () => {
			const priorities = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
			priorities.forEach((p, i) => {
				queue.push(createReadyItem(`job-${i}`, p, 1000, 1000, i));
			});

			const sorted = [...priorities].sort((a, b) => b - a);
			const popped: Array<number> = [];

			while (!queue.isEmpty) {
				const item = queue.pop();
				if (item) {
					popped.push(item.priority);
				}
			}

			expect(popped).toEqual(sorted);
		});
	});

	describe('remove operation', () => {
		it('should remove an existing item', () => {
			queue.push(createReadyItem('job-1', 1));
			queue.push(createReadyItem('job-2', 2));
			queue.push(createReadyItem('job-3', 3));

			const removed = queue.remove(createJobID('job-2'));

			expect(removed).toBe(true);
			expect(queue.size).toBe(2);
			expect(queue.has(createJobID('job-2'))).toBe(false);
		});

		it('should return false when removing non-existent item', () => {
			queue.push(createReadyItem('job-1', 1));

			const removed = queue.remove(createJobID('non-existent'));

			expect(removed).toBe(false);
			expect(queue.size).toBe(1);
		});

		it('should maintain heap property after removal', () => {
			queue.push(createReadyItem('job-1', 1));
			queue.push(createReadyItem('job-2', 5));
			queue.push(createReadyItem('job-3', 3));
			queue.push(createReadyItem('job-4', 7));
			queue.push(createReadyItem('job-5', 2));

			queue.remove(createJobID('job-2'));

			expect(queue.pop()?.jobId).toBe('job-4');
			expect(queue.pop()?.jobId).toBe('job-3');
			expect(queue.pop()?.jobId).toBe('job-5');
			expect(queue.pop()?.jobId).toBe('job-1');
		});

		it('should handle removing the only item', () => {
			queue.push(createReadyItem('job-1', 1));

			const removed = queue.remove(createJobID('job-1'));

			expect(removed).toBe(true);
			expect(queue.isEmpty).toBe(true);
		});

		it('should handle removing from the front of the queue', () => {
			queue.push(createReadyItem('job-1', 10));
			queue.push(createReadyItem('job-2', 5));
			queue.push(createReadyItem('job-3', 1));

			queue.remove(createJobID('job-1'));

			expect(queue.peek()?.jobId).toBe('job-2');
		});
	});

	describe('has operation', () => {
		it('should return true for existing item', () => {
			queue.push(createReadyItem('job-1', 1));

			expect(queue.has(createJobID('job-1'))).toBe(true);
		});

		it('should return false for non-existent item', () => {
			queue.push(createReadyItem('job-1', 1));

			expect(queue.has(createJobID('job-2'))).toBe(false);
		});

		it('should return false after item is removed', () => {
			queue.push(createReadyItem('job-1', 1));
			queue.remove(createJobID('job-1'));

			expect(queue.has(createJobID('job-1'))).toBe(false);
		});
	});

	describe('toArray and fromArray', () => {
		it('should convert queue to array', () => {
			const items = [createReadyItem('job-1', 1), createReadyItem('job-2', 2), createReadyItem('job-3', 3)];

			items.forEach((item) => queue.push(item));

			const arr = queue.toArray();

			expect(arr.length).toBe(3);
			items.forEach((item) => {
				expect(arr.some((a) => a.jobId === item.jobId)).toBe(true);
			});
		});

		it('should create queue from array', () => {
			const items = [createReadyItem('job-1', 1), createReadyItem('job-2', 5), createReadyItem('job-3', 3)];

			const newQueue = PriorityQueue.fromArray(items);

			expect(newQueue.size).toBe(3);
			expect(newQueue.pop()?.jobId).toBe('job-2');
			expect(newQueue.pop()?.jobId).toBe('job-3');
			expect(newQueue.pop()?.jobId).toBe('job-1');
		});

		it('should create empty queue from empty array', () => {
			const newQueue = PriorityQueue.fromArray([]);

			expect(newQueue.isEmpty).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('should handle items with same priority correctly', () => {
			for (let i = 0; i < 10; i++) {
				queue.push(createReadyItem(`job-${i}`, 5, 1000, 1000, i));
			}

			let lastSequence = -1;
			while (!queue.isEmpty) {
				const item = queue.pop();
				if (item) {
					expect(item.sequence).toBeGreaterThan(lastSequence);
					lastSequence = item.sequence;
				}
			}
		});

		it('should handle large number of items', () => {
			for (let i = 0; i < 1000; i++) {
				queue.push(createReadyItem(`job-${i}`, Math.floor(Math.random() * 100)));
			}

			expect(queue.size).toBe(1000);

			let lastPriority = Infinity;
			while (!queue.isEmpty) {
				const item = queue.pop();
				if (item) {
					expect(item.priority).toBeLessThanOrEqual(lastPriority);
					lastPriority = item.priority;
				}
			}
		});
	});
});
