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
import {fetchUserNote, setUserNote} from '@fluxer/api/src/user/tests/UserTestUtils';
import {beforeEach, describe, expect, test} from 'vitest';

describe('User Note Lifecycle', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('user can set and retrieve note for another user', async () => {
		const user = await createTestAccount(harness);
		const target = await createTestAccount(harness);

		const noteContent = 'This is a test note';
		await setUserNote(harness, user.token, target.userId, noteContent);

		const {json} = await fetchUserNote(harness, user.token, target.userId);
		const note = json as {note: string | null};
		expect(note.note).toBe(noteContent);
	});

	test('user can update note for another user', async () => {
		const user = await createTestAccount(harness);
		const target = await createTestAccount(harness);

		await setUserNote(harness, user.token, target.userId, 'Initial note');

		const updatedNote = 'Updated note content';
		await setUserNote(harness, user.token, target.userId, updatedNote);

		const {json} = await fetchUserNote(harness, user.token, target.userId);
		const note = json as {note: string | null};
		expect(note.note).toBe(updatedNote);
	});

	test('user can clear note for another user', async () => {
		const user = await createTestAccount(harness);
		const target = await createTestAccount(harness);

		await setUserNote(harness, user.token, target.userId, 'Note to clear');

		await setUserNote(harness, user.token, target.userId, null);

		await createBuilder(harness, user.token)
			.get(`/users/@me/notes/${target.userId}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
