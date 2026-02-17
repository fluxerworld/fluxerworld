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

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {IMetadataService, MetadataRequest} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import {MetadataRequest as MetadataRequestSchema} from '@fluxer/schema/src/domains/media_proxy/MediaProxySchemas';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';

interface MetadataControllerDeps {
	metadataService: IMetadataService;
	logger: LoggerInterface;
}

export function createMetadataHandler(deps: MetadataControllerDeps) {
	const {metadataService, logger} = deps;

	return async (ctx: Context<HonoEnv>) => {
		try {
			const requestJson = await ctx.req.json<MetadataRequest>();
			const request: MetadataRequest = MetadataRequestSchema.parse(requestJson);
			const result = await metadataService.getMetadata(request);
			return ctx.json(result);
		} catch (error) {
			if (error instanceof HTTPException) throw error;
			logger.error({error}, 'Failed to process metadata request');
			throw new HTTPException(400, {message: error instanceof Error ? error.message : 'Failed to process metadata'});
		}
	};
}
