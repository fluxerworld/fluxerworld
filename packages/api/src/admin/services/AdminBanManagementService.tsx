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

import type {IAdminRepository} from '@fluxer/api/src/admin/IAdminRepository';
import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {IP_BAN_REFRESH_CHANNEL} from '@fluxer/api/src/constants/IpBan';
import {ipBanCache} from '@fluxer/api/src/middleware/IpBanMiddleware';
import {getIpAddressReverse} from '@fluxer/api/src/utils/IpUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';

interface AdminBanManagementServiceDeps {
	adminRepository: IAdminRepository;
	auditService: AdminAuditService;
	cacheService: ICacheService;
}

export class AdminBanManagementService {
	constructor(private readonly deps: AdminBanManagementServiceDeps) {}

	async banIp(data: {ip: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService, cacheService} = this.deps;
		await adminRepository.banIp(data.ip);
		ipBanCache.ban(data.ip);
		await cacheService.publish(IP_BAN_REFRESH_CHANNEL, 'refresh');

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'ip',
			targetId: BigInt(0),
			action: 'ban_ip',
			auditLogReason,
			metadata: new Map([['ip', data.ip]]),
		});
	}

	async unbanIp(data: {ip: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService, cacheService} = this.deps;
		await adminRepository.unbanIp(data.ip);
		ipBanCache.unban(data.ip);
		await cacheService.publish(IP_BAN_REFRESH_CHANNEL, 'refresh');

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'ip',
			targetId: BigInt(0),
			action: 'unban_ip',
			auditLogReason,
			metadata: new Map([['ip', data.ip]]),
		});
	}

	async checkIpBan(data: {ip: string}): Promise<{banned: boolean}> {
		const banned = ipBanCache.isBanned(data.ip);
		return {banned};
	}

	async banEmail(data: {email: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService} = this.deps;
		await adminRepository.banEmail(data.email);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'email',
			targetId: BigInt(0),
			action: 'ban_email',
			auditLogReason,
			metadata: new Map([['email', data.email]]),
		});
	}

	async unbanEmail(data: {email: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService} = this.deps;
		await adminRepository.unbanEmail(data.email);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'email',
			targetId: BigInt(0),
			action: 'unban_email',
			auditLogReason,
			metadata: new Map([['email', data.email]]),
		});
	}

	async checkEmailBan(data: {email: string}): Promise<{banned: boolean}> {
		const {adminRepository} = this.deps;
		const banned = await adminRepository.isEmailBanned(data.email);
		return {banned};
	}

	async banPhone(data: {phone: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService} = this.deps;
		await adminRepository.banPhone(data.phone);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'phone',
			targetId: BigInt(0),
			action: 'ban_phone',
			auditLogReason,
			metadata: new Map([['phone', data.phone]]),
		});
	}

	async unbanPhone(data: {phone: string}, adminUserId: UserID, auditLogReason: string | null) {
		const {adminRepository, auditService} = this.deps;
		await adminRepository.unbanPhone(data.phone);

		await auditService.createAuditLog({
			adminUserId,
			targetType: 'phone',
			targetId: BigInt(0),
			action: 'unban_phone',
			auditLogReason,
			metadata: new Map([['phone', data.phone]]),
		});
	}

	async checkPhoneBan(data: {phone: string}): Promise<{banned: boolean}> {
		const {adminRepository} = this.deps;
		const banned = await adminRepository.isPhoneBanned(data.phone);
		return {banned};
	}

	async listIpBans(data: {limit: number}): Promise<{bans: Array<{ip: string; reverse_dns: string | null}>}> {
		const {adminRepository, cacheService} = this.deps;
		const ips = await adminRepository.listBannedIps(data.limit);

		const reverseResults = await Promise.allSettled(
			ips.map((ip) => {
				// CIDR ranges can't be reverse-resolved.
				if (ip.includes('/')) return Promise.resolve(null);
				return getIpAddressReverse(ip, cacheService);
			}),
		);

		return {
			bans: ips.map((ip, index) => {
				const reverseResult = reverseResults[index];
				return {
					ip,
					reverse_dns: reverseResult?.status === 'fulfilled' ? reverseResult.value : null,
				};
			}),
		};
	}

	async listEmailBans(data: {limit: number}): Promise<{bans: Array<string>}> {
		const {adminRepository} = this.deps;
		return {bans: await adminRepository.listBannedEmails(data.limit)};
	}

	async listPhoneBans(data: {limit: number}): Promise<{bans: Array<string>}> {
		const {adminRepository} = this.deps;
		return {bans: await adminRepository.listBannedPhones(data.limit)};
	}
}
