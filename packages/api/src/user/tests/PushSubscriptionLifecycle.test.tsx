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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {deletePushSubscription, listPushSubscriptions, subscribePush} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('Push Subscription Lifecycle', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('subscribe returns a 32-character hex subscription id', async () => {
		const account = await createTestAccount(harness);
		const result = await subscribePush(harness, account.token, 'https://push.example.com/endpoint-1');

		expect(result.subscription_id).toBeDefined();
		expect(result.subscription_id).toMatch(/^[a-f0-9]{32}$/);
	});

	test('same endpoint produces the same subscription id', async () => {
		const account = await createTestAccount(harness);
		const endpoint = 'https://push.example.com/deterministic';

		const first = await subscribePush(harness, account.token, endpoint);
		const second = await subscribePush(harness, account.token, endpoint);

		expect(first.subscription_id).toBe(second.subscription_id);
	});

	test('different endpoints produce different subscription ids', async () => {
		const account = await createTestAccount(harness);

		const first = await subscribePush(harness, account.token, 'https://push.example.com/endpoint-a');
		const second = await subscribePush(harness, account.token, 'https://push.example.com/endpoint-b');

		expect(first.subscription_id).not.toBe(second.subscription_id);
	});

	test('list subscriptions returns empty array initially', async () => {
		const account = await createTestAccount(harness);
		const result = await listPushSubscriptions(harness, account.token);

		expect(result.subscriptions).toEqual([]);
	});

	test('list subscriptions returns registered subscriptions', async () => {
		const account = await createTestAccount(harness);
		const endpoint = 'https://push.example.com/list-test';
		const userAgent = 'TestBrowser/1.0';

		const subscribed = await subscribePush(harness, account.token, endpoint, {userAgent});
		const result = await listPushSubscriptions(harness, account.token);

		expect(result.subscriptions).toHaveLength(1);
		expect(result.subscriptions[0].subscription_id).toBe(subscribed.subscription_id);
		expect(result.subscriptions[0].user_agent).toBe(userAgent);
	});

	test('list subscriptions returns multiple subscriptions', async () => {
		const account = await createTestAccount(harness);

		const first = await subscribePush(harness, account.token, 'https://push.example.com/multi-1');
		const second = await subscribePush(harness, account.token, 'https://push.example.com/multi-2');

		const result = await listPushSubscriptions(harness, account.token);
		expect(result.subscriptions).toHaveLength(2);

		const ids = result.subscriptions.map((s) => s.subscription_id).sort();
		expect(ids).toContain(first.subscription_id);
		expect(ids).toContain(second.subscription_id);
	});

	test('subscription without user_agent returns null', async () => {
		const account = await createTestAccount(harness);
		await subscribePush(harness, account.token, 'https://push.example.com/no-ua');

		const result = await listPushSubscriptions(harness, account.token);
		expect(result.subscriptions).toHaveLength(1);
		expect(result.subscriptions[0].user_agent).toBeNull();
	});

	test('delete subscription removes it from the list', async () => {
		const account = await createTestAccount(harness);

		const subscribed = await subscribePush(harness, account.token, 'https://push.example.com/delete-test');
		await deletePushSubscription(harness, account.token, subscribed.subscription_id);

		const result = await listPushSubscriptions(harness, account.token);
		expect(result.subscriptions).toHaveLength(0);
	});

	test('delete one subscription does not affect others', async () => {
		const account = await createTestAccount(harness);

		const first = await subscribePush(harness, account.token, 'https://push.example.com/keep');
		const second = await subscribePush(harness, account.token, 'https://push.example.com/remove');

		await deletePushSubscription(harness, account.token, second.subscription_id);

		const result = await listPushSubscriptions(harness, account.token);
		expect(result.subscriptions).toHaveLength(1);
		expect(result.subscriptions[0].subscription_id).toBe(first.subscription_id);
	});

	test('subscriptions are isolated between users', async () => {
		const alice = await createTestAccount(harness);
		const bob = await createTestAccount(harness);

		await subscribePush(harness, alice.token, 'https://push.example.com/alice');
		await subscribePush(harness, bob.token, 'https://push.example.com/bob');

		const aliceSubs = await listPushSubscriptions(harness, alice.token);
		const bobSubs = await listPushSubscriptions(harness, bob.token);

		expect(aliceSubs.subscriptions).toHaveLength(1);
		expect(bobSubs.subscriptions).toHaveLength(1);
		expect(aliceSubs.subscriptions[0].subscription_id).not.toBe(bobSubs.subscriptions[0].subscription_id);
	});

	test('subscribe rejects invalid endpoint', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/users/@me/push/subscribe')
			.body({
				endpoint: 'not-a-url',
				keys: {p256dh: 'key', auth: 'auth'},
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('subscribe rejects missing keys', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/users/@me/push/subscribe')
			.body({
				endpoint: 'https://push.example.com/missing-keys',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('subscribe requires authentication', async () => {
		await createBuilder(harness, '')
			.post('/users/@me/push/subscribe')
			.body({
				endpoint: 'https://push.example.com/no-auth',
				keys: {p256dh: 'key', auth: 'auth'},
			})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('list subscriptions requires authentication', async () => {
		await createBuilder(harness, '').get('/users/@me/push/subscriptions').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	test('delete subscription requires authentication', async () => {
		await createBuilder(harness, '')
			.delete('/users/@me/push/subscriptions/abc123')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});
});
