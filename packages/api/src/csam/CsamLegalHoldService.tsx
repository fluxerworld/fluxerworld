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

import {deleteOneOrMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {CsamEvidenceLegalHoldRow} from '@fluxer/api/src/database/types/CsamTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {CsamEvidenceLegalHolds} from '@fluxer/api/src/Tables';

export class CsamLegalHoldService {
	private async toReportId(reportId: string): Promise<bigint> {
		try {
			return BigInt(reportId);
		} catch (error) {
			Logger.error({error, reportId}, 'Invalid report ID for CSAM legal hold');
			throw error;
		}
	}

	async hold(reportId: string, expiresAt?: Date): Promise<void> {
		const id = await this.toReportId(reportId);
		const row: CsamEvidenceLegalHoldRow = {
			report_id: id,
			held_until: expiresAt ?? null,
			created_at: new Date(),
		};

		try {
			await upsertOne(CsamEvidenceLegalHolds.insert(row));
		} catch (error) {
			Logger.error({error, reportId}, 'Failed to persist CSAM legal hold');
			throw error;
		}
	}

	async release(reportId: string): Promise<void> {
		const id = await this.toReportId(reportId);
		try {
			await deleteOneOrMany(CsamEvidenceLegalHolds.deleteByPk({report_id: id}));
		} catch (error) {
			Logger.error({error, reportId}, 'Failed to release CSAM legal hold');
			throw error;
		}
	}

	async isHeld(reportId: string): Promise<boolean> {
		const id = await this.toReportId(reportId);
		try {
			const row = await fetchOne<CsamEvidenceLegalHoldRow>(
				CsamEvidenceLegalHolds.select({
					where: CsamEvidenceLegalHolds.where.eq('report_id'),
					limit: 1,
				}).bind({report_id: id}),
			);

			if (!row) {
				return false;
			}

			const now = Date.now();
			if (row.held_until && row.held_until.getTime() < now) {
				return false;
			}

			return true;
		} catch (error) {
			Logger.error({error, reportId}, 'Failed to fetch CSAM legal hold');
			throw error;
		}
	}
}
