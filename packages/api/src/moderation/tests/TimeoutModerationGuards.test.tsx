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

import {createTimeoutModerationSetup, timeoutMember} from '@fluxer/api/src/moderation/tests/ModerationTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Timeout moderation guards', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('prevents moderators from timing out other moderators at same or higher level', async () => {
		const {moderator, targetModerator, higherMember, guild} = await createTimeoutModerationSetup(harness);

		const {response: timeoutModeratorResponse} = await timeoutMember(
			harness,
			moderator.token,
			guild.id,
			targetModerator.userId,
			15,
			403,
		);

		expect(timeoutModeratorResponse.status).toBe(403);

		const {response: timeoutHigherResponse} = await timeoutMember(
			harness,
			moderator.token,
			guild.id,
			higherMember.userId,
			15,
			403,
		);

		expect(timeoutHigherResponse.status).toBe(403);
	});
});
