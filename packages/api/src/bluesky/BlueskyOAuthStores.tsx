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

import type {NodeSavedSession, NodeSavedState} from '@bluesky-social/oauth-client-node';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';

const STATE_PREFIX = 'bsky:oauth:state:';
const SESSION_PREFIX = 'bsky:oauth:session:';

export function createKVStateStore(kvClient: IKVProvider, ttlSeconds: number) {
	return {
		async set(key: string, internalState: NodeSavedState): Promise<void> {
			await kvClient.setex(`${STATE_PREFIX}${key}`, ttlSeconds, JSON.stringify(internalState));
		},
		async get(key: string): Promise<NodeSavedState | undefined> {
			const data = await kvClient.getdel(`${STATE_PREFIX}${key}`);
			if (!data) return undefined;
			return JSON.parse(data) as NodeSavedState;
		},
		async del(key: string): Promise<void> {
			await kvClient.del(`${STATE_PREFIX}${key}`);
		},
	};
}

export function createKVSessionStore(kvClient: IKVProvider, ttlSeconds: number) {
	return {
		async set(sub: string, session: NodeSavedSession): Promise<void> {
			await kvClient.setex(`${SESSION_PREFIX}${sub}`, ttlSeconds, JSON.stringify(session));
		},
		async get(sub: string): Promise<NodeSavedSession | undefined> {
			const data = await kvClient.get(`${SESSION_PREFIX}${sub}`);
			if (!data) return undefined;
			return JSON.parse(data) as NodeSavedSession;
		},
		async del(sub: string): Promise<void> {
			await kvClient.del(`${SESSION_PREFIX}${sub}`);
		},
	};
}
