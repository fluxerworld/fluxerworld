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

import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {mapConnectionToResponse} from '@fluxer/api/src/connection/ConnectionMappers';
import {Logger} from '@fluxer/api/src/Logger';
import {getWorkerDependencies} from '@fluxer/api/src/worker/WorkerContext';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {z} from 'zod';

const PayloadSchema = z.object({
	userId: z.string(),
});

const revalidateUserConnections: WorkerTaskHandler = async (payload, helpers) => {
	const validated = PayloadSchema.parse(payload);
	helpers.logger.debug({payload: validated}, 'Processing revalidateUserConnections task');

	const userId = createUserID(BigInt(validated.userId));
	const {connectionRepository, connectionService, gatewayService} = getWorkerDependencies();

	const connections = await connectionRepository.findByUserId(userId);
	const verifiedConnections = connections.filter((conn) => conn.verified);

	if (verifiedConnections.length === 0) {
		helpers.logger.debug({userId: userId.toString()}, 'No verified connections to revalidate');
		return;
	}

	let hasChanges = false;

	for (const connection of verifiedConnections) {
		try {
			const {isValid, updateParams} = await connectionService.revalidateConnection(connection);

			if (updateParams) {
				await connectionRepository.update(userId, connection.connection_type, connection.connection_id, updateParams);
				hasChanges = true;

				if (!isValid) {
					Logger.info(
						{
							userId: userId.toString(),
							connectionId: connection.connection_id,
							connectionType: connection.connection_type,
						},
						'Connection verification failed, marked as unverified',
					);
				}
			}
		} catch (error) {
			Logger.error(
				{
					error,
					userId: userId.toString(),
					connectionId: connection.connection_id,
					connectionType: connection.connection_type,
				},
				'Failed to revalidate connection',
			);
		}
	}

	if (hasChanges) {
		const updatedConnections = await connectionRepository.findByUserId(userId);
		await gatewayService.dispatchPresence({
			userId,
			event: 'USER_CONNECTIONS_UPDATE',
			data: {connections: updatedConnections.map(mapConnectionToResponse)},
		});
		Logger.info({userId: userId.toString()}, 'Dispatched USER_CONNECTIONS_UPDATE event');
	}

	helpers.logger.debug(
		{userId: userId.toString(), checked: verifiedConnections.length, hasChanges},
		'Completed connection revalidation',
	);
};

export default revalidateUserConnections;
