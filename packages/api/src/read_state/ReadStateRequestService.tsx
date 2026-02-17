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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {createChannelID, createMessageID} from '@fluxer/api/src/BrandedTypes';
import type {ReadStateService} from '@fluxer/api/src/read_state/ReadStateService';
import type {ReadStateAckBulkRequest} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';

interface ReadStateAckBulkParams {
	userId: UserID;
	data: ReadStateAckBulkRequest;
}

export class ReadStateRequestService {
	constructor(private readStateService: ReadStateService) {}

	async bulkAckMessages({userId, data}: ReadStateAckBulkParams): Promise<void> {
		await this.readStateService.bulkAckMessages({
			userId,
			readStates: data.read_states.map((readState) => ({
				channelId: createChannelID(readState.channel_id),
				messageId: createMessageID(readState.message_id),
			})),
		});
	}
}
