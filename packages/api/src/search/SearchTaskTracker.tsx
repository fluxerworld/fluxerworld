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

// A tiny task tracker used by integration tests.
//
// The API intentionally fire-and-forgets some search indexing calls (e.g.
// `void search.indexMessage(...)`) so requests aren't blocked in production.
// For integration tests we want deterministic behaviour, so the test request
// helpers can drain pending search tasks between requests.

let trackingEnabled = false;
const pendingTasks = new Set<Promise<unknown>>();

export function enableSearchTaskTracking(): void {
	trackingEnabled = true;
}

export function disableSearchTaskTracking(): void {
	trackingEnabled = false;
	pendingTasks.clear();
}

export function trackSearchTask<T>(promise: Promise<T>): Promise<T> {
	if (!trackingEnabled) {
		return promise;
	}

	// Track the original promise. Ensure we always remove it to avoid leaks.
	pendingTasks.add(promise);
	void promise.finally(() => {
		pendingTasks.delete(promise);
	});

	return promise;
}

export async function drainSearchTasks(options?: {timeoutMs?: number}): Promise<void> {
	if (!trackingEnabled) {
		return;
	}

	const timeoutMs = options?.timeoutMs ?? 30_000;
	const deadline = Date.now() + timeoutMs;

	// Tasks can enqueue other tasks (or new requests can trigger more indexing).
	// Drain until stable (or timeout).
	while (pendingTasks.size > 0) {
		const snapshot = Array.from(pendingTasks);
		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) {
			throw new Error(`Timed out waiting for pending search tasks (${pendingTasks.size} remaining)`);
		}

		// Protect against a hung promise: Promise.allSettled would never resolve.
		await Promise.race([
			Promise.allSettled(snapshot),
			new Promise<void>((_resolve, reject) => {
				setTimeout(() => {
					reject(new Error(`Timed out waiting for pending search tasks (${pendingTasks.size} remaining)`));
				}, remainingMs);
			}),
		]);
	}
}
