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

import {mapGuildToAdminResponse} from '@fluxer/api/src/admin/models/GuildTypes';
import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {AdminGuildUpdatePropagator} from '@fluxer/api/src/admin/services/guild/AdminGuildUpdatePropagator';
import {
	createGuildID,
	createInviteCode,
	createVanityURLCode,
	type UserID,
	vanityCodeToInviteCode,
} from '@fluxer/api/src/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {InviteRepository} from '@fluxer/api/src/invite/InviteRepository';
import {InviteTypes} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import type {UpdateGuildVanityRequest} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';

interface AdminGuildVanityServiceDeps {
	guildRepository: IGuildRepositoryAggregate;
	inviteRepository: InviteRepository;
	auditService: AdminAuditService;
	updatePropagator: AdminGuildUpdatePropagator;
}

export class AdminGuildVanityService {
	constructor(private readonly deps: AdminGuildVanityServiceDeps) {}

	async updateGuildVanity(data: UpdateGuildVanityRequest, adminUserId: UserID, auditLogReason: string | null) {
		const {guildRepository, inviteRepository, auditService, updatePropagator} = this.deps;
		const guildId = createGuildID(data.guild_id);
		const guild = await guildRepository.findUnique(guildId);
		if (!guild) {
			throw new UnknownGuildError();
		}

		const oldVanity = guild.vanityUrlCode;
		const guildRow = guild.toRow();

		if (data.vanity_url_code) {
			const inviteCode = createInviteCode(data.vanity_url_code);
			const existingInvite = await inviteRepository.findUnique(inviteCode);
			if (existingInvite) {
				throw InputValidationError.fromCode('vanity_url_code', ValidationErrorCodes.THIS_VANITY_URL_IS_ALREADY_TAKEN);
			}

			if (oldVanity) {
				await inviteRepository.delete(vanityCodeToInviteCode(oldVanity));
			}

			await inviteRepository.create({
				code: inviteCode,
				type: InviteTypes.GUILD,
				guild_id: guildId,
				channel_id: null,
				inviter_id: null,
				uses: 0,
				max_uses: 0,
				max_age: 0,
				temporary: false,
			});
		} else if (oldVanity) {
			await inviteRepository.delete(vanityCodeToInviteCode(oldVanity));
		}

		const updatedGuild = await guildRepository.upsert({
			...guildRow,
			vanity_url_code: data.vanity_url_code ? createVanityURLCode(data.vanity_url_code) : null,
		});

		await updatePropagator.dispatchGuildUpdate(guildId, updatedGuild);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'guild',
			targetId: BigInt(guildId),
			action: 'update_vanity',
			auditLogReason,
			metadata: new Map([
				['old_vanity', oldVanity ?? ''],
				['new_vanity', data.vanity_url_code ?? ''],
			]),
		});

		return {
			guild: mapGuildToAdminResponse(updatedGuild),
		};
	}
}
