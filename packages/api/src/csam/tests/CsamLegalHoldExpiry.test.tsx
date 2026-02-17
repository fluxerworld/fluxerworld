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

import {CsamLegalHoldService} from '@fluxer/api/src/csam/CsamLegalHoldService';
import {deleteOneOrMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {CsamEvidenceLegalHoldRow} from '@fluxer/api/src/database/types/CsamTypes';
import {CsamEvidenceLegalHolds} from '@fluxer/api/src/Tables';
import {describe, expect, it} from 'vitest';

describe('CsamLegalHoldService expiry behaviour', () => {
	it('does not delete expired holds when checking', async () => {
		const service = new CsamLegalHoldService();
		const reportId = 901n;
		const heldUntil = new Date(Date.now() - 60_000);
		const row: CsamEvidenceLegalHoldRow = {
			report_id: reportId,
			held_until: heldUntil,
			created_at: new Date(heldUntil.getTime() - 1000),
		};

		try {
			await upsertOne(CsamEvidenceLegalHolds.insert(row));

			const isHeld = await service.isHeld(reportId.toString());
			expect(isHeld).toBe(false);

			const stored = await fetchOne<CsamEvidenceLegalHoldRow>(
				CsamEvidenceLegalHolds.select({
					where: [CsamEvidenceLegalHolds.where.eq('report_id', 'report_id')],
				}).bind({report_id: reportId}),
			);

			expect(stored).not.toBeNull();
		} finally {
			await deleteOneOrMany(CsamEvidenceLegalHolds.deleteByPk({report_id: reportId}));
		}
	});
});
