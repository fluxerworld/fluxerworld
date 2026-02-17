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

import {BucketController} from '@fluxer/s3/src/s3/BucketController';
import {ObjectController} from '@fluxer/s3/src/s3/ObjectController';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import type {Hono} from 'hono';

export function registerS3Routes(app: Hono<HonoEnv>): void {
	app.get('/_health', (ctx) => {
		return ctx.json({ok: true}, 200);
	});

	ObjectController(app);
	BucketController(app);
}
