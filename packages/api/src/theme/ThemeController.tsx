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

import {DatabaseSync} from 'node:sqlite';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	ThemeCreateRequest,
	ThemeCreateResponse,
	ThemeGallerySubmitRequest,
	ThemeGallerySubmitResponse,
} from '@fluxer/schema/src/domains/theme/ThemeSchemas';

export function ThemeController(app: HonoApp) {
	app.post(
		'/users/@me/themes',
		RateLimitMiddleware(RateLimitConfigs.THEME_SHARE_CREATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_theme',
			summary: 'Create theme',
			responseSchema: ThemeCreateResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Themes'],
			description: 'Creates a new custom theme with CSS styling that can be shared with other users.',
		}),
		Validator('json', ThemeCreateRequest),
		async (ctx) => {
			const {css} = ctx.req.valid('json');
			const theme = await ctx.get('themeService').createTheme(css);
			return ctx.json(theme, 201);
		},
	);

	// Public gallery submission. Logged-in users can submit a theme to the
	// public gallery for review; submissions land in kv_store as
	// `theme_submissions` with status=pending. Admin reviews and copies the
	// JSON entry into webroot/themes.json, then re-mints via
	// scripts/mint-gallery-themes.cjs. Rate-limited tighter than share-create
	// since this writes a moderation queue, not a per-user resource.
	app.post(
		'/themes/gallery/submit',
		RateLimitMiddleware(RateLimitConfigs.THEME_GALLERY_SUBMIT),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'submit_gallery_theme',
			summary: 'Submit a theme to the public gallery',
			responseSchema: ThemeGallerySubmitResponse,
			statusCode: 201,
			security: ['sessionToken', 'bearerToken'],
			tags: ['Themes'],
			description: 'Submit a theme for review. Submissions are queued and reviewed manually.',
		}),
		Validator('json', ThemeGallerySubmitRequest),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');

			const submissionId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
			const row = {
				id: submissionId,
				submitter_user_id: user.id.toString(),
				submitted_at: new Date().toISOString(),
				status: 'pending',
				payload: body,
			};

			// Write directly to kv_store. ThemeService uses S3 only, so there's
			// no existing repository for submissions — a one-row insert is
			// fine.
			const db = new DatabaseSync('/usr/src/app/data/fluxer.db');
			try {
				db.prepare(
					'INSERT INTO kv_store (table_name, key, value, expires_at) VALUES (?, ?, ?, NULL)',
				).run('theme_submissions', submissionId, JSON.stringify(row));
			} finally {
				db.close();
			}

			return ctx.json({id: submissionId, status: 'pending' as const}, 201);
		},
	);
}
