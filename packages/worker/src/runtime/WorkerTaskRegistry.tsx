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

import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';

export class WorkerTaskRegistry {
	private readonly tasks: Map<string, WorkerTaskHandler> = new Map();

	register<TPayload = Record<string, unknown>>(name: string, handler: WorkerTaskHandler<TPayload>): this {
		this.tasks.set(name, handler as WorkerTaskHandler);
		return this;
	}

	registerAll(tasks: Record<string, WorkerTaskHandler>): this {
		for (const [name, handler] of Object.entries(tasks)) {
			this.tasks.set(name, handler);
		}
		return this;
	}

	get(name: string): WorkerTaskHandler | undefined {
		return this.tasks.get(name);
	}

	has(name: string): boolean {
		return this.tasks.has(name);
	}

	getTaskNames(): Array<string> {
		return Array.from(this.tasks.keys());
	}

	getTasks(): Record<string, WorkerTaskHandler> {
		return Object.fromEntries(this.tasks);
	}

	get size(): number {
		return this.tasks.size;
	}
}

export function createTaskRegistry(): WorkerTaskRegistry {
	return new WorkerTaskRegistry();
}
