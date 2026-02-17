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
import type {IFrameService} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';
import * as v from 'valibot';

const FrameExtractionRequestSchema = v.union([
	v.object({
		type: v.literal('upload'),
		upload_filename: v.string(),
	}),
	v.object({
		type: v.literal('s3'),
		bucket: v.string(),
		key: v.string(),
	}),
]);

interface FrameExtractionControllerDeps {
	frameService: IFrameService;
	logger: LoggerInterface;
}

export function createFrameExtractionHandler(deps: FrameExtractionControllerDeps) {
	const {frameService, logger} = deps;

	return async (ctx: Context<HonoEnv>): Promise<Response> => {
		try {
			const body = await ctx.req.json();
			const request = v.parse(FrameExtractionRequestSchema, body);
			const result = await frameService.extractFrames(request);
			return ctx.json(result);
		} catch (error) {
			if (error instanceof HTTPException) throw error;
			if (v.isValiError(error)) throw error;
			logger.error({error}, 'Failed to extract media frames');
			throw new HTTPException(500, {message: error instanceof Error ? error.message : 'Unable to extract frames'});
		}
	};
}
