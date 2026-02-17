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

import type {AdminAuditLog, IAdminRepository} from '@fluxer/api/src/admin/IAdminRepository';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import {getAuditLogSearchService} from '@fluxer/api/src/SearchFactory';

interface CreateAdminAuditLogParams {
	adminUserId: UserID;
	targetType: string;
	targetId: bigint;
	action: string;
	auditLogReason: string | null;
	metadata?: Map<string, string>;
}

export class AdminAuditService {
	constructor(
		private readonly adminRepository: IAdminRepository,
		private readonly snowflakeService: SnowflakeService,
	) {}

	async createAuditLog({
		adminUserId,
		targetType,
		targetId,
		action,
		auditLogReason,
		metadata = new Map(),
	}: CreateAdminAuditLogParams): Promise<void> {
		const log = await this.adminRepository.createAuditLog({
			log_id: await this.snowflakeService.generate(),
			admin_user_id: adminUserId,
			target_type: targetType,
			target_id: targetId,
			action,
			audit_log_reason: auditLogReason ?? null,
			metadata,
			created_at: new Date(),
		});

		const auditLogSearchService = getAuditLogSearchService();
		if (auditLogSearchService && 'indexAuditLog' in auditLogSearchService) {
			auditLogSearchService.indexAuditLog(log).catch((error) => {
				Logger.error({error, logId: log.logId}, 'Failed to index audit log to search');
			});
		}
	}

	async listAuditLogs(data: {
		admin_user_id?: bigint;
		target_type?: string;
		target_id?: string;
		limit?: number;
		offset?: number;
	}): Promise<{logs: Array<AdminAuditLogResponse>; total: number}> {
		const auditLogSearchService = getAuditLogSearchService();

		const targetIdBigInt = data.target_id ? BigInt(data.target_id) : undefined;

		if (!auditLogSearchService || !auditLogSearchService.isAvailable()) {
			return this.listAuditLogsFromDatabase({
				adminUserId: data.admin_user_id,
				targetType: data.target_type,
				targetId: targetIdBigInt,
				limit: data.limit,
				offset: data.offset,
			});
		}

		const limit = data.limit || 50;
		const filters: Record<string, string> = {};

		if (data.admin_user_id) {
			filters['adminUserId'] = data.admin_user_id.toString();
		}
		if (data.target_type) {
			filters['targetType'] = data.target_type;
		}
		if (data.target_id) {
			filters['targetId'] = data.target_id;
		}

		const {hits, total} = await auditLogSearchService.searchAuditLogs('', filters, {
			limit,
			offset: data.offset || 0,
		});

		const orderedLogs = await this.loadLogsInSearchOrder(hits.map((hit) => BigInt(hit.logId)));

		return {
			logs: orderedLogs.map((log) => this.toResponse(log)),
			total,
		};
	}

	async searchAuditLogs(data: {
		query?: string;
		admin_user_id?: bigint;
		target_id?: string;
		sort_by?: 'createdAt' | 'relevance';
		sort_order?: 'asc' | 'desc';
		limit?: number;
		offset?: number;
	}): Promise<{logs: Array<AdminAuditLogResponse>; total: number}> {
		const auditLogSearchService = getAuditLogSearchService();

		const targetIdBigInt = data.target_id ? BigInt(data.target_id) : undefined;

		if (!auditLogSearchService || !auditLogSearchService.isAvailable()) {
			return this.listAuditLogsFromDatabase({
				adminUserId: data.admin_user_id,
				targetId: targetIdBigInt,
				limit: data.limit,
				offset: data.offset,
			});
		}

		const filters: Record<string, string> = {};

		if (data.admin_user_id) {
			filters['adminUserId'] = data.admin_user_id.toString();
		}
		if (data.target_id) {
			filters['targetId'] = data.target_id;
		}
		if (data.sort_by) {
			filters['sortBy'] = data.sort_by;
		}
		if (data.sort_order) {
			filters['sortOrder'] = data.sort_order;
		}

		const {hits, total} = await auditLogSearchService.searchAuditLogs(data.query || '', filters, {
			limit: data.limit || 50,
			offset: data.offset || 0,
		});

		const orderedLogs = await this.loadLogsInSearchOrder(hits.map((hit) => BigInt(hit.logId)));

		return {
			logs: orderedLogs.map((log) => this.toResponse(log)),
			total,
		};
	}

	private async listAuditLogsFromDatabase(data: {
		adminUserId?: bigint;
		targetType?: string;
		targetId?: bigint;
		limit?: number;
		offset?: number;
	}): Promise<{logs: Array<AdminAuditLogResponse>; total: number}> {
		const limit = data.limit || 50;
		const allLogs = await this.adminRepository.listAllAuditLogsPaginated(limit + (data.offset || 0));

		let filteredLogs = allLogs;

		if (data.adminUserId) {
			filteredLogs = filteredLogs.filter((log) => log.adminUserId === data.adminUserId);
		}

		if (data.targetType) {
			filteredLogs = filteredLogs.filter((log) => log.targetType === data.targetType);
		}

		if (data.targetId) {
			filteredLogs = filteredLogs.filter((log) => log.targetId === data.targetId);
		}

		const offset = data.offset || 0;
		const paginatedLogs = filteredLogs.slice(offset, offset + limit);

		return {
			logs: paginatedLogs.map((log) => this.toResponse(log)),
			total: filteredLogs.length,
		};
	}

	private async loadLogsInSearchOrder(logIds: Array<bigint>): Promise<Array<AdminAuditLog>> {
		const logs = await this.adminRepository.listAuditLogsByIds(logIds);
		const logMap = new Map(logs.map((log) => [log.logId.toString(), log]));
		const result: Array<AdminAuditLog> = [];
		for (const logId of logIds) {
			const log = logMap.get(logId.toString());
			if (log) {
				result.push(log);
			}
		}
		return result;
	}

	private toResponse(log: AdminAuditLog): AdminAuditLogResponse {
		return {
			log_id: log.logId.toString(),
			admin_user_id: log.adminUserId.toString(),
			target_type: log.targetType,
			target_id: log.targetId.toString(),
			action: log.action,
			audit_log_reason: log.auditLogReason,
			metadata: Object.fromEntries(log.metadata),
			created_at: log.createdAt.toISOString(),
		};
	}
}

interface AdminAuditLogResponse {
	log_id: string;
	admin_user_id: string;
	target_type: string;
	target_id: string;
	action: string;
	audit_log_reason: string | null;
	metadata: Record<string, string>;
	created_at: string;
}
