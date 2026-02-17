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

import type {ISnowflakeService} from '@fluxer/api/src/infrastructure/ISnowflakeService';
import {vi} from 'vitest';

export interface MockSnowflakeServiceConfig {
	initialCounter?: bigint;
	nodeId?: number;
	shouldFailInitialize?: boolean;
	shouldFailGenerate?: boolean;
}

export class MockSnowflakeService implements ISnowflakeService {
	private counter: bigint;
	private nodeId: number | null;
	private initialized: boolean = false;
	private config: MockSnowflakeServiceConfig;
	private generatedIds: Array<bigint> = [];

	readonly initializeSpy = vi.fn();
	readonly reinitializeSpy = vi.fn();
	readonly shutdownSpy = vi.fn();
	readonly generateSpy = vi.fn();
	readonly getNodeIdForTestingSpy = vi.fn();
	readonly renewNodeIdForTestingSpy = vi.fn();

	constructor(config: MockSnowflakeServiceConfig = {}) {
		this.config = config;
		this.counter = config.initialCounter ?? 1n;
		this.nodeId = config.nodeId ?? 0;
	}

	configure(config: MockSnowflakeServiceConfig): void {
		this.config = {...this.config, ...config};
		if (config.initialCounter !== undefined) {
			this.counter = config.initialCounter;
		}
		if (config.nodeId !== undefined) {
			this.nodeId = config.nodeId;
		}
	}

	async initialize(): Promise<void> {
		this.initializeSpy();
		if (this.config.shouldFailInitialize) {
			throw new Error('Mock snowflake initialization failure');
		}
		this.initialized = true;
	}

	async reinitialize(): Promise<void> {
		this.reinitializeSpy();
		this.initialized = false;
		await this.initialize();
	}

	async shutdown(): Promise<void> {
		this.shutdownSpy();
		this.initialized = false;
		this.nodeId = null;
	}

	async generate(): Promise<bigint> {
		this.generateSpy();
		if (this.config.shouldFailGenerate) {
			throw new Error('Mock snowflake generation failure');
		}
		if (!this.initialized) {
			throw new Error('SnowflakeService not initialized - call initialize() first');
		}
		const id = this.counter;
		this.counter += 1n;
		this.generatedIds.push(id);
		return id;
	}

	getNodeIdForTesting(): number | null {
		this.getNodeIdForTestingSpy();
		return this.nodeId;
	}

	async renewNodeIdForTesting(): Promise<void> {
		this.renewNodeIdForTestingSpy();
	}

	setCounter(value: bigint): void {
		this.counter = value;
	}

	getCounter(): bigint {
		return this.counter;
	}

	getGeneratedIds(): Array<bigint> {
		return [...this.generatedIds];
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	reset(): void {
		this.counter = this.config.initialCounter ?? 1n;
		this.nodeId = this.config.nodeId ?? 0;
		this.initialized = false;
		this.generatedIds = [];
		this.config = {};
		this.initializeSpy.mockClear();
		this.reinitializeSpy.mockClear();
		this.shutdownSpy.mockClear();
		this.generateSpy.mockClear();
		this.getNodeIdForTestingSpy.mockClear();
		this.renewNodeIdForTestingSpy.mockClear();
	}
}
