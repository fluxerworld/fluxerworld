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

import type {CassandraParam, DbOp} from '@fluxer/api/src/database/Cassandra';
import {fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {SystemDmJobRow} from '@fluxer/api/src/database/types/SystemDmJobTypes';
import {SystemDmJobs} from '@fluxer/api/src/Tables';

const JOB_TYPE = 'system_dm';

const FETCH_JOB_BY_ID = SystemDmJobs.select({
	where: [SystemDmJobs.where.eq('job_type'), SystemDmJobs.where.eq('job_id')],
});

export class SystemDmJobRepository {
	async createJob(job: SystemDmJobRow): Promise<void> {
		await upsertOne(SystemDmJobs.insert(job));
	}

	async getJob(jobId: bigint): Promise<SystemDmJobRow | null> {
		return fetchOne<SystemDmJobRow>(
			FETCH_JOB_BY_ID.bind({
				job_type: JOB_TYPE,
				job_id: jobId,
			}),
		);
	}

	async listJobs(limit: number, beforeJobId?: bigint): Promise<Array<SystemDmJobRow>> {
		const whereClauses = [SystemDmJobs.where.eq('job_type')];
		const params: Record<string, CassandraParam> = {job_type: JOB_TYPE};

		if (beforeJobId) {
			whereClauses.push(SystemDmJobs.where.lt('job_id', 'before_job_id'));
			params['before_job_id'] = beforeJobId;
		}

		const stmt = SystemDmJobs.select({
			where: whereClauses,
			orderBy: {col: 'job_id', direction: 'DESC'},
			limit,
		});

		return fetchMany<SystemDmJobRow>(stmt.bind(params));
	}

	async patchJob(jobId: bigint, patch: Partial<SystemDmJobRow>): Promise<void> {
		const patchOps = SystemDmJobRepository.buildPatch(patch);
		if (Object.keys(patchOps).length === 0) {
			return;
		}

		const query = SystemDmJobs.patchByPk(
			{job_type: JOB_TYPE, job_id: jobId},
			patchOps as Partial<{[K in Exclude<keyof SystemDmJobRow, 'job_type' | 'job_id'>]: DbOp<SystemDmJobRow[K]>}>,
		);
		await upsertOne(query);
	}

	private static buildPatch(patch: Partial<SystemDmJobRow>): Partial<{
		[K in Exclude<keyof SystemDmJobRow, 'job_type' | 'job_id'>]: {
			kind: 'set';
			value: SystemDmJobRow[K];
		};
	}> {
		const patchOps: Partial<{
			[K in Exclude<keyof SystemDmJobRow, 'job_type' | 'job_id'>]: {
				kind: 'set';
				value: SystemDmJobRow[K];
			};
		}> = {};

		for (const key of Object.keys(patch) as Array<keyof SystemDmJobRow>) {
			if (key === 'job_type' || key === 'job_id') {
				continue;
			}
			const value = patch[key];
			if (value === undefined) {
				continue;
			}
			const fieldKey = key as Exclude<keyof SystemDmJobRow, 'job_type' | 'job_id'>;
			(patchOps as Record<string, {kind: 'set'; value: SystemDmJobRow[keyof SystemDmJobRow]}>)[fieldKey] = {
				kind: 'set',
				value: value as SystemDmJobRow[typeof fieldKey],
			};
		}

		return patchOps;
	}
}
