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

import type {JobID, ReadyItem} from '@fluxer/queue/src/domain/QueueDomainTypes';

export class PriorityQueue {
	private heap: Array<ReadyItem> = [];

	private compare(a: ReadyItem, b: ReadyItem): number {
		if (a.priority !== b.priority) {
			return b.priority - a.priority;
		}
		if (a.runAtMs !== b.runAtMs) {
			return a.runAtMs - b.runAtMs;
		}
		if (a.createdAtMs !== b.createdAtMs) {
			return a.createdAtMs - b.createdAtMs;
		}
		return a.sequence - b.sequence;
	}

	private swap(i: number, j: number): void {
		const temp = this.heap[i]!;
		this.heap[i] = this.heap[j]!;
		this.heap[j] = temp;
	}

	private bubbleUp(index: number): void {
		while (index > 0) {
			const parentIndex = Math.floor((index - 1) / 2);
			if (this.compare(this.heap[index]!, this.heap[parentIndex]!) >= 0) {
				break;
			}
			this.swap(index, parentIndex);
			index = parentIndex;
		}
	}

	private bubbleDown(index: number): void {
		const length = this.heap.length;
		while (true) {
			const leftChild = 2 * index + 1;
			const rightChild = 2 * index + 2;
			let smallest = index;

			if (leftChild < length && this.compare(this.heap[leftChild]!, this.heap[smallest]!) < 0) {
				smallest = leftChild;
			}
			if (rightChild < length && this.compare(this.heap[rightChild]!, this.heap[smallest]!) < 0) {
				smallest = rightChild;
			}

			if (smallest === index) {
				break;
			}

			this.swap(index, smallest);
			index = smallest;
		}
	}

	push(item: ReadyItem): void {
		this.heap.push(item);
		this.bubbleUp(this.heap.length - 1);
	}

	pop(): ReadyItem | undefined {
		if (this.heap.length === 0) {
			return undefined;
		}

		const result = this.heap[0];
		const last = this.heap.pop();

		if (this.heap.length > 0 && last !== undefined) {
			this.heap[0] = last;
			this.bubbleDown(0);
		}

		return result;
	}

	peek(): ReadyItem | undefined {
		return this.heap[0];
	}

	remove(jobId: JobID): boolean {
		const index = this.heap.findIndex((item) => item.jobId === jobId);
		if (index === -1) {
			return false;
		}

		const last = this.heap.pop();
		if (index < this.heap.length && last !== undefined) {
			this.heap[index] = last;
			this.bubbleUp(index);
			this.bubbleDown(index);
		}

		return true;
	}

	has(jobId: JobID): boolean {
		return this.heap.some((item) => item.jobId === jobId);
	}

	get size(): number {
		return this.heap.length;
	}

	get isEmpty(): boolean {
		return this.heap.length === 0;
	}

	clear(): void {
		this.heap = [];
	}

	toArray(): Array<ReadyItem> {
		return [...this.heap];
	}

	static fromArray(items: Array<ReadyItem>): PriorityQueue {
		const queue = new PriorityQueue();
		for (const item of items) {
			queue.push(item);
		}
		return queue;
	}
}
