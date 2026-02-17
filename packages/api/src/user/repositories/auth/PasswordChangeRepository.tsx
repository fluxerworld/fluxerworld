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
import type {PasswordChangeTicketRow} from '@fluxer/api/src/database/types/AuthTypes';
import {PasswordChangeTickets} from '@fluxer/api/src/Tables';

const FETCH_TICKET_CQL = PasswordChangeTickets.selectCql({
	where: PasswordChangeTickets.where.eq('ticket'),
	limit: 1,
});

export class PasswordChangeRepository {
	async createTicket(row: PasswordChangeTicketRow): Promise<void> {
		await upsertOne(PasswordChangeTickets.insert(row));
	}

	async updateTicket(row: PasswordChangeTicketRow): Promise<void> {
		await upsertOne(PasswordChangeTickets.upsertAll(row));
	}

	async findTicket(ticket: string): Promise<PasswordChangeTicketRow | null> {
		return await fetchOne<PasswordChangeTicketRow>(FETCH_TICKET_CQL, {ticket});
	}

	async deleteTicket(ticket: string): Promise<void> {
		await deleteOneOrMany(PasswordChangeTickets.deleteByPk({ticket}));
	}
}
