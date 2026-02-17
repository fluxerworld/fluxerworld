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

import {
	createPack,
	createPackEmoji,
	createPackSticker,
	deletePack,
	deletePackEmoji,
	deletePackSticker,
	getPackEmojis,
	getPackStickers,
	installPack,
	listPacks,
	setupPackTestAccount,
	uninstallPack,
	updatePack,
} from '@fluxer/api/src/pack/tests/PackTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Pack Invite Flow', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('user can create and list emoji pack', async () => {
		const {account} = await setupPackTestAccount(harness);

		const pack = await createPack(harness, account.token, 'emoji', {
			name: 'My Emoji Pack',
			description: 'A collection of emojis',
		});

		const dashboard = await listPacks(harness, account.token);
		const createdPack = dashboard.emoji.created.find((p) => p.id === pack.id);

		expect(createdPack).toBeTruthy();
		expect(createdPack?.name).toBe('My Emoji Pack');
	});

	test('user can update pack name and description', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'Original Name'});

		const updated = await updatePack(harness, account.token, pack.id, {
			name: 'Updated Name',
			description: 'New description',
		});

		expect(updated.name).toBe('Updated Name');
	});

	test('user can delete own pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'To Delete'});

		await deletePack(harness, account.token, pack.id);

		const dashboard = await listPacks(harness, account.token);
		const deletedPack = dashboard.emoji.created.find((p) => p.id === pack.id);
		expect(deletedPack).toBeUndefined();
	});

	test('user cannot update another users pack', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Owners Pack'});

		const {account: other} = await setupPackTestAccount(harness);

		await createBuilder(harness, other.token)
			.patch(`/packs/${pack.id}`)
			.body({name: 'Stolen Name'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('user cannot delete another users pack', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Protected Pack'});

		const {account: other} = await setupPackTestAccount(harness);

		await createBuilder(harness, other.token).delete(`/packs/${pack.id}`).expect(HTTP_STATUS.FORBIDDEN).execute();
	});

	test('user can install pack from another user', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Shareable Pack'});

		const {account: installer} = await setupPackTestAccount(harness);

		await installPack(harness, installer.token, pack.id);

		const dashboard = await listPacks(harness, installer.token);
		expect(dashboard.emoji.installed.some((p) => p.id === pack.id)).toBe(true);
	});

	test('uninstall pack returns success', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Uninstall Test Pack'});

		const {account: installer} = await setupPackTestAccount(harness);

		await installPack(harness, installer.token, pack.id);
		await uninstallPack(harness, installer.token, pack.id);
	});

	test('installing pack is idempotent', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Idempotent Pack'});

		const {account: installer} = await setupPackTestAccount(harness);

		await installPack(harness, installer.token, pack.id);
		await installPack(harness, installer.token, pack.id);

		const dashboard = await listPacks(harness, installer.token);
		const installedCount = dashboard.emoji.installed.filter((p) => p.id === pack.id).length;
		expect(installedCount).toBe(1);
	});

	test('cannot install non-existent pack', async () => {
		const {account} = await setupPackTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/packs/999999999999999999/install')
			.body({})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('can add emoji to pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'Emoji Pack'});

		const emoji = await createPackEmoji(harness, account.token, pack.id, 'test_emoji');

		expect(emoji.id).toBeTruthy();
		expect(emoji.name).toBe('test_emoji');

		const emojis = await getPackEmojis(harness, account.token, pack.id);
		expect(emojis.some((e) => e.id === emoji.id)).toBe(true);
	});

	test('can add sticker to pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'sticker', {name: 'Sticker Pack'});

		const sticker = await createPackSticker(harness, account.token, pack.id, 'test_sticker', ['happy', 'fun']);

		expect(sticker.id).toBeTruthy();
		expect(sticker.name).toBe('test_sticker');

		const stickers = await getPackStickers(harness, account.token, pack.id);
		expect(stickers.some((s) => s.id === sticker.id)).toBe(true);
	});

	test('cannot add emoji to sticker pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'sticker', {name: 'Wrong Type Pack'});

		await createBuilder(harness, account.token)
			.post(`/packs/emojis/${pack.id}`)
			.body({name: 'wrong_emoji', image: 'data:image/png;base64,iVBORw0KGgo='})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('cannot add sticker to emoji pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'Wrong Type Pack'});

		await createBuilder(harness, account.token)
			.post(`/packs/stickers/${pack.id}`)
			.body({name: 'wrong_sticker', tags: ['test'], image: 'data:image/png;base64,iVBORw0KGgo='})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('can delete emoji from pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'Delete Emoji Pack'});
		const emoji = await createPackEmoji(harness, account.token, pack.id, 'to_delete');

		await deletePackEmoji(harness, account.token, pack.id, emoji.id);

		const emojis = await getPackEmojis(harness, account.token, pack.id);
		expect(emojis.some((e) => e.id === emoji.id)).toBe(false);
	});

	test('can delete sticker from pack', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'sticker', {name: 'Delete Sticker Pack'});
		const sticker = await createPackSticker(harness, account.token, pack.id, 'to_delete', ['bye']);

		await deletePackSticker(harness, account.token, pack.id, sticker.id);

		const stickers = await getPackStickers(harness, account.token, pack.id);
		expect(stickers.some((s) => s.id === sticker.id)).toBe(false);
	});

	test('cannot add emoji to another users pack', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Protected Emoji Pack'});

		const {account: other} = await setupPackTestAccount(harness);

		await createBuilder(harness, other.token)
			.post(`/packs/emojis/${pack.id}`)
			.body({name: 'unauthorized', image: 'data:image/png;base64,iVBORw0KGgo='})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('pack creator shows in created packs list', async () => {
		const {account} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, account.token, 'emoji', {name: 'My Created Pack'});

		const dashboard = await listPacks(harness, account.token);

		expect(dashboard.emoji.created.some((p) => p.id === pack.id)).toBe(true);
		expect(dashboard.emoji.installed.some((p) => p.id === pack.id)).toBe(false);
	});

	test('multiple packs can be created and managed', async () => {
		const {account} = await setupPackTestAccount(harness);

		const emojiPack1 = await createPack(harness, account.token, 'emoji', {name: 'Emoji Pack 1'});
		const emojiPack2 = await createPack(harness, account.token, 'emoji', {name: 'Emoji Pack 2'});
		const stickerPack = await createPack(harness, account.token, 'sticker', {name: 'Sticker Pack 1'});

		const dashboard = await listPacks(harness, account.token);

		expect(dashboard.emoji.created.length).toBe(2);
		expect(dashboard.sticker.created.length).toBe(1);
		expect(dashboard.emoji.created.some((p) => p.id === emojiPack1.id)).toBe(true);
		expect(dashboard.emoji.created.some((p) => p.id === emojiPack2.id)).toBe(true);
		expect(dashboard.sticker.created.some((p) => p.id === stickerPack.id)).toBe(true);
	});

	test('installed pack shows installed_at timestamp', async () => {
		const {account: owner} = await setupPackTestAccount(harness);
		const pack = await createPack(harness, owner.token, 'emoji', {name: 'Timestamped Pack'});

		const {account: installer} = await setupPackTestAccount(harness);
		await installPack(harness, installer.token, pack.id);

		const dashboard = await listPacks(harness, installer.token);
		const installedPack = dashboard.emoji.installed.find((p) => p.id === pack.id);

		expect(installedPack).toBeTruthy();
		expect(installedPack?.installed_at).toBeTruthy();
	});
});
