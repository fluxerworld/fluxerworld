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

import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild, getGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {DiscoveryCategories, type DiscoveryCategory} from '@fluxer/constants/src/DiscoveryConstants';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import type {
	DiscoveryApplicationResponse,
	DiscoveryStatusResponse,
} from '@fluxer/schema/src/domains/guild/GuildDiscoverySchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

async function setGuildMemberCount(harness: ApiTestHarness, guildId: string, memberCount: number): Promise<void> {
	await createBuilder(harness, '')
		.post(`/test/guilds/${guildId}/member-count`)
		.body({member_count: memberCount})
		.execute();
}

async function applyForDiscovery(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	description = 'A great community for testing discovery features',
	categoryId: DiscoveryCategory = DiscoveryCategories.GAMING,
): Promise<DiscoveryApplicationResponse> {
	return createBuilder<DiscoveryApplicationResponse>(harness, token)
		.post(`/guilds/${guildId}/discovery`)
		.body({description, category_type: categoryId})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function adminApprove(
	harness: ApiTestHarness,
	adminToken: string,
	guildId: string,
	reason?: string,
): Promise<DiscoveryApplicationResponse> {
	return createBuilder<DiscoveryApplicationResponse>(harness, `Bearer ${adminToken}`)
		.post(`/admin/discovery/applications/${guildId}/approve`)
		.body({reason})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function adminReject(
	harness: ApiTestHarness,
	adminToken: string,
	guildId: string,
	reason: string,
): Promise<DiscoveryApplicationResponse> {
	return createBuilder<DiscoveryApplicationResponse>(harness, `Bearer ${adminToken}`)
		.post(`/admin/discovery/applications/${guildId}/reject`)
		.body({reason})
		.expect(HTTP_STATUS.OK)
		.execute();
}

async function createAdminAccount(harness: ApiTestHarness) {
	const admin = await createTestAccount(harness);
	return setUserACLs(harness, admin, ['admin:authenticate', 'discovery:review', 'discovery:remove']);
}

describe('Discovery Application Lifecycle', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should apply for discovery and return pending application', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Discovery Test Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		const application = await applyForDiscovery(harness, owner.token, guild.id);

		expect(application.guild_id).toBe(guild.id);
		expect(application.status).toBe('pending');
		expect(application.description).toBe('A great community for testing discovery features');
		expect(application.category_type).toBe(DiscoveryCategories.GAMING);
		expect(application.applied_at).toBeTruthy();
		expect(application.reviewed_at).toBeNull();
		expect(application.review_reason).toBeNull();
	});

	test('should retrieve application status', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Status Test Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		await applyForDiscovery(harness, owner.token, guild.id);

		const status = await createBuilder<DiscoveryStatusResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/discovery`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(status.application).not.toBeNull();
		expect(status.application!.guild_id).toBe(guild.id);
		expect(status.application!.status).toBe('pending');
		expect(status.eligible).toBe(true);
		expect(status.min_member_count).toBeGreaterThan(0);
	});

	test('should edit pending application description', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Edit Test Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		await applyForDiscovery(harness, owner.token, guild.id);

		const updated = await createBuilder<DiscoveryApplicationResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}/discovery`)
			.body({description: 'Updated community description'})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.description).toBe('Updated community description');
		expect(updated.category_type).toBe(DiscoveryCategories.GAMING);
	});

	test('should edit pending application category', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Category Edit Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		await applyForDiscovery(harness, owner.token, guild.id);

		const updated = await createBuilder<DiscoveryApplicationResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}/discovery`)
			.body({category_type: DiscoveryCategories.EDUCATION})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.category_type).toBe(DiscoveryCategories.EDUCATION);
	});

	test('should withdraw pending application', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Withdraw Test Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		await applyForDiscovery(harness, owner.token, guild.id);

		await createBuilder(harness, owner.token)
			.delete(`/guilds/${guild.id}/discovery`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const status = await createBuilder<DiscoveryStatusResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/discovery`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(status.application).toBeNull();
	});

	test('should complete full lifecycle: apply → approve → verify feature → withdraw', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Full Lifecycle Guild');
		await setGuildMemberCount(harness, guild.id, 1);
		const admin = await createAdminAccount(harness);

		const application = await applyForDiscovery(harness, owner.token, guild.id);
		expect(application.status).toBe('pending');

		const approved = await adminApprove(harness, admin.token, guild.id, 'Meets all criteria');
		expect(approved.status).toBe('approved');
		expect(approved.reviewed_at).toBeTruthy();
		expect(approved.review_reason).toBe('Meets all criteria');

		const guildData = await getGuild(harness, owner.token, guild.id);
		expect(guildData.features).toContain(GuildFeatures.DISCOVERABLE);

		await createBuilder(harness, owner.token)
			.delete(`/guilds/${guild.id}/discovery`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const guildAfterWithdraw = await getGuild(harness, owner.token, guild.id);
		expect(guildAfterWithdraw.features).not.toContain(GuildFeatures.DISCOVERABLE);
	});

	test('should allow reapplication after rejection', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Reapply Test Guild');
		await setGuildMemberCount(harness, guild.id, 1);
		const admin = await createAdminAccount(harness);

		await applyForDiscovery(harness, owner.token, guild.id);

		await adminReject(harness, admin.token, guild.id, 'Needs more detail');

		const status = await createBuilder<DiscoveryStatusResponse>(harness, owner.token)
			.get(`/guilds/${guild.id}/discovery`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(status.application!.status).toBe('rejected');

		const reapplication = await applyForDiscovery(
			harness,
			owner.token,
			guild.id,
			'Improved description with more detail about the community',
		);
		expect(reapplication.status).toBe('pending');
	});

	test('should edit approved application description', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Edit Approved Guild');
		await setGuildMemberCount(harness, guild.id, 1);
		const admin = await createAdminAccount(harness);

		await applyForDiscovery(harness, owner.token, guild.id);
		await adminApprove(harness, admin.token, guild.id);

		const updated = await createBuilder<DiscoveryApplicationResponse>(harness, owner.token)
			.patch(`/guilds/${guild.id}/discovery`)
			.body({description: 'Updated description after approval'})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.description).toBe('Updated description after approval');
		expect(updated.status).toBe('approved');
	});

	test('should apply with each valid category', async () => {
		const categories = [
			DiscoveryCategories.GAMING,
			DiscoveryCategories.MUSIC,
			DiscoveryCategories.ENTERTAINMENT,
			DiscoveryCategories.EDUCATION,
			DiscoveryCategories.SCIENCE_AND_TECHNOLOGY,
			DiscoveryCategories.CONTENT_CREATOR,
			DiscoveryCategories.ANIME_AND_MANGA,
			DiscoveryCategories.MOVIES_AND_TV,
			DiscoveryCategories.OTHER,
		];

		for (const categoryId of categories) {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, `Cat ${categoryId} Guild`);
			await setGuildMemberCount(harness, guild.id, 1);

			const application = await applyForDiscovery(
				harness,
				owner.token,
				guild.id,
				'Valid description for this category',
				categoryId,
			);
			expect(application.category_type).toBe(categoryId);
		}
	});

	test('should allow applying with minimum description length', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Min Desc Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		const application = await applyForDiscovery(harness, owner.token, guild.id, 'Short desc');
		expect(application.description).toBe('Short desc');
	});

	test('should allow applying with maximum description length', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Max Desc Guild');
		await setGuildMemberCount(harness, guild.id, 1);

		const maxDescription = 'A'.repeat(300);
		const application = await applyForDiscovery(harness, owner.token, guild.id, maxDescription);
		expect(application.description).toBe(maxDescription);
	});
});
