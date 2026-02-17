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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {
	BlueskyAuthorizeResult,
	BlueskyCallbackResult,
	IBlueskyOAuthService,
} from '@fluxer/api/src/bluesky/IBlueskyOAuthService';
import {vi} from 'vitest';

export interface MockBlueskyOAuthServiceOptions {
	authorizeResult?: BlueskyAuthorizeResult;
	callbackResult?: BlueskyCallbackResult;
	restoreAndVerifyResult?: {handle: string} | null;
	shouldFailAuthorize?: boolean;
	shouldFailCallback?: boolean;
}

export class MockBlueskyOAuthService implements IBlueskyOAuthService {
	readonly authorizeSpy = vi.fn();
	readonly callbackSpy = vi.fn();
	readonly restoreAndVerifySpy = vi.fn();
	readonly revokeSpy = vi.fn();

	readonly clientMetadata: Record<string, unknown> = {client_id: 'https://test/metadata.json'};
	readonly jwks: Record<string, unknown> = {keys: []};

	private options: MockBlueskyOAuthServiceOptions;

	constructor(options: MockBlueskyOAuthServiceOptions = {}) {
		this.options = options;
		this.setupDefaults();
	}

	private setupDefaults(): void {
		this.authorizeSpy.mockImplementation(async () => {
			if (this.options.shouldFailAuthorize) {
				throw new Error('Mock authorise failure');
			}
			return this.options.authorizeResult ?? {authorizeUrl: 'https://bsky.social/oauth/authorize?mock=true'};
		});

		this.callbackSpy.mockImplementation(async () => {
			if (this.options.shouldFailCallback) {
				throw new Error('Mock callback failure');
			}
			if (!this.options.callbackResult) {
				throw new Error('No callbackResult configured in mock');
			}
			return this.options.callbackResult;
		});

		this.restoreAndVerifySpy.mockImplementation(async () => {
			return this.options.restoreAndVerifyResult ?? null;
		});

		this.revokeSpy.mockResolvedValue(undefined);
	}

	async authorize(handle: string, userId: UserID): Promise<BlueskyAuthorizeResult> {
		return this.authorizeSpy(handle, userId);
	}

	async callback(params: URLSearchParams): Promise<BlueskyCallbackResult> {
		return this.callbackSpy(params);
	}

	async restoreAndVerify(did: string): Promise<{handle: string} | null> {
		return this.restoreAndVerifySpy(did);
	}

	async revoke(did: string): Promise<void> {
		return this.revokeSpy(did);
	}

	configure(options: Partial<MockBlueskyOAuthServiceOptions>): void {
		this.options = {...this.options, ...options};
		this.setupDefaults();
	}

	reset(): void {
		this.authorizeSpy.mockReset();
		this.callbackSpy.mockReset();
		this.restoreAndVerifySpy.mockReset();
		this.revokeSpy.mockReset();
		this.options = {};
		this.setupDefaults();
	}
}
