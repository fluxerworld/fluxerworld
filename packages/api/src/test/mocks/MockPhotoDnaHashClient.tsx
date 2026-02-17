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

import {randomUUID} from 'node:crypto';
import type {FrameSample} from '@fluxer/api/src/csam/CsamTypes';
import type {IPhotoDnaHashClient} from '@fluxer/api/src/csam/PhotoDnaHashClient';
import {vi} from 'vitest';

export interface MockPhotoDnaHashClientConfig {
	shouldFail?: boolean;
	returnEmpty?: boolean;
	hashes?: Array<string>;
}

export class MockPhotoDnaHashClient implements IPhotoDnaHashClient {
	readonly hashFramesSpy = vi.fn();
	private config: MockPhotoDnaHashClientConfig;

	constructor(config: MockPhotoDnaHashClientConfig = {}) {
		this.config = config;
	}

	configure(config: MockPhotoDnaHashClientConfig): void {
		this.config = {...this.config, ...config};
	}

	async hashFrames(frames: Array<FrameSample>): Promise<Array<string>> {
		this.hashFramesSpy(frames);
		if (this.config.shouldFail) {
			throw new Error('Mock hash client failure');
		}
		if (this.config.returnEmpty) {
			return [];
		}
		if (this.config.hashes) {
			return this.config.hashes;
		}
		return frames.map((_, index) => `mock-hash-${randomUUID()}-${index}`);
	}

	reset(): void {
		this.config = {};
		this.hashFramesSpy.mockClear();
	}
}
